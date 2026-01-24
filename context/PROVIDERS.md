# Provider Architecture

> Provider adapter pattern, normalization, and scalability design for Link.

---

## Overview

Link abstracts 50+ third-party APIs into a unified interface. This is achieved through:

1. **Provider Adapters** - Consistent interface for each integration
2. **Normalization Layer** - Transform provider responses to unified schema
3. **Command Router** - Generic execution engine
4. **Provider Registry** - Dynamic adapter management

---

## Core Design Principles

### 1. Minimal Endpoints, Maximum Abstraction

Instead of exposing 50 different API endpoints per provider, Link exposes **4 standard operations**:

| Operation | Description | Example |
|-----------|-------------|---------|
| `fetch` | Read data | Get emails, list events |
| `create` | Create resources | Send email, create event |
| `update` | Modify resources | Update event, edit page |
| `delete` | Remove resources | Delete email, cancel event |

### 2. Provider Interface

All providers implement the same interface:

```typescript
interface ProviderAdapter {
  // Provider identity
  name: string;                    // 'gmail', 'google_calendar', 'notion'
  displayName: string;             // 'Gmail', 'Google Calendar', 'Notion'
  category: ProviderCategory;      // 'email', 'calendar', 'productivity'
  
  // OAuth configuration
  getAuthUrl(config: OAuthConfig): string;
  exchangeCode(code: string, config: OAuthConfig): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  
  // Standard CRUD operations
  fetch(connection: Connection, params: FetchParams): Promise<NormalizedResponse>;
  create(connection: Connection, params: CreateParams): Promise<NormalizedResponse>;
  update(connection: Connection, params: UpdateParams): Promise<NormalizedResponse>;
  delete(connection: Connection, params: DeleteParams): Promise<NormalizedResponse>;
  
  // Utility methods
  validateScopes(scopes: string[]): boolean;
  normalizeError(error: any): LinkError;
}
```

---

## Provider Registry

Centralized management of all provider adapters.

```typescript
// src/core/providers/registry.ts

class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();
  
  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: string): ProviderAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new ProviderNotFoundError(`Provider '${name}' not found`);
    }
    return adapter;
  }
  
  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  listByCategory(category: ProviderCategory): ProviderAdapter[] {
    return this.list().filter(a => a.category === category);
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry();

// Auto-register all adapters
import { GmailAdapter } from './gmail';
import { GoogleCalendarAdapter } from './google-calendar';
import { NotionAdapter } from './notion';
import { SlackAdapter } from './slack';

providerRegistry.register(new GmailAdapter());
providerRegistry.register(new GoogleCalendarAdapter());
providerRegistry.register(new NotionAdapter());
providerRegistry.register(new SlackAdapter());
```

---

## Command Router

Generic execution layer that routes requests to the appropriate adapter.

```typescript
// src/core/router/command-router.ts

interface ExecuteParams {
  connectionId: string;
  provider: string;
  action: 'fetch' | 'create' | 'update' | 'delete';
  params: Record<string, any>;
}

async function execute(params: ExecuteParams): Promise<NormalizedResponse> {
  const { connectionId, provider, action, params: actionParams } = params;
  
  // 1. Get the adapter
  const adapter = providerRegistry.get(provider);
  
  // 2. Get the connection
  const connection = await connectionService.get(connectionId);
  if (!connection) {
    throw new ConnectionNotFoundError();
  }
  
  // 3. Validate provider matches
  if (connection.providerName !== provider) {
    throw new ProviderMismatchError();
  }
  
  // 4. Refresh token if needed
  const tokens = await tokenManager.getValidTokens(connection);
  
  // 5. Execute the action
  try {
    const result = await adapter[action](
      { ...connection, tokens },
      actionParams
    );
    
    // 6. Log the request
    await logApiRequest({
      connectionId,
      provider,
      action,
      status: 'success',
      latencyMs: result.latencyMs,
    });
    
    return result;
    
  } catch (error) {
    // Normalize provider-specific errors
    const normalizedError = adapter.normalizeError(error);
    
    await logApiRequest({
      connectionId,
      provider,
      action,
      status: 'error',
      error: normalizedError,
    });
    
    throw normalizedError;
  }
}
```

