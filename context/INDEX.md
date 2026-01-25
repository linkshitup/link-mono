# Link - Context Index

> Quick reference for LLMs and developers to understand the Link codebase.

---

## What is Link?

**Link** is a unified integration infrastructure platform that abstracts OAuth, token management, and third-party APIs into a single normalized SDK and API layer.

**Value Proposition**: Developers integrate 1 SDK instead of 50 APIs.

**Comparable to**:
- Stripe → payments
- Clerk → auth  
- Supabase → backend
- **Link → integrations**

---

## Quick Navigation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README](../README.md) | Project overview | First read |
| [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md) | **Phase-by-phase dev guide** | **Start building** |
| [ARCHITECTURE](./ARCHITECTURE.md) | System design, layers, components | Understanding structure |
| [DATABASE](./DATABASE.md) | Supabase schema, tables, relationships | Database work |
| [API](./API.md) | Endpoints, request/response formats | API development |
| [SDK](./SDK.md) | Client SDK architecture, usage | SDK development |
| [FLOWS](./FLOWS.md) | Auth flows, OAuth sequences, diagrams | Auth/OAuth work |
| [SECURITY](./SECURITY.md) | Encryption, HMAC, security model | Security implementation |
| [PROVIDERS](./PROVIDERS.md) | Provider adapter pattern, adding providers | Provider development |
| [BACKEND_STRUCTURE](./BACKEND_STRUCTURE.md) | Folder structure, module patterns | Backend development |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LINK PLATFORM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ Developer       │     │     @link/sdk   │ ◄── npm package   │
│  │ Dashboard       │     │                 │                   │
│  │ (Next.js)       │     │ link.gmail.     │                   │
│  └────────┬────────┘     │ fetch(...)      │                   │
│           │              └────────┬────────┘                   │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     CORE API                              │  │
│  │                  (Node + TypeScript)                      │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ Middleware  │  │  Modules    │  │ Provider Engine  │  │  │
│  │  │ - API Key   │  │ - Auth      │  │ - GmailAdapter   │  │  │
│  │  │ - Signature │  │ - OAuth     │  │ - CalendarAdapter│  │  │
│  │  │ - Rate Limit│  │ - Projects  │  │ - NotionAdapter  │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Token Manager + Normalizer             │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                       SUPABASE                            │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐    │  │
│  │  │   Auth   │  │   Database   │  │     Storage      │    │  │
│  │  │ Platform │  │ All tables   │  │ Provider assets  │    │  │
│  │  │ users    │  │              │  │                  │    │  │
│  │  └──────────┘  └──────────────┘  └──────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 4 System Actors

| Actor | Description | Example |
|-------|-------------|---------|
| **Platform Developer** | Your customer | Company building with Link |
| **Project** | Their application | Their SaaS product |
| **End User** | Their customer | Person using their app |
| **Provider** | Third-party service | Google, Notion, Slack |

### 3 Authentication Layers

| Layer | Who | Credentials | Table |
|-------|-----|-------------|-------|
| Platform Auth | Developer → Dashboard | Email/password | `platform_users` |
| Project Auth | App → Link API | `pk_` + `sk_` keys | `project_api_keys` |
| End User OAuth | User → Provider | `access_token` | `provider_connections` |

### 4 Standard Operations

All providers expose the same 4 operations:

```typescript
link.{provider}.fetch(...)   // Read data
link.{provider}.create(...)  // Create resources
link.{provider}.update(...)  // Modify resources
link.{provider}.delete(...)  // Remove resources
```

---

## Database Tables (Quick Reference)

| Table | Purpose |
|-------|---------|
| `platform_users` | Developers using Link dashboard |
| `projects` | Developer applications |
| `project_api_keys` | API keys (public + secret) |
| `providers` | Supported integrations config |
| `end_users` | Users of developer apps |
| `provider_connections` | OAuth tokens (encrypted) |
| `oauth_states` | Temporary OAuth state tokens |
| `api_logs` | Request logging |
| `usage_metrics` | Analytics + billing |
| `webhooks` | Event subscriptions |

---

## OAuth Flow (Simplified)

```
1. Developer creates project → gets pk_ + sk_ keys
2. Developer integrates SDK with keys
3. End user clicks "Connect Gmail"
4. SDK calls Link API with signed request
5. Link redirects user to Google OAuth
6. Google redirects back with auth code
7. Link exchanges code for tokens
8. Tokens encrypted and stored
9. User redirected to developer app with connection_id
10. Developer uses connection_id for API calls
```

---

## API Request Flow

```
Developer App
     │
     ▼
link.gmail.fetch({ connectionId, type: "messages" })
     │
     ▼
SDK signs request with HMAC
     │
     ▼
POST /v1/gmail/fetch
     │
     ▼
Link API:
  1. Verify API key
  2. Verify signature
  3. Get connection
  4. Refresh token if expired
  5. Call Gmail API
  6. Normalize response
     │
     ▼
Return normalized data
```

---

## File Structure

```
link-mono/
├── apps/
│   ├── backend/          # Core API (Node + TypeScript)
│   │   └── src/
│   │       ├── modules/  # Feature modules
│   │       ├── core/     # Shared services
│   │       └── middlewares/
│   └── frontend/         # Dashboard (Next.js)
├── packages/
│   └── sdk/              # Client SDK (@link/sdk)
├── context/              # This documentation
│   ├── INDEX.md          # You are here
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SDK.md
│   ├── FLOWS.md
│   ├── SECURITY.md
│   ├── PROVIDERS.md
│   └── BACKEND_STRUCTURE.md
└── README.md
```

---

## LLM Context Tips

### When Working On...

**OAuth Implementation**
→ Read: FLOWS.md, SECURITY.md (OAuth section), DATABASE.md (oauth_states, provider_connections)

**Adding a New Provider**
→ Read: PROVIDERS.md, BACKEND_STRUCTURE.md (modules/providers)

**API Endpoints**
→ Read: API.md, BACKEND_STRUCTURE.md (modules)

**SDK Changes**
→ Read: SDK.md, API.md (for endpoint specs)

**Security/Encryption**
→ Read: SECURITY.md, DATABASE.md (encryption strategy)

**Database Changes**
→ Read: DATABASE.md, ARCHITECTURE.md (data flow diagrams)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, TypeScript, Express |
| Frontend | Next.js, React, TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (platform), Custom OAuth (providers) |
| SDK | TypeScript, npm package |
| Security | HMAC-SHA256, AES-256-GCM |

---

## Status

| Component | Status |
|-----------|--------|
| Backend Structure | 🔄 In Progress |
| Database Schema | 📋 Designed |
| OAuth Flow | 📋 Designed |
| Gmail Provider | 📋 Designed |
| Calendar Provider | 📋 Designed |
| SDK | 📋 Designed |
| Dashboard | 📋 Designed |

---

## Master Prompt

For complete context, use this prompt with any LLM:

> We are building a developer platform that abstracts third-party integrations (Gmail, Google Calendar, Notion, Slack, Linear, etc.) into a unified SDK and API layer.
>
> The platform acts as an OAuth broker, token manager, and API abstraction engine.
>
> Core goal: Developers integrate a single SDK instead of dealing with OAuth flows, API differences, and token management for each provider.
>
> Key principle: Minimal endpoints with maximum abstraction - 4 operations (fetch, create, update, delete) across all providers.
