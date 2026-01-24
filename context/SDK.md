# SDK Guide

> SDK architecture and usage for the Link client library.

---

## Overview

The Link SDK provides a Stripe-style developer experience for integrating third-party services. It handles:

- Request signing (HMAC)
- OAuth connection flows
- Type-safe API calls
- Error handling and retries

---

## Installation

```bash
npm install @link/sdk
# or
yarn add @link/sdk
# or
pnpm add @link/sdk
```

---

## Quick Start

```typescript
import { Link } from "@link/sdk";

// Initialize the client
const link = new Link({
  publicKey: "pk_live_xxxxx",
  secretKey: "sk_live_xxxxx",
});

// Connect a user to Gmail
const { authorizationUrl } = await link.connect("gmail", {
  userId: "user_123",
  redirectUri: "https://yourapp.com/callback",
});

// Redirect user to authorizationUrl...

// After callback, fetch Gmail messages
const messages = await link.gmail.fetch({
  connectionId: "conn_xxxxx",
  type: "messages",
  params: { maxResults: 10 },
});
```

---

## SDK Architecture

```
@link/sdk/
│
├── index.ts              # Main entry point, Link class
│
├── core/
│   ├── client.ts         # HTTP client with signing
│   ├── request.ts        # Request building and signing
│   ├── auth.ts           # Authentication utilities
│   └── errors.ts         # Error classes
│
├── providers/
│   ├── gmail.ts          # Gmail provider methods
│   ├── calendar.ts       # Google Calendar methods
│   ├── notion.ts         # Notion methods
│   └── index.ts          # Provider registry
│
└── types/
    ├── common.ts         # Shared types
    ├── gmail.ts          # Gmail-specific types
    ├── calendar.ts       # Calendar-specific types
    └── index.ts          # Type exports
```

---

## Configuration

### Basic Configuration

```typescript
const link = new Link({
  publicKey: "pk_live_xxxxx",
  secretKey: "sk_live_xxxxx",
});
```

### Advanced Configuration

```typescript
const link = new Link({
  publicKey: "pk_live_xxxxx",
  secretKey: "sk_live_xxxxx",
  
  // Optional settings
  baseUrl: "https://api.link.dev/v1",  // Custom API URL
  timeout: 30000,                        // Request timeout (ms)
  retries: 3,                            // Retry failed requests
  debug: false,                          // Enable debug logging
});
```

---

## Connecting Users

### OAuth Connection Flow

```typescript
// Step 1: Generate authorization URL
const { authorizationUrl, state } = await link.connect("gmail", {
  userId: "user_123",                           // Your user's ID
  redirectUri: "https://yourapp.com/callback",  // Your callback URL
  scopes: ["email.read", "email.send"],         // Optional: specific scopes
});

// Step 2: Redirect user to authorizationUrl
// User completes OAuth consent

// Step 3: Handle callback
// Your callback receives: ?connection_id=conn_xxxxx&status=success

// Step 4: Store connection_id for future API calls
```

### Available Providers

```typescript
// Email
await link.connect("gmail", { userId, redirectUri });
await link.connect("outlook", { userId, redirectUri });

// Calendar
await link.connect("google_calendar", { userId, redirectUri });
await link.connect("outlook_calendar", { userId, redirectUri });

// Productivity
await link.connect("notion", { userId, redirectUri });
await link.connect("slack", { userId, redirectUri });
await link.connect("linear", { userId, redirectUri });
```

---

## Provider Methods

### Gmail

```typescript
// Fetch messages
const messages = await link.gmail.fetch({
  connectionId: "conn_xxxxx",
  type: "messages",
  params: {
    maxResults: 10,
    query: "is:unread",
  },
});

// Fetch single message
const message = await link.gmail.fetch({
  connectionId: "conn_xxxxx",
  type: "message",
  params: { messageId: "msg_123" },
});

// Send email
await link.gmail.send({
  connectionId: "conn_xxxxx",
  to: ["recipient@example.com"],
  subject: "Hello from Link",
  body: "This is the email body",
});

// Delete email
await link.gmail.delete({
  connectionId: "conn_xxxxx",
  messageId: "msg_123",
  permanent: false,  // Move to trash (true = permanent delete)
});

// List labels
const labels = await link.gmail.fetch({
  connectionId: "conn_xxxxx",
  type: "labels",
});
```

### Google Calendar

```typescript
// List calendars
const calendars = await link.calendar.fetch({
  connectionId: "conn_xxxxx",
  type: "calendars",
});

// List events
const events = await link.calendar.fetch({
  connectionId: "conn_xxxxx",
  type: "events",
  params: {
    calendarId: "primary",
    timeMin: "2024-01-01T00:00:00Z",
    timeMax: "2024-01-31T23:59:59Z",
  },
});

// Create event
const newEvent = await link.calendar.create({
  connectionId: "conn_xxxxx",
  calendarId: "primary",
  summary: "Team Meeting",
  description: "Weekly sync",
  start: {
    dateTime: "2024-01-15T10:00:00Z",
    timeZone: "America/New_York",
  },
  end: {
    dateTime: "2024-01-15T11:00:00Z",
    timeZone: "America/New_York",
  },
  attendees: [{ email: "team@example.com" }],
});

// Update event
await link.calendar.update({
  connectionId: "conn_xxxxx",
  calendarId: "primary",
  eventId: "evt_123",
  updates: {
    summary: "Updated Meeting Title",
  },
});

// Delete event
await link.calendar.delete({
  connectionId: "conn_xxxxx",
  calendarId: "primary",
  eventId: "evt_123",
});
```

