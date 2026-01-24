# Database Schema

> Complete Supabase PostgreSQL schema for Link.

---

## Overview

Link uses Supabase (PostgreSQL) for all persistent storage. The schema is designed to support:

- Multi-tenant architecture (multiple developers, multiple projects)
- Secure OAuth token storage
- Comprehensive logging and analytics
- Billing and usage tracking

---

## Entity Relationship Diagram

```
platform_users
     │
     │ 1:N
     ▼
  projects ──────────────────┐
     │                       │
     │ 1:N                   │ 1:N
     ▼                       ▼
project_api_keys         end_users
                             │
                             │ 1:N
                             ▼
providers ◄────────── provider_connections
     │                       │
     │                       │ 1:N
     │                       ▼
     │                   api_logs
     │
     └──────────────► oauth_states

projects ──► usage_metrics
projects ──► webhooks
```

---

## Tables

### 1. `platform_users`

**Purpose**: Developers who use the Link dashboard.

```sql
CREATE TABLE platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_platform_users_email ON platform_users(email);
```

**Notes**:
- Synced with Supabase Auth
- `id` matches Supabase Auth user ID

---

### 2. `projects`

**Purpose**: Developer applications that integrate Link.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  environment TEXT NOT NULL DEFAULT 'development', -- 'development' | 'production'
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_environment ON projects(environment);
```

**Settings JSONB structure**:
```json
{
  "allowedOrigins": ["https://example.com"],
  "webhookRetries": 3,
  "defaultScopes": {}
}
```

---

### 3. `project_api_keys`

**Purpose**: API keys for authenticating SDK calls.

```sql
CREATE TABLE project_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  public_key TEXT UNIQUE NOT NULL,        -- pk_live_xxxx or pk_test_xxxx
  secret_key_hash TEXT NOT NULL,           -- Hashed, never stored plain
  environment TEXT NOT NULL,               -- 'test' | 'live'
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'revoked'
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_api_keys_project_id ON project_api_keys(project_id);
CREATE UNIQUE INDEX idx_api_keys_public_key ON project_api_keys(public_key);
CREATE INDEX idx_api_keys_status ON project_api_keys(status);
```

**Key Format**:
- Public: `pk_live_` or `pk_test_` + 24 random chars
- Secret: `sk_live_` or `sk_test_` + 32 random chars

---

### 4. `providers`

**Purpose**: Supported third-party integrations and their OAuth configs.

```sql
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,               -- 'gmail', 'google_calendar', 'notion'
  display_name TEXT NOT NULL,              -- 'Gmail', 'Google Calendar', 'Notion'
  icon_url TEXT,
  category TEXT,                           -- 'email', 'calendar', 'productivity'
  oauth_client_id TEXT,
  oauth_client_secret TEXT,                -- Encrypted
  auth_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  default_scopes TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_providers_name ON providers(name);
CREATE INDEX idx_providers_category ON providers(category);
CREATE INDEX idx_providers_enabled ON providers(is_enabled);
```

**Example Row**:
```json
{
  "name": "gmail",
  "display_name": "Gmail",
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
  "token_url": "https://oauth2.googleapis.com/token",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify"
  ]
}
```

---

### 5. `end_users`

**Purpose**: Users of developer applications.

```sql
CREATE TABLE end_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,          -- Developer's user ID
  email TEXT,
  name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, external_user_id)
);

-- Indexes
CREATE INDEX idx_end_users_project_id ON end_users(project_id);
CREATE INDEX idx_end_users_external_id ON end_users(project_id, external_user_id);
```

---

### 6. `provider_connections` ⭐ (Core Table)

**Purpose**: OAuth tokens and connection state for each end user + provider.

```sql
CREATE TABLE provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  
  -- Provider-side identifiers
  provider_user_id TEXT,                   -- User ID from provider (e.g., Gmail user ID)
  provider_email TEXT,                     -- Email from provider
  
  -- Tokens (ENCRYPTED)
  access_token TEXT NOT NULL,              -- AES-256 encrypted
  refresh_token TEXT,                      -- AES-256 encrypted
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Scopes granted
  scopes TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'expired' | 'revoked' | 'error'
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(project_id, provider_id, end_user_id)
);

-- Indexes
CREATE INDEX idx_connections_project_id ON provider_connections(project_id);
CREATE INDEX idx_connections_end_user_id ON provider_connections(end_user_id);
CREATE INDEX idx_connections_provider_id ON provider_connections(provider_id);
CREATE INDEX idx_connections_status ON provider_connections(status);
CREATE INDEX idx_connections_expires_at ON provider_connections(expires_at);
```

**Connection ID Format**: `conn_` + UUID (e.g., `conn_a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

### 7. `oauth_states`

**Purpose**: Temporary state tracking for OAuth flows (CSRF protection).

```sql
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  end_user_id UUID REFERENCES end_users(id) ON DELETE CASCADE,
  
  state_token TEXT UNIQUE NOT NULL,        -- Random token for OAuth state
  redirect_uri TEXT NOT NULL,              -- Where to redirect after OAuth
  scopes TEXT[] DEFAULT '{}',
  
  -- Security
  code_verifier TEXT,                      -- For PKCE flow
  
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- Auto-cleanup old states (via cron or trigger)
```

**Notes**:
- States expire after 10 minutes
- Used states are marked but kept for debugging
- Clean up expired states via scheduled job

---

### 8. `api_logs`

**Purpose**: Request logging for debugging and analytics.

```sql
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
  
  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  
  -- Response details
  status_code INTEGER,
  response_body JSONB,
  error_message TEXT,
  
  -- Performance
  latency_ms INTEGER,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_logs_project_id ON api_logs(project_id);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX idx_api_logs_provider_id ON api_logs(provider_id);
CREATE INDEX idx_api_logs_status_code ON api_logs(status_code);

-- Partition by month for performance (optional)
```

---

### 9. `usage_metrics`

**Purpose**: Aggregated usage data for billing and analytics.

```sql
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL,               -- 'daily' | 'monthly'
  
  -- Counts
  requests_count INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Connections
  new_connections INTEGER DEFAULT 0,
  active_connections INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, provider_id, period_start, period_type)
);

-- Indexes
CREATE INDEX idx_usage_project_period ON usage_metrics(project_id, period_start);
CREATE INDEX idx_usage_period_type ON usage_metrics(period_type);
```

---

### 10. `webhooks`

**Purpose**: Webhook subscriptions for event notifications.

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  secret TEXT NOT NULL,                    -- For signing payloads
  
  -- Events to subscribe to
  events TEXT[] NOT NULL DEFAULT '{}',     -- ['connection.created', 'connection.expired']
  
  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Health tracking
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  last_status_code INTEGER,
  consecutive_failures INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_project_id ON webhooks(project_id);
CREATE INDEX idx_webhooks_enabled ON webhooks(is_enabled);
```

**Webhook Events**:
- `connection.created` - New OAuth connection established
- `connection.expired` - Token expired and couldn't refresh
- `connection.revoked` - User revoked access
- `connection.error` - API error occurred

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_api_keys ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- Example policy: Users can only see their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE
  USING (user_id = auth.uid());
```

---

## Encryption Strategy

Sensitive fields are encrypted at the application level before storage:

| Table | Field | Encryption |
|-------|-------|------------|
| `providers` | `oauth_client_secret` | AES-256-GCM |
| `provider_connections` | `access_token` | AES-256-GCM |
| `provider_connections` | `refresh_token` | AES-256-GCM |
| `webhooks` | `secret` | AES-256-GCM |

**Encryption Key Management**:
- Master key stored in environment variable
- Key rotation supported via versioned encryption
