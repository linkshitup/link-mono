# Architecture

> System design and component overview for Link.

---

## High-Level Architecture

```
                ┌───────────────────────┐
                │   Developer Dashboard │
                │      (Next.js)        │
                └───────────┬───────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │     Core API        │
                  │ (Node + TypeScript) │
                  └──────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   Supabase DB          OAuth Providers        SDK Layer
 (users, tokens,        (Google, Notion,      (npm package)
  projects, logs)        Slack, etc.)
```

---

## System Layers

### 1. Developer Dashboard (Frontend)

**Purpose**: Web interface for developers to manage their Link integration.

**Responsibilities**:
- Platform authentication (login/signup)
- Project creation and management
- API key generation and rotation
- Connection monitoring and debugging
- Usage analytics and billing
- Provider configuration

**Tech**: Next.js, React, TypeScript, Tailwind CSS

---

### 2. SDK (Client Library)

**Purpose**: Stripe-style developer experience for integrating Link.

**Responsibilities**:
- Simplified API for connecting users to providers
- Request signing with HMAC
- Type-safe provider methods
- Error handling and retries

**Tech**: TypeScript, published as `@link/sdk`

**Example**:
```typescript
const link = new Link({ publicKey, secretKey });
await link.gmail.fetch({ connectionId, type: "messages" });
```

---

### 3. Core API Backend

**Purpose**: Central orchestration layer for all Link operations.

**Responsibilities**:
- API key validation and request verification
- OAuth flow orchestration
- Token management (refresh, encryption, storage)
- Provider API calls and response normalization
- Rate limiting and logging
- Webhook delivery

**Tech**: Node.js, TypeScript, Express

---

### 4. Integration Engine (Providers)

**Purpose**: Abstraction layer for third-party service APIs.

**Responsibilities**:
- Provider-specific adapters (Gmail, Calendar, Notion, etc.)
- OAuth configuration per provider
- API normalization to unified schema
- Error translation

**Pattern**: Adapter pattern with common interface

```typescript
interface ProviderAdapter {
  fetch(params: FetchParams): Promise<NormalizedResponse>;
  create(params: CreateParams): Promise<NormalizedResponse>;
  update(params: UpdateParams): Promise<NormalizedResponse>;
  delete(params: DeleteParams): Promise<NormalizedResponse>;
}
```

---

### 5. Supabase (Database Layer)

**Purpose**: Persistent storage and platform authentication.

**Responsibilities**:
- Platform user authentication
- Project and API key storage
- OAuth token storage (encrypted)
- Connection metadata
- API logs and usage metrics
- Webhook configurations

**Tech**: Supabase (PostgreSQL + Auth + Storage)

---

## Data Flow Diagrams

### Developer Setup Flow

```
Developer
   │
   ▼
Link Dashboard (login/signup)
   │
   ▼
Create Project
   │
   ▼
System generates public_key + secret_key
   │
   ▼
Stored in Supabase (project_api_keys)
   │
   ▼
Developer integrates SDK with keys
```

### End User OAuth Flow

```
End User clicks "Connect Gmail"
   │
   ▼
Developer App calls link.connect("gmail", { userId, redirectUrl })
   │
   ▼
SDK sends signed request to Link API
   │
   ▼
Link API validates keys, creates OAuth state
   │
   ▼
User redirected to Google OAuth consent
   │
   ▼
Google redirects to Link callback with auth code
   │
   ▼
Link exchanges code for tokens
   │
   ▼
Tokens encrypted and stored in Supabase
   │
   ▼
User redirected to developer app with connection_id
```

### API Execution Flow

```
Developer calls link.gmail.fetch({ connectionId, type: "messages" })
   │
   ▼
SDK signs request and sends to Link API
   │
   ▼
Link API validates signature and identifies connection
   │
   ▼
Token Manager refreshes token if expired
   │
   ▼
GmailAdapter calls Gmail API
   │
   ▼
Response normalized to unified schema
   │
   ▼
Normalized data returned to developer app
```

---

## Component Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer App                            │
│                                                                 │
│  ┌─────────────┐                                                │
│  │  @link/sdk  │                                                │
│  └──────┬──────┘                                                │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTPS (signed requests)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Link Core API                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Middleware  │  │   Modules    │  │  Integration Engine  │  │
│  │              │  │              │  │                      │  │
│  │ - API Key    │  │ - Auth       │  │ - GmailAdapter       │  │
│  │ - Signature  │  │ - Projects   │  │ - CalendarAdapter    │  │
│  │ - Rate Limit │  │ - OAuth      │  │ - NotionAdapter      │  │
│  │ - Logging    │  │ - Providers  │  │ - SlackAdapter       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Core Services                          │  │
│  │  - Token Manager  - Normalizer  - Command Router          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Auth       │  │   Database   │  │      Storage         │  │
│  │              │  │              │  │                      │  │
│  │ Platform     │  │ All tables   │  │ Provider assets      │  │
│  │ users        │  │ (see schema) │  │ Logs archive         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

### Provider Adapter Pattern

To scale to 100+ integrations, use a consistent adapter interface:

```typescript
// Common interface for all providers
interface ProviderAdapter {
  name: string;
  
  // Standard CRUD operations
  fetch(connection: Connection, params: any): Promise<NormalizedResponse>;
  create(connection: Connection, params: any): Promise<NormalizedResponse>;
  update(connection: Connection, params: any): Promise<NormalizedResponse>;
  delete(connection: Connection, params: any): Promise<NormalizedResponse>;
  
  // OAuth configuration
  getAuthUrl(scopes: string[]): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
}
```

### Command Router

Generic execution layer that routes to the appropriate adapter:

```typescript
async function execute(
  provider: string,
  action: string,
  connectionId: string,
  payload: any
): Promise<NormalizedResponse> {
  const adapter = getAdapter(provider);
  const connection = await getConnection(connectionId);
  const tokens = await refreshIfNeeded(connection);
  
  return adapter[action](connection, payload);
}
```

### Normalization Layer

All provider responses are transformed to a unified schema:

```typescript
// Raw Gmail API response → Unified Message schema
interface NormalizedMessage {
  id: string;
  provider: "gmail" | "outlook" | "other";
  subject: string;
  body: string;
  from: Contact;
  to: Contact[];
  timestamp: string;
  raw?: any; // Original response if needed
}
```

---

## Security Architecture

See [SECURITY.md](./SECURITY.md) for detailed security model.

**Key Points**:
- HMAC request signing
- AES-256 token encryption
- OAuth state validation
- Rate limiting per project
- API key rotation support