### Notion

```typescript
// List pages
const pages = await link.notion.fetch({
  connectionId: "conn_xxxxx",
  type: "pages",
});

// Get page content
const page = await link.notion.fetch({
  connectionId: "conn_xxxxx",
  type: "page",
  params: { pageId: "page_123" },
});

// Create page
await link.notion.create({
  connectionId: "conn_xxxxx",
  parentId: "database_123",
  properties: {
    Name: { title: [{ text: { content: "New Page" } }] },
  },
});
```

---

## Connection Management

```typescript
// List all connections for a user
const connections = await link.connections.list({
  userId: "user_123",
});

// Get connection details
const connection = await link.connections.get("conn_xxxxx");

// Disconnect (revoke tokens)
await link.connections.delete("conn_xxxxx");

// Check connection status
const status = await link.connections.status("conn_xxxxx");
// Returns: { status: "active" | "expired" | "revoked", ... }
```

---

## Error Handling

```typescript
import { Link, LinkError, ConnectionExpiredError } from "@link/sdk";

try {
  const messages = await link.gmail.fetch({
    connectionId: "conn_xxxxx",
    type: "messages",
  });
} catch (error) {
  if (error instanceof ConnectionExpiredError) {
    // Token expired, prompt user to reconnect
    const { authorizationUrl } = await link.connect("gmail", {
      userId: "user_123",
      redirectUri: "https://yourapp.com/callback",
    });
    // Redirect user...
  } else if (error instanceof LinkError) {
    console.error(`Link API error: ${error.code} - ${error.message}`);
  } else {
    throw error;
  }
}
```

### Error Types

```typescript
// Base error class
class LinkError extends Error {
  code: string;
  statusCode: number;
  requestId: string;
}

// Specific errors
class InvalidApiKeyError extends LinkError {}
class InvalidSignatureError extends LinkError {}
class ConnectionNotFoundError extends LinkError {}
class ConnectionExpiredError extends LinkError {}
class ProviderError extends LinkError {}
class RateLimitError extends LinkError {}
class ScopeInsufficientError extends LinkError {}
```

---

## TypeScript Types

The SDK is fully typed:

```typescript
import type {
  // Core types
  LinkConfig,
  Connection,
  ConnectionStatus,
  
  // Gmail types
  GmailMessage,
  GmailThread,
  GmailLabel,
  SendEmailParams,
  
  // Calendar types
  CalendarEvent,
  CreateEventParams,
  
  // Response types
  FetchResponse,
  PaginatedResponse,
} from "@link/sdk";
```

---

## Server-Side Usage (Node.js)

```typescript
// Express.js example
import express from "express";
import { Link } from "@link/sdk";

const app = express();
const link = new Link({
  publicKey: process.env.LINK_PUBLIC_KEY!,
  secretKey: process.env.LINK_SECRET_KEY!,
});

// Start OAuth flow
app.get("/connect/gmail", async (req, res) => {
  const { authorizationUrl } = await link.connect("gmail", {
    userId: req.user.id,
    redirectUri: `${process.env.APP_URL}/callback`,
  });
  res.redirect(authorizationUrl);
});

// Handle callback
app.get("/callback", async (req, res) => {
  const { connection_id, status } = req.query;
  
  if (status === "success") {
    // Store connection_id in your database
    await db.users.update(req.user.id, { gmailConnectionId: connection_id });
    res.redirect("/dashboard?connected=gmail");
  } else {
    res.redirect("/dashboard?error=connection_failed");
  }
});

// Fetch emails
app.get("/api/emails", async (req, res) => {
  const user = await db.users.get(req.user.id);
  
  const messages = await link.gmail.fetch({
    connectionId: user.gmailConnectionId,
    type: "messages",
    params: { maxResults: 20 },
  });
  
  res.json(messages);
});
```

---

## React Integration Example

```tsx
import { useState } from "react";
import { Link } from "@link/sdk";

const link = new Link({
  publicKey: process.env.NEXT_PUBLIC_LINK_PUBLIC_KEY!,
  secretKey: process.env.LINK_SECRET_KEY!, // Keep on server!
});

// Note: OAuth initiation should happen server-side
// This is a simplified example

function ConnectGmail({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    
    // Call your backend to initiate OAuth
    const res = await fetch("/api/connect/gmail", { method: "POST" });
    const { authorizationUrl } = await res.json();
    
    // Redirect to OAuth
    window.location.href = authorizationUrl;
  };

  return (
    <button onClick={handleConnect} disabled={loading}>
      {loading ? "Connecting..." : "Connect Gmail"}
    </button>
  );
}
```

---

## Best Practices

1. **Keep secret key server-side**: Never expose `secretKey` in client-side code
2. **Store connection IDs**: Persist `connection_id` in your database for each user
3. **Handle expired connections**: Implement reconnection flows for expired tokens
4. **Use webhooks**: Subscribe to `connection.expired` events for proactive handling
5. **Scope minimally**: Request only the scopes you need
