# API Reference

> Endpoint design and specifications for Link Core API.

---

## Base URL

```
Production: https://api.link.dev/v1
Development: http://localhost:3000/v1
```

---

## Authentication

All API requests must include authentication headers:

```http
X-Link-Public-Key: pk_live_xxxxx
X-Link-Signature: <HMAC-SHA256 signature>
X-Link-Timestamp: <Unix timestamp>
```

### Signature Generation

```typescript
const timestamp = Math.floor(Date.now() / 1000);
const payload = `${timestamp}.${JSON.stringify(body)}`;
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(payload)
  .digest('hex');
```

---

## Response Format

All responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or revoked",
    "details": { ... }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

---

## Core Endpoints

### Projects

#### Create Project

```http
POST /v1/projects
```

**Request Body:**
```json
{
  "name": "My App",
  "description": "Optional description",
  "environment": "development"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj_xxxxx",
    "name": "My App",
    "environment": "development",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Get Project

```http
GET /v1/projects/:projectId
```

#### List Projects

```http
GET /v1/projects
```

---

### API Keys

#### Create API Key

```http
POST /v1/projects/:projectId/keys
```

**Request Body:**
```json
{
  "name": "Production Key",
  "environment": "live"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_xxxxx",
    "name": "Production Key",
    "publicKey": "pk_live_xxxxx",
    "secretKey": "sk_live_xxxxx",
    "environment": "live",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

> ⚠️ **Important**: The `secretKey` is only returned once at creation time. Store it securely.

#### Revoke API Key

```http
DELETE /v1/projects/:projectId/keys/:keyId
```

---

## OAuth Endpoints

### Initiate OAuth Connection

```http
POST /v1/oauth/connect
```

**Request Body:**
```json
{
  "provider": "gmail",
  "userId": "user_abc",
  "redirectUri": "https://yourapp.com/callback",
  "scopes": ["email.read", "email.send"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://api.link.dev/v1/oauth/start?state=xyz123",
    "state": "xyz123",
    "expiresAt": "2024-01-15T10:10:00Z"
  }
}
```

### OAuth Start (Redirect)

```http
GET /v1/oauth/start?state=xyz123
```

Redirects user to provider OAuth consent page.

### OAuth Callback

```http
GET /v1/oauth/callback?code=abc&state=xyz123
```

Handles provider callback, exchanges code for tokens, redirects to developer app:

```
https://yourapp.com/callback?connection_id=conn_xxxxx&status=success
```

---

## Provider Endpoints

### Generic Pattern

Instead of exposing provider-specific endpoints, Link uses a normalized pattern:

```
POST /v1/{provider}/{action}
```

### Gmail

#### Fetch Gmail Data

```http
POST /v1/gmail/fetch
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "type": "messages",
  "params": {
    "maxResults": 10,
    "query": "is:unread"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "msg_123",
        "subject": "Hello World",
        "from": {
          "email": "sender@example.com",
          "name": "Sender Name"
        },
        "snippet": "This is the message preview...",
        "timestamp": "2024-01-15T10:00:00Z",
        "isRead": false,
        "labels": ["INBOX", "UNREAD"]
      }
    ],
    "nextPageToken": "token_abc",
    "resultSizeEstimate": 100
  }
}
```

**Fetch Types:**
- `messages` - List messages
- `message` - Get single message (requires `params.messageId`)
- `threads` - List threads
- `thread` - Get single thread (requires `params.threadId`)
- `labels` - List labels
- `profile` - Get user profile

#### Send Email

```http
POST /v1/gmail/send
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "to": ["recipient@example.com"],
  "cc": [],
  "bcc": [],
  "subject": "Hello from Link",
  "body": "This is the email body",
  "bodyType": "text",
  "attachments": []
}
```

#### Delete Email

```http
POST /v1/gmail/delete
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "messageId": "msg_123",
  "permanent": false
}
```

---

### Google Calendar

#### Fetch Calendar Data

```http
POST /v1/calendar/fetch
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "type": "events",
  "params": {
    "calendarId": "primary",
    "timeMin": "2024-01-01T00:00:00Z",
    "timeMax": "2024-01-31T23:59:59Z",
    "maxResults": 50
  }
}
```

**Fetch Types:**
- `calendars` - List calendars
- `events` - List events
- `event` - Get single event (requires `params.eventId`)

#### Create Event

```http
POST /v1/calendar/create
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "calendarId": "primary",
  "summary": "Team Meeting",
  "description": "Weekly sync",
  "start": {
    "dateTime": "2024-01-15T10:00:00Z",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2024-01-15T11:00:00Z",
    "timeZone": "America/New_York"
  },
  "attendees": [
    { "email": "team@example.com" }
  ]
}
```

#### Update Event

```http
POST /v1/calendar/update
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "calendarId": "primary",
  "eventId": "evt_123",
  "updates": {
    "summary": "Updated Meeting Title"
  }
}
```

#### Delete Event

```http
POST /v1/calendar/delete
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "calendarId": "primary",
  "eventId": "evt_123"
}
```

---

### Generic Execute Endpoint

For advanced use cases, a generic execution endpoint:

```http
POST /v1/execute
```

**Request Body:**
```json
{
  "connectionId": "conn_xxxxx",
  "provider": "gmail",
  "action": "fetch",
  "params": {
    "type": "messages",
    "maxResults": 10
  }
}
```

---

## Connections

### List Connections

```http
GET /v1/connections
```

**Query Parameters:**
- `userId` - Filter by end user ID
- `provider` - Filter by provider name
- `status` - Filter by status (active, expired, revoked)

### Get Connection

```http
GET /v1/connections/:connectionId
```

### Delete Connection

```http
DELETE /v1/connections/:connectionId
```

Revokes OAuth tokens and removes the connection.

---

## Webhooks

### Create Webhook

```http
POST /v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://yourapp.com/webhooks/link",
  "events": ["connection.created", "connection.expired"]
}
```

### List Webhooks

```http
GET /v1/webhooks
```

### Delete Webhook

```http
DELETE /v1/webhooks/:webhookId
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key is invalid or revoked |
| `INVALID_SIGNATURE` | 401 | Request signature verification failed |
| `TIMESTAMP_EXPIRED` | 401 | Request timestamp too old (>5 min) |
| `CONNECTION_NOT_FOUND` | 404 | Connection ID doesn't exist |
| `CONNECTION_EXPIRED` | 401 | OAuth tokens expired and refresh failed |
| `PROVIDER_ERROR` | 502 | Error from third-party provider |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_PARAMS` | 400 | Invalid request parameters |
| `SCOPE_INSUFFICIENT` | 403 | Connection lacks required scopes |

---

## Rate Limits

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Free | 60 | 1,000 |
| Pro | 600 | 50,000 |
| Enterprise | Custom | Custom |

Rate limit headers included in responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
```
