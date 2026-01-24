# Security Model

> Security architecture, encryption, and authentication for Link.

---

## Overview

Link handles sensitive OAuth tokens and API credentials. Security is implemented across multiple layers:

1. **Request Authentication** - HMAC signatures for API requests
2. **Token Encryption** - AES-256-GCM for stored credentials
3. **OAuth Security** - State tokens, PKCE, expiration
4. **Access Control** - Row Level Security (RLS) in Supabase
5. **Rate Limiting** - Protection against abuse

---

## 1. HMAC Request Signing

All SDK requests to the Link API are signed using HMAC-SHA256.

### Why HMAC?

- Ensures request authenticity (came from the developer)
- Prevents replay attacks (timestamp validation)
- Protects against tampering (signature covers body)

### Signature Algorithm

```typescript
// Client-side (SDK)
function signRequest(secretKey: string, body: any): RequestHeaders {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  
  return {
    'X-Link-Public-Key': publicKey,
    'X-Link-Timestamp': timestamp.toString(),
    'X-Link-Signature': signature,
  };
}
```

### Server-side Verification

```typescript
async function verifySignature(req: Request): Promise<boolean> {
  const publicKey = req.headers['x-link-public-key'];
  const timestamp = req.headers['x-link-timestamp'];
  const signature = req.headers['x-link-signature'];
  
  // 1. Check timestamp freshness (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new TimestampExpiredError('Request timestamp too old');
  }
  
  // 2. Look up API key
  const apiKey = await db.projectApiKeys.findByPublicKey(publicKey);
  if (!apiKey || apiKey.status !== 'active') {
    throw new InvalidApiKeyError('API key not found or revoked');
  }
  
  // 3. Recreate expected signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', decrypt(apiKey.secret_key_encrypted))
    .update(payload)
    .digest('hex');
  
  // 4. Constant-time comparison (prevents timing attacks)
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw new InvalidSignatureError('Signature verification failed');
  }
  
  // 5. Update last_used_at
  await db.projectApiKeys.updateLastUsed(apiKey.id);
  
  return true;
}
```

---

## 2. Token Encryption (AES-256-GCM)

All OAuth tokens and sensitive credentials are encrypted before storage.

### Encrypted Fields

| Table | Field | Encryption |
|-------|-------|------------|
| `providers` | `oauth_client_secret` | AES-256-GCM |
| `provider_connections` | `access_token` | AES-256-GCM |
| `provider_connections` | `refresh_token` | AES-256-GCM |
| `project_api_keys` | `secret_key` | AES-256-GCM (or bcrypt hash) |
| `webhooks` | `secret` | AES-256-GCM |

### Encryption Implementation

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Master key from environment variable
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedData] = ciphertext.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### Key Management

```typescript
// Key generation (run once, store securely)
const key = crypto.randomBytes(32).toString('hex');
// Store in: process.env.ENCRYPTION_KEY

// Key rotation support
interface EncryptedValue {
  version: number;      // Key version
  ciphertext: string;   // Encrypted data
}

// When rotating keys:
// 1. Add new key with incremented version
// 2. Re-encrypt all tokens with new key
// 3. Update version in encrypted values
// 4. Remove old key after migration
```

---

## 3. OAuth Security

### State Token Validation

Prevents CSRF attacks during OAuth flow.

```typescript
// Generate state
function generateOAuthState(projectId: string, providerId: string): string {
  const stateToken = crypto.randomBytes(32).toString('base64url');
  
  // Store in database with expiration
  await db.oauthStates.create({
    state_token: stateToken,
    project_id: projectId,
    provider_id: providerId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });
  
  return stateToken;
}

// Validate state on callback
async function validateOAuthState(state: string): Promise<OAuthState> {
  const stateRecord = await db.oauthStates.findByToken(state);
  
  if (!stateRecord) {
    throw new InvalidStateError('OAuth state not found');
  }
  
  if (stateRecord.used_at) {
    throw new InvalidStateError('OAuth state already used');
  }
  
  if (new Date(stateRecord.expires_at) < new Date()) {
    throw new InvalidStateError('OAuth state expired');
  }
  
  // Mark as used
  await db.oauthStates.markUsed(stateRecord.id);
  
  return stateRecord;
}
```

### PKCE (Proof Key for Code Exchange)

Additional security for public clients.

```typescript
// Generate PKCE verifier and challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
}

// Store verifier with state
await db.oauthStates.create({
  state_token: stateToken,
  code_verifier: pkce.verifier,
  // ...
});

// Include challenge in auth URL
const authUrl = `${provider.auth_url}?` + new URLSearchParams({
  client_id: provider.oauth_client_id,
  redirect_uri: callbackUrl,
  response_type: 'code',
  state: stateToken,
  code_challenge: pkce.challenge,
  code_challenge_method: 'S256',
  scope: scopes.join(' '),
});

// Use verifier when exchanging code
const tokenResponse = await fetch(provider.token_url, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: callbackUrl,
    client_id: provider.oauth_client_id,
    client_secret: decrypt(provider.oauth_client_secret),
    code_verifier: stateRecord.code_verifier,
  }),
});
```

