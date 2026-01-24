# Authentication & OAuth Flows

> Complete flow diagrams for all authentication scenarios in Link.

---

## Overview

Link has **3 authentication layers**:

| Layer | Who | Credentials | Storage |
|-------|-----|-------------|---------|
| Platform Auth | Developers using Link dashboard | Email/password via Supabase | `platform_users` |
| Project Auth | Developer apps calling Link API | `public_key` + `secret_key` | `project_api_keys` |
| End User OAuth | End users connecting providers | `access_token` + `refresh_token` | `provider_connections` |

---

## Flow 1: Developer Registration & Setup

### Sequence Diagram

```
Developer                    Link Dashboard                  Supabase
    │                              │                            │
    │  1. Sign up with email       │                            │
    │─────────────────────────────►│                            │
    │                              │  2. Create auth user       │
    │                              │───────────────────────────►│
    │                              │                            │
    │                              │  3. Auth user created      │
    │                              │◄───────────────────────────│
    │                              │                            │
    │                              │  4. Insert platform_user   │
    │                              │───────────────────────────►│
    │                              │                            │
    │  5. Dashboard access         │                            │
    │◄─────────────────────────────│                            │
    │                              │                            │
```

### Steps

1. Developer visits Link dashboard and signs up
2. Supabase Auth creates authentication record
3. Trigger creates corresponding `platform_users` row
4. Developer gains access to dashboard

---

## Flow 2: Project Creation & API Keys

### Sequence Diagram

```
Developer                    Link Dashboard                  Supabase
    │                              │                            │
    │  1. Create new project       │                            │
    │─────────────────────────────►│                            │
    │                              │                            │
    │                              │  2. Generate keys          │
    │                              │  pk_live_xxx, sk_live_xxx  │
    │                              │                            │
    │                              │  3. Hash secret key        │
    │                              │  Store in project_api_keys │
    │                              │───────────────────────────►│
    │                              │                            │
    │  4. Return keys              │                            │
    │  (secret shown ONCE)         │                            │
    │◄─────────────────────────────│                            │
    │                              │                            │
    │  5. Developer stores keys    │                            │
    │     in their app config      │                            │
    │                              │                            │
```

### Key Generation

```typescript
// Public key format
const publicKey = `pk_${environment}_${randomBytes(24).toString('base64url')}`;
// Example: pk_live_<random-24-chars>

// Secret key format
const secretKey = `sk_${environment}_${randomBytes(32).toString('base64url')}`;
// Example: sk_live_<random-32-chars>

// Only store hash of secret key
const secretKeyHash = await bcrypt.hash(secretKey, 12);
```

---

## Flow 3: SDK Request Authentication

### Sequence Diagram

```
Developer App                   Link SDK                      Link API
    │                              │                            │
    │  1. link.gmail.fetch(...)    │                            │
    │─────────────────────────────►│                            │
    │                              │                            │
    │                              │  2. Build request          │
    │                              │  - Add timestamp           │
    │                              │  - Create signature        │
    │                              │                            │
    │                              │  3. Send signed request    │
    │                              │───────────────────────────►│
    │                              │                            │
    │                              │  4. Verify signature       │
    │                              │  - Check timestamp         │
    │                              │  - Validate HMAC           │
    │                              │                            │
    │                              │  5. Process request        │
    │                              │◄───────────────────────────│
    │                              │                            │
    │  6. Return response          │                            │
    │◄─────────────────────────────│                            │
    │                              │                            │
```

### Signature Algorithm

```typescript
// Client-side (SDK)
function signRequest(secretKey: string, body: any): SignedRequest {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  
  return {
    headers: {
      'X-Link-Timestamp': timestamp.toString(),
      'X-Link-Signature': signature,
      'X-Link-Public-Key': publicKey,
    },
    body,
  };
}

// Server-side (API)
function verifySignature(req: Request): boolean {
  const timestamp = req.headers['x-link-timestamp'];
  const signature = req.headers['x-link-signature'];
  const publicKey = req.headers['x-link-public-key'];
  
  // Check timestamp freshness (5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new TimestampExpiredError();
  }
  
  // Get secret key hash from database
  const apiKey = await db.projectApiKeys.findByPublicKey(publicKey);
  if (!apiKey || apiKey.status !== 'active') {
    throw new InvalidApiKeyError();
  }
  
  // Recreate expected signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', apiKey.secretKey) // Decrypted from storage
    .update(payload)
    .digest('hex');
  
  // Constant-time comparison
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw new InvalidSignatureError();
  }
  
  return true;
}
```

---

## Flow 4: End User OAuth Connection (Complete Flow)

### Phase 1: Initiate Connection