---

## Provider Implementations

### Gmail Adapter

```typescript
// src/modules/providers/gmail/gmail.adapter.ts

export class GmailAdapter implements ProviderAdapter {
  name = 'gmail';
  displayName = 'Gmail';
  category: ProviderCategory = 'email';
  
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  
  // OAuth URLs
  private authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private tokenUrl = 'https://oauth2.googleapis.com/token';
  
  // Scope mappings (Link scopes → Google scopes)
  private scopeMap: Record<string, string> = {
    'email.read': 'https://www.googleapis.com/auth/gmail.readonly',
    'email.send': 'https://www.googleapis.com/auth/gmail.send',
    'email.modify': 'https://www.googleapis.com/auth/gmail.modify',
    'email.full': 'https://mail.google.com/',
  };
  
  getAuthUrl(config: OAuthConfig): string {
    const scopes = config.scopes.map(s => this.scopeMap[s] || s);
    
    return `${this.authUrl}?` + new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: config.state,
      access_type: 'offline',
      prompt: 'consent',
    });
  }
  
  async exchangeCode(code: string, config: OAuthConfig): Promise<TokenSet> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<TokenSet> {
    // Similar to exchangeCode with grant_type: 'refresh_token'
  }
  
  async fetch(connection: Connection, params: FetchParams): Promise<NormalizedResponse> {
    const { type, ...queryParams } = params;
    
    switch (type) {
      case 'messages':
        return this.fetchMessages(connection, queryParams);
      case 'message':
        return this.fetchMessage(connection, queryParams.messageId);
      case 'threads':
        return this.fetchThreads(connection, queryParams);
      case 'labels':
        return this.fetchLabels(connection);
      case 'profile':
        return this.fetchProfile(connection);
      default:
        throw new InvalidParamsError(`Unknown fetch type: ${type}`);
    }
  }
  
  private async fetchMessages(
    connection: Connection, 
    params: { maxResults?: number; query?: string; pageToken?: string }
  ): Promise<NormalizedResponse> {
    const url = `${this.baseUrl}/users/me/messages?` + new URLSearchParams({
      maxResults: (params.maxResults || 10).toString(),
      ...(params.query && { q: params.query }),
      ...(params.pageToken && { pageToken: params.pageToken }),
    });
    
    const response = await this.request(connection, url);
    
    // Fetch full message details for each message
    const messages = await Promise.all(
      (response.messages || []).map((m: any) => 
        this.fetchMessage(connection, m.id)
      )
    );
    
    return {
      items: messages.map(m => this.normalizeMessage(m)),
      nextPageToken: response.nextPageToken,
      resultSizeEstimate: response.resultSizeEstimate,
    };
  }
  
  private normalizeMessage(raw: any): NormalizedMessage {
    const headers = raw.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;
    
    return {
      id: raw.id,
      threadId: raw.threadId,
      provider: 'gmail',
      subject: getHeader('subject') || '(no subject)',
      snippet: raw.snippet,
      from: this.parseEmailAddress(getHeader('from')),
      to: this.parseEmailAddresses(getHeader('to')),
      cc: this.parseEmailAddresses(getHeader('cc')),
      timestamp: new Date(parseInt(raw.internalDate)).toISOString(),
      isRead: !raw.labelIds?.includes('UNREAD'),
      labels: raw.labelIds || [],
      raw: raw, // Include raw response if needed
    };
  }
  
  async create(connection: Connection, params: CreateParams): Promise<NormalizedResponse> {
    // Send email implementation
    const { to, cc, bcc, subject, body, bodyType } = params;
    
    const message = this.buildRawMessage({ to, cc, bcc, subject, body, bodyType });
    const encodedMessage = Buffer.from(message).toString('base64url');
    
    const response = await this.request(connection, `${this.baseUrl}/users/me/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ raw: encodedMessage }),
    });
    
    return {
      id: response.id,
      threadId: response.threadId,
      success: true,
    };
  }
  
  async update(connection: Connection, params: UpdateParams): Promise<NormalizedResponse> {
    // Modify labels, mark read/unread, etc.
  }
  
  async delete(connection: Connection, params: DeleteParams): Promise<NormalizedResponse> {
    const { messageId, permanent } = params;
    
    const endpoint = permanent
      ? `${this.baseUrl}/users/me/messages/${messageId}`
      : `${this.baseUrl}/users/me/messages/${messageId}/trash`;
    
    await this.request(connection, endpoint, {
      method: permanent ? 'DELETE' : 'POST',
    });
    
    return { success: true };
  }
  
  private async request(connection: Connection, url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${connection.tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw await this.handleError(response);
    }
    
    return response.json();
  }
  
  normalizeError(error: any): LinkError {
    if (error.status === 401) {
      return new ConnectionExpiredError('Gmail access token expired');
    }
    if (error.status === 403) {
      return new ScopeInsufficientError('Missing required Gmail scopes');
    }
    if (error.status === 429) {
      return new RateLimitError('Gmail API rate limit exceeded');
    }
    return new ProviderError('Gmail API error', error);
  }
}
```

### Google Calendar Adapter

```typescript
// src/modules/providers/google-calendar/calendar.adapter.ts