---

## 4. API Key Security

### Key Generation

```typescript
function generateApiKeys(environment: 'test' | 'live'): ApiKeyPair {
  // Public key: readable, used in requests
  const publicKey = `pk_${environment}_${crypto.randomBytes(24).toString('base64url')}`;
  
  // Secret key: sensitive, used for signing
  const secretKey = `sk_${environment}_${crypto.randomBytes(32).toString('base64url')}`;
  
  return { publicKey, secretKey };
}
```

### Secure Storage

```typescript
// Option 1: Hash secret key (can't be recovered)
const secretKeyHash = await bcrypt.hash(secretKey, 12);

// Option 2: Encrypt secret key (can be recovered for signing verification)
const secretKeyEncrypted = encrypt(secretKey);

// Store in database
await db.projectApiKeys.create({
  project_id: projectId,
  public_key: publicKey,
  secret_key_hash: secretKeyHash,     // If using Option 1
  secret_key_encrypted: secretKeyEncrypted, // If using Option 2
  environment,
  status: 'active',
});
```

### Key Rotation

```typescript
async function rotateApiKey(keyId: string): Promise<ApiKeyPair> {
  const oldKey = await db.projectApiKeys.get(keyId);
  
  // Generate new keys
  const newKeys = generateApiKeys(oldKey.environment);
  
  // Create new key
  await db.projectApiKeys.create({
    project_id: oldKey.project_id,
    public_key: newKeys.publicKey,
    secret_key_encrypted: encrypt(newKeys.secretKey),
    environment: oldKey.environment,
    status: 'active',
  });
  
  // Revoke old key (with grace period)
  await db.projectApiKeys.update(keyId, {
    status: 'revoked',
    revoked_at: new Date(),
  });
  
  return newKeys;
}
```

---

## 5. Rate Limiting

### Implementation

```typescript
import { RateLimiter } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiter({
  points: 60,           // Requests
  duration: 60,         // Per minute
  blockDuration: 60,    // Block for 1 minute if exceeded
});

async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const projectId = req.project?.id;
  
  try {
    const result = await rateLimiter.consume(projectId);
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': rateLimiter.points,
      'X-RateLimit-Remaining': result.remainingPoints,
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + result.msBeforeNext / 1000,
    });
    
    next();
  } catch (error) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: error.msBeforeNext / 1000,
      },
    });
  }
}
```

### Rate Limit Tiers

| Tier | Requests/min | Requests/day | Connections |
|------|--------------|--------------|-------------|
| Free | 60 | 1,000 | 10 |
| Pro | 600 | 50,000 | 100 |
| Enterprise | Custom | Custom | Unlimited |

---

## 6. Row Level Security (RLS)

Supabase RLS policies ensure data isolation.

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can access own projects" ON projects
  FOR ALL
  USING (user_id = auth.uid());

-- API Keys: Access through project ownership
CREATE POLICY "Access API keys through project" ON project_api_keys
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- End Users: Access through project ownership
CREATE POLICY "Access end users through project" ON end_users
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Connections: Access through project ownership
CREATE POLICY "Access connections through project" ON provider_connections
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

---

## 7. Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet());

// Custom security headers
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});
```

---

## 8. Input Validation

```typescript
import { z } from 'zod';

// Validate all incoming requests
const connectSchema = z.object({
  provider: z.enum(['gmail', 'google_calendar', 'notion', 'slack']),
  userId: z.string().min(1).max(255),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).optional(),
});

function validateRequest<T>(schema: z.Schema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError('Invalid request parameters', result.error.issues);
  }
  
  return result.data;
}
```

---

## 9. Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  actor: {
    type: 'platform_user' | 'api_key' | 'system';
    id: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  metadata: Record<string, any>;
  ip_address: string;
  user_agent: string;
}

async function logAuditEvent(event: AuditLog): Promise<void> {
  await db.auditLogs.create(event);
  
  // Also send to external logging service
  logger.info('Audit event', event);
}

// Usage
await logAuditEvent({
  timestamp: new Date(),
  actor: { type: 'api_key', id: 'key_xxx' },
  action: 'connection.created',
  resource: { type: 'provider_connection', id: 'conn_xxx' },
  metadata: { provider: 'gmail', scopes: ['email.read'] },
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});
```

---

## Security Checklist

### Before Launch

- [ ] All tokens encrypted at rest (AES-256-GCM)
- [ ] HMAC signature verification implemented
- [ ] OAuth state validation with expiration
- [ ] PKCE enabled for OAuth flows
- [ ] Rate limiting configured per tier
- [ ] RLS policies enabled on all tables
- [ ] Security headers configured
- [ ] Input validation with Zod schemas
- [ ] Audit logging implemented
- [ ] API keys support rotation

### Ongoing

- [ ] Regular security audits
- [ ] Dependency vulnerability scanning
- [ ] Key rotation schedule
- [ ] Monitor for suspicious activity
- [ ] Penetration testing