```
End User          Developer App         Link SDK            Link API
    │                  │                   │                   │
    │ Click "Connect   │                   │                   │
    │ Gmail"           │                   │                   │
    │─────────────────►│                   │                   │
    │                  │                   │                   │
    │                  │ link.connect(     │                   │
    │                  │   "gmail",        │                   │
    │                  │   { userId }      │                   │
    │                  │ )                 │                   │
    │                  │──────────────────►│                   │
    │                  │                   │                   │
    │                  │                   │ POST /oauth/      │
    │                  │                   │ connect           │
    │                  │                   │──────────────────►│
    │                  │                   │                   │
    │                  │                   │                   │ Create oauth_state
    │                  │                   │                   │ (state_token,
    │                  │                   │                   │  project_id,
    │                  │                   │                   │  provider_id,
    │                  │                   │                   │  redirect_uri)
    │                  │                   │                   │
    │                  │                   │ { authorization   │
    │                  │                   │   Url }           │
    │                  │                   │◄──────────────────│
    │                  │                   │                   │
    │                  │ { authorization   │                   │
    │                  │   Url }           │                   │
    │                  │◄──────────────────│                   │
    │                  │                   │                   │
    │ Redirect to      │                   │                   │
    │ authorizationUrl │                   │                   │
    │◄─────────────────│                   │                   │
    │                  │                   │                   │
```

### Phase 2: OAuth Consent

```
End User                     Link OAuth Page                  Google OAuth
    │                              │                              │
    │  Visit authorization URL     │                              │
    │─────────────────────────────►│                              │
    │                              │                              │
    │                              │  Build Google OAuth URL      │
    │                              │  with state token            │
    │                              │                              │
    │  Redirect to Google          │                              │
    │◄─────────────────────────────│                              │
    │                              │                              │
    │  Visit Google OAuth          │                              │
    │─────────────────────────────────────────────────────────────►
    │                              │                              │
    │  User sees consent screen    │                              │
    │  "App wants to access..."    │                              │
    │◄─────────────────────────────────────────────────────────────
    │                              │                              │
    │  User clicks "Allow"         │                              │
    │─────────────────────────────────────────────────────────────►
    │                              │                              │
    │  Redirect to Link callback   │                              │
    │  with code + state           │                              │
    │◄─────────────────────────────────────────────────────────────
    │                              │                              │
```

### Phase 3: Token Exchange

```
End User              Link Callback              Google API           Supabase
    │                      │                         │                   │
    │ GET /oauth/callback  │                         │                   │
    │ ?code=abc&state=xyz  │                         │                   │
    │─────────────────────►│                         │                   │
    │                      │                         │                   │
    │                      │ 1. Validate state       │                   │
    │                      │    token exists and     │                   │
    │                      │    not expired          │                   │
    │                      │────────────────────────────────────────────►│
    │                      │                         │                   │
    │                      │                         │                   │
    │                      │ 2. Exchange code for    │                   │
    │                      │    tokens               │                   │
    │                      │────────────────────────►│                   │
    │                      │                         │                   │
    │                      │    access_token,        │                   │
    │                      │    refresh_token        │                   │
    │                      │◄────────────────────────│                   │
    │                      │                         │                   │
    │                      │ 3. Get user info        │                   │
    │                      │────────────────────────►│                   │
    │                      │    email, user_id       │                   │
    │                      │◄────────────────────────│                   │
    │                      │                         │                   │
    │                      │ 4. Encrypt tokens       │                   │
    │                      │                         │                   │
    │                      │ 5. Create/update        │                   │
    │                      │    end_user             │                   │
    │                      │────────────────────────────────────────────►│
    │                      │                         │                   │
    │                      │ 6. Create               │                   │
    │                      │    provider_connection  │                   │
    │                      │────────────────────────────────────────────►│
    │                      │                         │                   │
    │                      │ 7. Mark state as used   │                   │
    │                      │────────────────────────────────────────────►│
    │                      │                         │                   │
    │ 8. Redirect to       │                         │                   │
    │    developer app     │                         │                   │
    │    with connection_id│                         │                   │
    │◄─────────────────────│                         │                   │
    │                      │                         │                   │
```

### Phase 4: Developer App Receives Connection

```
End User                Developer App                   Developer Backend
    │                        │                               │
    │ Redirect from Link     │                               │
    │ ?connection_id=conn_x  │                               │
    │ &status=success        │                               │
    │───────────────────────►│                               │
    │                        │                               │
    │                        │ Store connection_id           │
    │                        │ for this user                 │
    │                        │──────────────────────────────►│
    │                        │                               │
    │                        │                               │ UPDATE users
    │                        │                               │ SET gmail_conn = 'conn_x'
    │                        │                               │ WHERE id = user_id
    │                        │                               │
    │ Show success message   │                               │
    │◄───────────────────────│                               │
    │                        │                               │
```

---

## Flow 5: API Request with Token Refresh

### Sequence Diagram