export class GoogleCalendarAdapter implements ProviderAdapter {
  name = 'google_calendar';
  displayName = 'Google Calendar';
  category: ProviderCategory = 'calendar';
  
  private baseUrl = 'https://www.googleapis.com/calendar/v3';
  
  // Similar OAuth implementation as Gmail...
  
  async fetch(connection: Connection, params: FetchParams): Promise<NormalizedResponse> {
    const { type, ...queryParams } = params;
    
    switch (type) {
      case 'calendars':
        return this.fetchCalendars(connection);
      case 'events':
        return this.fetchEvents(connection, queryParams);
      case 'event':
        return this.fetchEvent(connection, queryParams.calendarId, queryParams.eventId);
      default:
        throw new InvalidParamsError(`Unknown fetch type: ${type}`);
    }
  }
  
  private async fetchEvents(
    connection: Connection,
    params: { calendarId: string; timeMin?: string; timeMax?: string; maxResults?: number }
  ): Promise<NormalizedResponse> {
    const { calendarId = 'primary', ...queryParams } = params;
    
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?` + 
      new URLSearchParams({
        ...(queryParams.timeMin && { timeMin: queryParams.timeMin }),
        ...(queryParams.timeMax && { timeMax: queryParams.timeMax }),
        maxResults: (queryParams.maxResults || 50).toString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });
    
    const response = await this.request(connection, url);
    
    return {
      items: (response.items || []).map((e: any) => this.normalizeEvent(e)),
      nextPageToken: response.nextPageToken,
    };
  }
  
  private normalizeEvent(raw: any): NormalizedEvent {
    return {
      id: raw.id,
      provider: 'google_calendar',
      calendarId: raw.calendarId,
      summary: raw.summary,
      description: raw.description,
      location: raw.location,
      start: raw.start,
      end: raw.end,
      attendees: (raw.attendees || []).map((a: any) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })),
      organizer: raw.organizer,
      status: raw.status,
      htmlLink: raw.htmlLink,
      raw: raw,
    };
  }
  
  async create(connection: Connection, params: CreateParams): Promise<NormalizedResponse> {
    const { calendarId = 'primary', ...eventData } = params;
    
    const response = await this.request(
      connection,
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify({
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          attendees: eventData.attendees,
        }),
      }
    );
    
    return this.normalizeEvent(response);
  }
  
  async update(connection: Connection, params: UpdateParams): Promise<NormalizedResponse> {
    const { calendarId = 'primary', eventId, updates } = params;
    
    const response = await this.request(
      connection,
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    
    return this.normalizeEvent(response);
  }
  
  async delete(connection: Connection, params: DeleteParams): Promise<NormalizedResponse> {
    const { calendarId = 'primary', eventId } = params;
    
    await this.request(
      connection,
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE' }
    );
    
    return { success: true };
  }
}
```

---

## Normalization Layer

### Normalized Types

```typescript
// src/types/normalized.ts

// Base normalized response
interface NormalizedResponse {
  items?: any[];
  nextPageToken?: string;
  [key: string]: any;
}

// Normalized email message
interface NormalizedMessage {
  id: string;
  threadId?: string;
  provider: 'gmail' | 'outlook';
  subject: string;
  snippet?: string;
  body?: {
    text?: string;
    html?: string;
  };
  from: Contact;
  to: Contact[];
  cc?: Contact[];
  bcc?: Contact[];
  timestamp: string;
  isRead: boolean;
  labels: string[];
  attachments?: Attachment[];
  raw?: any;
}

// Normalized calendar event
interface NormalizedEvent {
  id: string;
  provider: 'google_calendar' | 'outlook_calendar';
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees: Attendee[];
  organizer?: Contact;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  raw?: any;
}

// Normalized contact
interface Contact {
  email: string;
  name?: string;
}

// Normalized attendee
interface Attendee extends Contact {
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}
```

---

## Adding a New Provider

### Step 1: Create the Adapter

```typescript
// src/modules/providers/slack/slack.adapter.ts

export class SlackAdapter implements ProviderAdapter {
  name = 'slack';
  displayName = 'Slack';
  category: ProviderCategory = 'communication';
  
  // Implement all required methods...
}
```

### Step 2: Register the Adapter

```typescript
// src/modules/providers/index.ts

import { SlackAdapter } from './slack/slack.adapter';

providerRegistry.register(new SlackAdapter());
```

### Step 3: Add Provider Config to Database

```sql
INSERT INTO providers (name, display_name, category, auth_url, token_url, scopes)
VALUES (
  'slack',
  'Slack',
  'communication',
  'https://slack.com/oauth/v2/authorize',
  'https://slack.com/api/oauth.v2.access',
  ARRAY['channels:read', 'chat:write', 'users:read']
);
```

### Step 4: Add SDK Provider Methods

```typescript
// packages/sdk/src/providers/slack.ts

export class SlackProvider {
  constructor(private client: LinkClient) {}
  
  async fetch(params: SlackFetchParams): Promise<NormalizedResponse> {
    return this.client.request('POST', '/v1/slack/fetch', params);
  }
  
  async send(params: SlackSendParams): Promise<NormalizedResponse> {
    return this.client.request('POST', '/v1/slack/create', params);
  }
}
```

---

## Supported Providers

### Current

| Provider | Category | Status |
|----------|----------|--------|
| Gmail | Email | ✅ Implemented |
| Google Calendar | Calendar | ✅ Implemented |
| Notion | Productivity | 🔄 In Progress |
| Slack | Communication | 📋 Planned |

### Roadmap

| Provider | Category | Priority |
|----------|----------|----------|
| Outlook | Email | High |
| Outlook Calendar | Calendar | High |
| Linear | Project Management | Medium |
| Jira | Project Management | Medium |
| GitHub | Development | Medium |
| Airtable | Database | Low |
| Hubspot | CRM | Low |
| Salesforce | CRM | Low |

---

## Scalability Patterns

### 1. Lazy Loading Adapters

```typescript
// Only load adapters when needed
class LazyProviderRegistry {
  private loaders: Map<string, () => Promise<ProviderAdapter>> = new Map();
  private loaded: Map<string, ProviderAdapter> = new Map();
  
  registerLoader(name: string, loader: () => Promise<ProviderAdapter>) {
    this.loaders.set(name, loader);
  }
  
  async get(name: string): Promise<ProviderAdapter> {
    if (this.loaded.has(name)) {
      return this.loaded.get(name)!;
    }
    
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new ProviderNotFoundError(name);
    }
    
    const adapter = await loader();
    this.loaded.set(name, adapter);
    return adapter;
  }
}
```

### 2. Provider Caching

```typescript
// Cache provider configs to reduce DB queries
const providerCache = new LRUCache<string, Provider>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

async function getProviderConfig(name: string): Promise<Provider> {
  let provider = providerCache.get(name);
  
  if (!provider) {
    provider = await db.providers.findByName(name);
    if (provider) {
      providerCache.set(name, provider);
    }
  }
  
  return provider;
}
```

### 3. Horizontal Scaling

Each provider adapter is stateless, allowing horizontal scaling:

```
Load Balancer
     │
     ├── API Server 1 (all adapters)
     ├── API Server 2 (all adapters)
     └── API Server 3 (all adapters)
```
