# Link Implementation Plan

> Phase-by-phase development guide for the Link team.

**Team Structure:**
- **Backend Dev 1 (BD1)**: Core infrastructure, OAuth, token management
- **Backend Dev 2 (BD2)**: Database, providers, adapters
- **Frontend Dev (FE)**: Dashboard UI, developer experience

---

## Table of Contents

1. [Phase 1: Foundation](#phase-1-foundation)
2. [Phase 2: OAuth Flow](#phase-2-oauth-flow)
3. [Phase 3: Gmail Provider](#phase-3-gmail-provider)
4. [Phase 4: Google Suite](#phase-4-google-suite)
5. [Phase 5: Linear Integration](#phase-5-linear-integration)
6. [Phase 6: SDK Development](#phase-6-sdk-development)
7. [Phase 7: Production Polish](#phase-7-production-polish)

---

# Phase 1: Foundation

> **Goal**: Working Express server with auth, project CRUD, and API key generation.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 1 OUTCOME                          │
├─────────────────────────────────────────────────────────────────┤
│  Developer → Signup → Create Project → Generate API Keys        │
│  Tables: platform_users, projects, project_api_keys, providers  │
└─────────────────────────────────────────────────────────────────┘
```

---

## BD1 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 1.1 | Express + TypeScript Setup | `src/server.ts`, `src/app.ts` |
| 1.2 | Config Layer | `src/config/index.ts`, `env.ts`, `supabase.ts` |
| 1.3 | Utils Layer | `src/utils/errors.ts`, `response.ts`, `logger.ts` |
| 1.4 | Middlewares | `src/middlewares/index.ts`, `error-handler.ts`, `request-logger.ts`, `authenticate.ts` |
| 1.5 | Auth Module | `src/modules/auth/auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`, `auth.types.ts` |
| 1.6 | TypeScript Types | `src/types/index.ts`, `express.d.ts` |

### BD1 Tests
- **Task 1.1**: Health endpoint responds with status ok
- **Task 1.4**: Invalid routes return formatted NOT_FOUND error; protected routes without token return UNAUTHORIZED
- **Task 1.5**: Signup creates user and returns tokens; signin with valid credentials returns JWT; `/me` with valid token returns user info

### BD1 Checklist
- [ ] Express server starts on port 3000
- [ ] Health endpoint returns `{ status: 'ok' }`
- [ ] Config validates environment variables
- [ ] Error handler formats errors correctly
- [ ] `/v1/auth/signup` creates user
- [ ] `/v1/auth/signin` returns JWT
- [ ] `/v1/auth/me` returns current user

---

## BD2 Tasks

| # | Task | Files to Create / SQL to Run |
|---|------|------------------------------|
| 2.1 | Supabase Setup | Create project, get credentials, share with BD1 |
| 2.2 | Database Schema | Run SQL: `platform_users`, `projects`, `project_api_keys`, `providers` tables |
| 2.3 | Seed Providers | Run SQL: Insert 6 providers (Gmail, Calendar, Drive, Docs, Sheets, Linear) |
| 2.4 | Projects Module | `src/modules/projects/projects.controller.ts`, `projects.service.ts`, `projects.routes.ts`, `projects.types.ts` |
| 2.5 | API Keys Module | `src/modules/api-keys/api-keys.controller.ts`, `api-keys.service.ts`, `api-keys.routes.ts`, `api-keys.types.ts` |
| 2.6 | Provider Base | `src/modules/providers/index.ts`, `base.adapter.ts` |

### BD2 SQL - Task 2.2: Database Schema
```sql
-- PLATFORM USERS
CREATE TABLE platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_platform_users_email ON platform_users(email);

-- PROJECTS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  environment TEXT NOT NULL DEFAULT 'development',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- PROJECT API KEYS
CREATE TABLE project_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  public_key TEXT UNIQUE NOT NULL,
  secret_key_hash TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_project_id ON project_api_keys(project_id);
CREATE INDEX idx_api_keys_public_key ON project_api_keys(public_key);

-- PROVIDERS
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  icon_url TEXT,
  category TEXT,
  auth_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  default_scopes TEXT[] DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_providers_name ON providers(name);

-- TRIGGER: Sync auth.users → platform_users
CREATE OR REPLACE FUNCTION sync_platform_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO platform_users (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_platform_user();
```

### BD2 SQL - Task 2.3: Seed Providers
```sql
INSERT INTO providers (name, display_name, category, auth_url, token_url, scopes, default_scopes) VALUES
('gmail', 'Gmail', 'email', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'], ARRAY['https://www.googleapis.com/auth/gmail.readonly']),
('google_calendar', 'Google Calendar', 'calendar', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'], ARRAY['https://www.googleapis.com/auth/calendar.readonly']),
('google_drive', 'Google Drive', 'storage', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'], ARRAY['https://www.googleapis.com/auth/drive.readonly']),
('google_docs', 'Google Docs', 'productivity', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/documents'], ARRAY['https://www.googleapis.com/auth/documents.readonly']),
('google_sheets', 'Google Sheets', 'productivity', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets'], ARRAY['https://www.googleapis.com/auth/spreadsheets.readonly']),
('linear', 'Linear', 'project_management', 'https://linear.app/oauth/authorize', 'https://api.linear.app/oauth/token', ARRAY['read', 'write', 'issues:create'], ARRAY['read']);
```

### BD2 Tests
- **Task 2.2**: Query public tables and confirm all 4 exist (platform_users, projects, project_api_keys, providers)
- **Task 2.3**: Query providers table and confirm 6 providers are seeded
- **Task 2.4**: Create a project with auth token; list projects returns the created project
- **Task 2.5**: Generate API key for a project; verify public key returned and secret key shown once

### BD2 Checklist
- [ ] Supabase project created
- [ ] 4 tables exist: platform_users, projects, project_api_keys, providers
- [ ] Trigger syncs auth.users → platform_users
- [ ] 6 providers seeded
- [ ] `/v1/projects` CRUD works
- [ ] `/v1/projects/:id/keys` generates keys
- [ ] Provider base structure exists

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Next.js Setup | Initialize with TypeScript, Tailwind, Supabase SSR |
| 3.2 | Auth Pages | `/login`, `/signup` pages |
| 3.3 | Dashboard Page | `/dashboard` - list of projects |
| 3.4 | Project Page | `/dashboard/[id]` - project details + API keys |
| 3.5 | Components | AuthForm, ProjectCard, ProjectList, CreateProjectModal, ApiKeyTable, GenerateKeyModal |

### FE Checklist
- [ ] Login/signup pages work
- [ ] Dashboard shows project list
- [ ] Can create new project
- [ ] Project detail shows API keys
- [ ] Can generate new API key
- [ ] Can copy/revoke keys

---

## Phase 1 Integration Test

Verify the full developer onboarding flow works end-to-end:
1. Sign up a new user and receive JWT token
2. Sign in with created credentials
3. Create a new project using the auth token
4. Generate an API key pair for that project
5. Verify the public key is returned and secret key is shown only once
6. Confirm all data persists correctly in Supabase tables

---

# Phase 2: OAuth Flow

> **Goal**: Complete OAuth flow for connecting end users to providers.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 2 OUTCOME                          │
├─────────────────────────────────────────────────────────────────┤
│  End User → Click Connect → Google OAuth → Tokens Stored        │
│  New Tables: end_users, provider_connections, oauth_states      │
└─────────────────────────────────────────────────────────────────┘
```

---

## BD1 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 1.1 | SDK Auth Middlewares | `src/middlewares/verify-api-key.ts`, `verify-signature.ts` |
| 1.2 | Token Manager | `src/core/token-manager/token-manager.ts`, `encryption.ts`, `types.ts` |
| 1.3 | OAuth Module | `src/modules/oauth/oauth.controller.ts`, `oauth.service.ts`, `oauth.routes.ts`, `oauth.types.ts` |

### BD1 Tests
- **Task 1.1**: Request without API key returns INVALID_API_KEY error; request with valid key proceeds
- **Task 1.3**: OAuth connect returns authorization URL with state parameter; URL redirects to Google consent

### BD1 Checklist
- [ ] `verify-api-key` middleware works
- [ ] `verify-signature` middleware works
- [ ] Token encryption/decryption works
- [ ] Token refresh logic implemented
- [ ] `/v1/oauth/connect` returns authorization URL
- [ ] `/v1/oauth/callback` exchanges code for tokens
- [ ] Tokens stored encrypted in database

---

## BD2 Tasks

| # | Task | Files to Create / SQL to Run |
|---|------|------------------------------|
| 2.1 | OAuth Tables | Run SQL: `end_users`, `oauth_states`, `provider_connections` tables |
| 2.2 | Connections Module | `src/modules/connections/connections.controller.ts`, `connections.service.ts`, `connections.routes.ts`, `connections.types.ts` |
| 2.3 | Google OAuth Setup | Configure OAuth app in Google Cloud Console |

### BD2 SQL - Task 2.1: OAuth Tables
```sql
-- END USERS
CREATE TABLE end_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, external_user_id)
);
CREATE INDEX idx_end_users_project ON end_users(project_id);

-- OAUTH STATES
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  end_user_id UUID REFERENCES end_users(id) ON DELETE CASCADE,
  state_token TEXT UNIQUE NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  code_verifier TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_oauth_states_token ON oauth_states(state_token);

-- PROVIDER CONNECTIONS
CREATE TABLE provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  provider_user_id TEXT,
  provider_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(project_id, provider_id, end_user_id)
);
CREATE INDEX idx_connections_project ON provider_connections(project_id);
CREATE INDEX idx_connections_status ON provider_connections(status);
```

### BD2 Tests
- **Task 2.1**: Query database and confirm 3 new tables exist (end_users, oauth_states, provider_connections)
- **Task 2.2**: List connections returns array (empty or with data); delete connection removes it from list

### BD2 Checklist
- [ ] 3 new tables: end_users, oauth_states, provider_connections
- [ ] Connections module CRUD works
- [ ] Google Cloud Console OAuth app configured

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Connect Button | "Connect Provider" button with provider dropdown |
| 3.2 | Callback Page | Handle OAuth callback with connection_id |
| 3.3 | Connected Accounts | Display list of connected accounts |

### FE Checklist
- [ ] Connect button triggers OAuth flow
- [ ] Callback page handles redirect
- [ ] Connected accounts displayed

---

## Phase 2 Integration Test

Verify the complete OAuth connection flow works end-to-end:
1. Call `/oauth/connect` with a valid public key and receive an authorization URL
2. Visit the authorization URL in browser and complete Google OAuth consent
3. Get redirected back to the callback URL with authorization code
4. Verify callback exchanges code for tokens and stores them encrypted
5. Confirm a new connection appears in the `/connections` list
6. Verify end_user record was created with correct external_user_id

---

# Phase 3: Gmail Provider

> **Goal**: Working Gmail integration with fetch, send, delete.

---

## BD1 Tasks

| # | Task | What to Do |
|---|------|------------|
| 1.1 | Token Refresh | Ensure token refresh works for Gmail connections |
| 1.2 | API Logging | Add logging for provider API calls |

### BD1 Checklist
- [ ] Token refresh works for Gmail
- [ ] API logging implemented

---

## BD2 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 2.1 | Gmail Adapter | `src/modules/providers/gmail/gmail.adapter.ts` |
| 2.2 | Gmail Controller | `src/modules/providers/gmail/gmail.controller.ts` |
| 2.3 | Gmail Routes | `src/modules/providers/gmail/gmail.routes.ts` |
| 2.4 | Gmail Normalizer | `src/modules/providers/gmail/gmail.normalizer.ts` |
| 2.5 | Gmail Types | `src/modules/providers/gmail/gmail.types.ts` |
| 2.6 | Register Adapter | Update `src/modules/providers/index.ts` |

**Adapter Methods:**
- `fetch`: messages, message, labels, profile
- `create`: send email
- `update`: modify labels
- `delete`: trash/delete message

### BD2 Tests
- **Fetch**: Retrieve messages list with valid connection; fetch single message by ID; get labels and profile
- **Send**: Send email to test address and verify it appears in sent folder
- **Update**: Modify message labels (add/remove)
- **Delete**: Trash a message and verify it moves to trash

### BD2 Checklist
- [ ] Gmail adapter implements fetch (messages, message, labels, profile)
- [ ] Gmail adapter implements create (send email)
- [ ] Gmail adapter implements update (modify labels)
- [ ] Gmail adapter implements delete (trash/delete)
- [ ] Gmail normalizer transforms responses
- [ ] Adapter registered in provider registry

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Test UI | Simple UI to test Gmail fetch/send |

### FE Checklist
- [ ] Can view fetched Gmail messages
- [ ] Can send test email

---

# Phase 4: Google Suite

> **Goal**: Calendar, Drive, Docs, Sheets all working.

---

## BD1 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 1.1 | Google Calendar Adapter | `src/modules/providers/google-calendar/calendar.adapter.ts`, `calendar.controller.ts`, `calendar.routes.ts`, `calendar.normalizer.ts`, `calendar.types.ts` |
| 1.2 | Google Docs Adapter | `src/modules/providers/google-docs/docs.adapter.ts`, `docs.controller.ts`, `docs.routes.ts`, `docs.normalizer.ts`, `docs.types.ts` |

**Calendar Methods:**
- `fetch`: calendars, events, event
- `create`: event
- `update`: event
- `delete`: event

**Docs Methods:**
- `fetch`: documents, document
- `create`: document
- `update`: document content

### BD1 Checklist
- [ ] Calendar: fetch calendars/events, create/update/delete events
- [ ] Docs: fetch documents, create document, update content

---

## BD2 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 2.1 | Google Drive Adapter | `src/modules/providers/google-drive/drive.adapter.ts`, `drive.controller.ts`, `drive.routes.ts`, `drive.normalizer.ts`, `drive.types.ts` |
| 2.2 | Google Sheets Adapter | `src/modules/providers/google-sheets/sheets.adapter.ts`, `sheets.controller.ts`, `sheets.routes.ts`, `sheets.normalizer.ts`, `sheets.types.ts` |

**Drive Methods:**
- `fetch`: files, file, folders
- `create`: file, folder
- `delete`: file

**Sheets Methods:**
- `fetch`: spreadsheets, spreadsheet, values
- `create`: spreadsheet
- `update`: values

### BD2 Checklist
- [ ] Drive: fetch files, upload file, delete file
- [ ] Sheets: fetch spreadsheets, read/write values

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Provider UI | UI to test each provider's functionality |

### FE Checklist
- [ ] Calendar events display
- [ ] Drive files display
- [ ] Docs list display
- [ ] Sheets data display

---

# Phase 5: Linear Integration

> **Goal**: Working Linear integration for issues and projects.

---

## BD1 Tasks

| # | Task | What to Do |
|---|------|------------|
| 1.1 | Support BD2 | Help test Linear adapter |

---

## BD2 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 2.1 | Linear OAuth Setup | Configure OAuth app in Linear |
| 2.2 | Linear Adapter | `src/modules/providers/linear/linear.adapter.ts` (uses GraphQL) |
| 2.3 | Linear Controller | `src/modules/providers/linear/linear.controller.ts` |
| 2.4 | Linear Routes | `src/modules/providers/linear/linear.routes.ts` |
| 2.5 | Linear Normalizer | `src/modules/providers/linear/linear.normalizer.ts` |
| 2.6 | Linear Types | `src/modules/providers/linear/linear.types.ts` |

**Linear Methods:**
- `fetch`: issues, issue, projects, teams
- `create`: issue
- `update`: issue
- `delete`: issue

### BD2 Checklist
- [ ] Linear OAuth configured
- [ ] Linear adapter implements CRUD for issues
- [ ] GraphQL queries working

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Linear UI | UI to display Linear issues |

### FE Checklist
- [ ] Linear issues display
- [ ] Can create issue from UI

---

# Phase 6: SDK Development

> **Goal**: Create @link/sdk npm package.

---

## BD1 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 1.1 | SDK Package Setup | `packages/sdk/package.json`, `tsconfig.json` |
| 1.2 | Link Client | `packages/sdk/src/index.ts`, `client.ts` |
| 1.3 | Provider Modules | `packages/sdk/src/providers/gmail.ts`, `calendar.ts`, `drive.ts`, `docs.ts`, `sheets.ts`, `linear.ts` |
| 1.4 | Types | `packages/sdk/src/types/index.ts` |
| 1.5 | HMAC Signing | Implement request signing in client |
| 1.6 | Documentation | `packages/sdk/README.md` |

**SDK Structure:**
```
packages/sdk/
├── src/
│   ├── index.ts           # Link class export
│   ├── client.ts          # HTTP client with HMAC signing
│   ├── providers/
│   │   ├── gmail.ts
│   │   ├── calendar.ts
│   │   ├── drive.ts
│   │   ├── docs.ts
│   │   ├── sheets.ts
│   │   └── linear.ts
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### BD1 Checklist
- [ ] SDK package structure created
- [ ] HMAC signing implemented
- [ ] All provider methods work
- [ ] TypeScript types exported
- [ ] Published to npm (or private registry)

---

## BD2 Tasks

| # | Task | What to Do |
|---|------|------------|
| 2.1 | SDK Testing | Test SDK against all providers |
| 2.2 | Edge Cases | Test error handling, token refresh via SDK |

### BD2 Checklist
- [ ] All SDK methods tested
- [ ] Error handling verified

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | SDK Docs Page | Documentation for SDK usage |

### FE Checklist
- [ ] SDK documentation page live

---

# Phase 7: Production Polish

> **Goal**: Webhooks, rate limiting, metrics, logging.

---

## BD1 Tasks

| # | Task | Files to Create |
|---|------|-----------------|
| 1.1 | Webhook Dispatcher | `src/core/webhook-dispatcher/dispatcher.ts`, `queue.ts`, `types.ts` |
| 1.2 | Rate Limiter | `src/middlewares/rate-limiter.ts` |

**Webhook Events:** connection.created, connection.expired, connection.error

### BD1 Checklist
- [ ] Webhooks dispatch on events
- [ ] Rate limiting per project
- [ ] Rate limit headers in responses

---

## BD2 Tasks

| # | Task | Files to Create / SQL to Run |
|---|------|------------------------------|
| 2.1 | API Logs Table | Run SQL for `api_logs` table |
| 2.2 | Usage Metrics Table | Run SQL for `usage_metrics` table |
| 2.3 | Logging Service | `src/core/logging/api-logger.ts` |
| 2.4 | Metrics Service | `src/core/metrics/usage-tracker.ts` |

### BD2 SQL - Task 2.1: API Logs
```sql
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  provider_id UUID,
  connection_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_api_logs_project ON api_logs(project_id);
CREATE INDEX idx_api_logs_created ON api_logs(created_at);
```

### BD2 SQL - Task 2.2: Usage Metrics
```sql
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  provider_id UUID,
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL,
  requests_count INTEGER DEFAULT 0,
  UNIQUE(project_id, provider_id, period_start, period_type)
);
CREATE INDEX idx_usage_project ON usage_metrics(project_id);
```

### BD2 Checklist
- [ ] API logs table created
- [ ] All requests logged
- [ ] Usage metrics aggregated

---

## FE Tasks

| # | Task | What to Build |
|---|------|---------------|
| 3.1 | Logs Viewer | Page to view API request logs |
| 3.2 | Usage Dashboard | Charts showing usage metrics |
| 3.3 | Webhook Management | UI to create/edit/delete webhooks |

### FE Checklist
- [ ] Logs page works
- [ ] Usage dashboard works
- [ ] Webhook management works

---

# Summary

| Phase | BD1 Tasks | BD2 Tasks | FE Tasks |
|-------|-----------|-----------|----------|
| 1 | 6 tasks: Express, Config, Utils, Middlewares, Auth, Types | 6 tasks: Supabase, Schema, Seed, Projects, API Keys, Provider Base | 5 tasks: Setup, Auth Pages, Dashboard, Project Page, Components |
| 2 | 3 tasks: SDK Middlewares, Token Manager, OAuth Module | 3 tasks: OAuth Tables, Connections Module, Google Setup | 3 tasks: Connect Button, Callback, Connected List |
| 3 | 2 tasks: Token Refresh, Logging | 6 tasks: Gmail Adapter, Controller, Routes, Normalizer, Types, Register | 1 task: Test UI |
| 4 | 2 tasks: Calendar Adapter, Docs Adapter | 2 tasks: Drive Adapter, Sheets Adapter | 1 task: Provider UI |
| 5 | 1 task: Support | 6 tasks: Linear OAuth, Adapter, Controller, Routes, Normalizer, Types | 1 task: Linear UI |
| 6 | 6 tasks: Package, Client, Providers, Types, Signing, Docs | 2 tasks: Testing, Edge Cases | 1 task: Docs Page |
| 7 | 2 tasks: Webhooks, Rate Limiter | 4 tasks: Logs Table, Metrics Table, Logging Service, Metrics Service | 3 tasks: Logs, Usage, Webhooks |

---

# Testing Guidelines

## For Each Phase
1. Complete all tasks
2. Run tests as described in each section
3. Check all checkboxes
4. Verify integration test criteria
5. Cross-verify with other devs

## Test Types
- **Unit Tests**: Test services in isolation, mock Supabase
- **Integration Tests**: Test API endpoints with real DB
- **E2E Tests**: Full flow from SDK → Backend → Provider