```
Developer App       Link SDK        Link API        Token Manager     Gmail API
    │                  │               │                 │               │
    │ link.gmail       │               │                 │               │
    │ .fetch(...)      │               │                 │               │
    │─────────────────►│               │                 │               │
    │                  │               │                 │               │
    │                  │ POST /gmail   │                 │               │
    │                  │ /fetch        │                 │               │
    │                  │──────────────►│                 │               │
    │                  │               │                 │               │
    │                  │               │ Get connection  │               │
    │                  │               │ & tokens        │               │
    │                  │               │────────────────►│               │
    │                  │               │                 │               │
    │                  │               │                 │ Check if      │
    │                  │               │                 │ expired       │
    │                  │               │                 │               │
    │                  │               │                 │ Token expired!│
    │                  │               │                 │ Refresh...    │
    │                  │               │                 │──────────────►│
    │                  │               │                 │               │
    │                  │               │                 │ New tokens    │
    │                  │               │                 │◄──────────────│
    │                  │               │                 │               │
    │                  │               │                 │ Update DB     │
    │                  │               │                 │ (encrypted)   │
    │                  │               │                 │               │
    │                  │               │ Fresh tokens    │               │
    │                  │               │◄────────────────│               │
    │                  │               │                 │               │
    │                  │               │ Call Gmail API  │               │
    │                  │               │─────────────────────────────────►
    │                  │               │                 │               │
    │                  │               │ Raw response    │               │
    │                  │               │◄─────────────────────────────────
    │                  │               │                 │               │
    │                  │               │ Normalize       │               │
    │                  │               │ response        │               │
    │                  │               │                 │               │
    │                  │ Normalized    │                 │               │
    │                  │ response      │                 │               │
    │                  │◄──────────────│                 │               │
    │                  │               │                 │               │
    │ Response         │               │                 │               │
    │◄─────────────────│               │                 │               │
    │                  │               │                 │               │
```

### Token Refresh Logic

```typescript
async function getValidToken(connectionId: string): Promise<TokenSet> {
  const connection = await db.providerConnections.get(connectionId);
  
  // Decrypt tokens
  const accessToken = decrypt(connection.access_token);
  const refreshToken = decrypt(connection.refresh_token);
  
  // Check if access token is expired (with 5 min buffer)
  const isExpired = connection.expires_at 
    && new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  
  if (!isExpired) {
    return { accessToken, refreshToken };
  }
  
  // Token expired, attempt refresh
  try {
    const provider = await db.providers.get(connection.provider_id);
    const newTokens = await refreshAccessToken(provider, refreshToken);
    
    // Update database with new encrypted tokens
    await db.providerConnections.update(connectionId, {
      access_token: encrypt(newTokens.accessToken),
      refresh_token: newTokens.refreshToken 
        ? encrypt(newTokens.refreshToken) 
        : connection.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expiresIn * 1000),
      status: 'active',
    });
    
    return newTokens;
  } catch (error) {
    // Refresh failed, mark connection as expired
    await db.providerConnections.update(connectionId, {
      status: 'expired',
      error_message: error.message,
    });
    
    // Trigger webhook
    await triggerWebhook(connection.project_id, 'connection.expired', {
      connectionId,
      provider: connection.provider_id,
      userId: connection.end_user_id,
    });
    
    throw new ConnectionExpiredError();
  }
}
```

---

## Flow 6: Webhook Delivery

```
Link API                    Webhook Queue                Developer Backend
    │                            │                            │
    │ Event occurred             │                            │
    │ (connection.created)       │                            │
    │                            │                            │
    │ Queue webhook              │                            │
    │───────────────────────────►│                            │
    │                            │                            │
    │                            │ Build payload              │
    │                            │ Sign with secret           │
    │                            │                            │
    │                            │ POST to webhook URL        │
    │                            │───────────────────────────►│
    │                            │                            │
    │                            │                            │ Verify signature
    │                            │                            │ Process event
    │                            │                            │
    │                            │ 200 OK                     │
    │                            │◄───────────────────────────│
    │                            │                            │
    │                            │ Mark delivered             │
    │                            │                            │
```

### Webhook Payload

```typescript
// Headers
{
  'Content-Type': 'application/json',
  'X-Link-Signature': 'sha256=xxxxx',
  'X-Link-Timestamp': '1705312800',
  'X-Link-Event': 'connection.created',
}

// Body
{
  "id": "evt_xxxxx",
  "type": "connection.created",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "connectionId": "conn_xxxxx",
    "provider": "gmail",
    "userId": "user_123",
    "scopes": ["email.read", "email.send"]
  }
}

// Signature verification (developer side)
function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature)
  );
}
```

---

## State Diagram: Connection Status

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ OAuth completed
                           ▼
                    ┌─────────────┐
      ┌────────────►│   active    │◄────────────┐
      │             └──────┬──────┘             │
      │                    │                    │
      │ Token refreshed    │ Token expired/     │ User reconnects
      │ successfully       │ refresh failed    │
      │                    ▼                    │
      │             ┌─────────────┐             │
      └─────────────│   expired   │─────────────┘
                    └──────┬──────┘
                           │
                           │ User revokes
                           │ OR developer deletes
                           ▼
                    ┌─────────────┐
                    │   revoked   │
                    └─────────────┘
```
