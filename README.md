# Link

**Unified Integration Infrastructure Platform**

> Developers integrate 1 SDK instead of 50 APIs.

Link abstracts OAuth, token management, and third-party APIs into a single normalized SDK and API layer. Think of it as:

- **Stripe** → payments
- **Clerk** → auth
- **Supabase** → backend
- **Link** → integrations

---

## 🎯 Core Value Proposition

Link is an **OAuth broker, token manager, and API abstraction engine** that allows developers to connect their users to third-party services (Gmail, Google Calendar, Notion, Slack, Linear, etc.) through a single, unified interface.

Instead of implementing 50 different OAuth flows and learning 50 different APIs, developers integrate one SDK.

---

## 🏗️ Architecture Overview

```
                ┌───────────────────────┐
                │   Developer Dashboard │
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

### System Layers

1. **Developer Dashboard** (Frontend) - Project management, API keys, analytics
2. **SDK** (Client Library) - Stripe-style developer experience
3. **Core API Backend** (Node + TypeScript) - OAuth, token management, API routing
4. **Integration Engine** (Providers) - Normalized adapters for each service
5. **Supabase** (DB + Auth + Storage) - Data persistence and platform auth

---

## 👥 System Actors

| Actor | Description |
|-------|-------------|
| **Platform Developer** | Your customer - developers using Link |
| **Developer Project** | Their application that integrates Link |
| **End User** | Users of the developer's application |
| **Provider** | Third-party services (Google, Notion, Slack, etc.) |

---

## 🔐 Authentication Layers

Link has **3 distinct authentication layers**:

| Layer | Purpose | Credentials |
|-------|---------|-------------|
| **Platform Auth** | Developers logging into Link dashboard | Supabase Auth (email/password) |
| **Project Auth** | Developer apps calling Link API | `public_key` + `secret_key` |
| **End User OAuth** | End users connecting Gmail/Notion/etc. | `access_token` + `refresh_token` |

---

## 🚀 Quick Example

### SDK Installation

```bash
npm install @link/sdk
```

### SDK Usage

```typescript
import { Link } from "@link/sdk";

// Initialize with project keys
const link = new Link({
  publicKey: "pk_live_xxxxx",
  secretKey: "sk_live_xxxxx"
});

// Connect an end user to Gmail
await link.connect("gmail", {
  userId: "user_abc",
  redirectUrl: "https://yourapp.com/callback"
});

// Fetch Gmail messages
const messages = await link.gmail.fetch({ 
  connectionId: "conn_123",
  type: "messages" 
});

// Create a calendar event
await link.calendar.create({
  connectionId: "conn_456",
  title: "Team Meeting",
  startTime: "2024-01-15T10:00:00Z"
});
```

---

## 📚 Documentation

Detailed documentation is organized in the `/context` folder:

> **🚀 Quick Start**: Read [INDEX.md](./context/INDEX.md) first for a complete overview.

| Document | Description |
|----------|-------------|
| [Index](./context/INDEX.md) | **Start here** - Quick reference and navigation |
| [Architecture](./context/ARCHITECTURE.md) | System design and component diagrams |
| [Database Schema](./context/DATABASE.md) | Complete Supabase schema |
| [API Reference](./context/API.md) | Endpoint design and specifications |
| [SDK Guide](./context/SDK.md) | SDK architecture and usage |
| [OAuth Flows](./context/FLOWS.md) | Complete authentication flows |
| [Security](./context/SECURITY.md) | Security model and best practices |
| [Providers](./context/PROVIDERS.md) | Provider adapter pattern and scalability |
| [Backend Structure](./context/BACKEND_STRUCTURE.md) | Codebase organization |

---

## 🗂️ Repository Structure

```
link-mono/
├── apps/
│   ├── backend/          # Core API (Node + TypeScript)
│   └── frontend/         # Developer Dashboard (Next.js)
├── packages/
│   └── sdk/              # Client SDK (@link/sdk)
├── context/              # Documentation and specifications
└── README.md
```

---

## 🛠️ Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Next.js, React, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (platform), Custom OAuth (providers)
- **SDK**: TypeScript, published to npm

---

## 📄 License

Proprietary - All rights reserved.
