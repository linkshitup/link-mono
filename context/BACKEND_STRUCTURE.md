# Backend Structure

> Production-grade folder structure and code organization for Link backend.

---

## Overview

The Link backend is built with:

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Architecture**: Modular, domain-driven

---

## Folder Structure

```
apps/backend/
│
├── src/
│   │
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # Server entry point
│   │
│   ├── config/                   # Configuration
│   │   ├── index.ts              # Config exports
│   │   ├── env.ts                # Environment variables
│   │   ├── supabase.ts           # Supabase client
│   │   └── providers.ts          # Provider configurations
│   │
│   ├── modules/                  # Feature modules
│   │   │
│   │   ├── auth/                 # Platform authentication
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.types.ts
│   │   │
│   │   ├── projects/             # Project management
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   ├── projects.routes.ts
│   │   │   └── projects.types.ts
│   │   │
│   │   ├── api-keys/             # API key management
│   │   │   ├── api-keys.controller.ts
│   │   │   ├── api-keys.service.ts
│   │   │   ├── api-keys.routes.ts
│   │   │   └── api-keys.types.ts
│   │   │
│   │   ├── oauth/                # OAuth flow handling
│   │   │   ├── oauth.controller.ts
│   │   │   ├── oauth.service.ts
│   │   │   ├── oauth.routes.ts
│   │   │   └── oauth.types.ts
│   │   │
│   │   ├── connections/          # Connection management
│   │   │   ├── connections.controller.ts
│   │   │   ├── connections.service.ts
│   │   │   ├── connections.routes.ts
│   │   │   └── connections.types.ts
│   │   │
│   │   ├── webhooks/             # Webhook management
│   │   │   ├── webhooks.controller.ts
│   │   │   ├── webhooks.service.ts
│   │   │   ├── webhooks.routes.ts
│   │   │   └── webhooks.types.ts
│   │   │
│   │   └── providers/            # Provider implementations
│   │       │
│   │       ├── index.ts          # Provider registry
│   │       ├── base.adapter.ts   # Base adapter class
│   │       │
│   │       ├── gmail/
│   │       │   ├── gmail.adapter.ts
│   │       │   ├── gmail.controller.ts
│   │       │   ├── gmail.routes.ts
│   │       │   ├── gmail.normalizer.ts
│   │       │   └── gmail.types.ts
│   │       │
│   │       ├── google-calendar/
│   │       │   ├── calendar.adapter.ts
│   │       │   ├── calendar.controller.ts
│   │       │   ├── calendar.routes.ts
│   │       │   ├── calendar.normalizer.ts
│   │       │   └── calendar.types.ts
│   │       │
│   │       ├── notion/
│   │       │   ├── notion.adapter.ts
│   │       │   ├── notion.controller.ts
│   │       │   ├── notion.routes.ts
│   │       │   ├── notion.normalizer.ts
│   │       │   └── notion.types.ts
│   │       │
│   │       └── slack/
│   │           ├── slack.adapter.ts
│   │           ├── slack.controller.ts
│   │           ├── slack.routes.ts
│   │           ├── slack.normalizer.ts
│   │           └── slack.types.ts
│   │
│   ├── core/                     # Core services
│   │   │
│   │   ├── router/               # Command router
│   │   │   ├── command-router.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── token-manager/        # Token management
│   │   │   ├── token-manager.ts
│   │   │   ├── encryption.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── normalizers/          # Response normalization
│   │   │   ├── message.normalizer.ts
│   │   │   ├── event.normalizer.ts
│   │   │   └── types.ts
│   │   │
│   │   └── webhook-dispatcher/   # Webhook delivery
│   │       ├── dispatcher.ts
│   │       ├── queue.ts
│   │       └── types.ts
│   │
│   ├── middlewares/              # Express middlewares
│   │   ├── index.ts
│   │   ├── verify-api-key.ts
│   │   ├── verify-signature.ts
│   │   ├── rate-limiter.ts
│   │   ├── error-handler.ts
│   │   ├── request-logger.ts
│   │   └── cors.ts
│   │
│   ├── utils/                    # Utility functions
│   │   ├── crypto.ts             # Encryption utilities
│   │   ├── logger.ts             # Logging
│   │   ├── http.ts               # HTTP helpers
│   │   ├── validators.ts         # Zod schemas
│   │   └── response.ts           # Response helpers
│   │
│   └── types/                    # TypeScript types
│       ├── index.ts
│       ├── express.d.ts          # Express type extensions
│       ├── providers.ts
│       ├── connections.ts
│       ├── api.ts
│       └── normalized.ts
│
├── tests/                        # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Key Files

### Entry Point

```typescript
// src/server.ts

import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

async function bootstrap() {
  const app = await createApp();
  
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${config.env}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
```

### App Configuration

```typescript
// src/app.ts

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { errorHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/request-logger';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { projectRoutes } from './modules/projects/projects.routes';
import { oauthRoutes } from './modules/oauth/oauth.routes';
import { connectionRoutes } from './modules/connections/connections.routes';
import { webhookRoutes } from './modules/webhooks/webhooks.routes';

// Provider routes
import { gmailRoutes } from './modules/providers/gmail/gmail.routes';
import { calendarRoutes } from './modules/providers/google-calendar/calendar.routes';

export async function createApp() {
  const app = express();
  
  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // API routes
  app.use('/v1/auth', authRoutes);
  app.use('/v1/projects', projectRoutes);
  app.use('/v1/oauth', oauthRoutes);
  app.use('/v1/connections', connectionRoutes);
  app.use('/v1/webhooks', webhookRoutes);
  
  // Provider routes
  app.use('/v1/gmail', gmailRoutes);
  app.use('/v1/calendar', calendarRoutes);
  
  // Generic execute endpoint
  app.use('/v1/execute', executeRoutes);
  
  // Error handling (must be last)
  app.use(errorHandler);
  
  return app;
}
```

### Environment Configuration

```typescript
// src/config/env.ts

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string(),
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes as hex
  
  // OAuth (Link's own OAuth app credentials)
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  NOTION_CLIENT_ID: z.string(),
  NOTION_CLIENT_SECRET: z.string(),
  
  // API
  API_BASE_URL: z.string().url(),
  OAUTH_CALLBACK_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  
  supabase: {
    url: parsed.data.SUPABASE_URL,
    serviceKey: parsed.data.SUPABASE_SERVICE_KEY,
  },
  
  encryption: {
    key: parsed.data.ENCRYPTION_KEY,
  },
  
  oauth: {
    google: {
      clientId: parsed.data.GOOGLE_CLIENT_ID,
      clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    },
    notion: {
      clientId: parsed.data.NOTION_CLIENT_ID,
      clientSecret: parsed.data.NOTION_CLIENT_SECRET,
    },
  },
  
  api: {
    baseUrl: parsed.data.API_BASE_URL,
    oauthCallbackUrl: parsed.data.OAUTH_CALLBACK_URL,
  },
};
```

### Supabase Client

```typescript
// src/config/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { config } from './env';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

---

## Module Structure

Each module follows the same pattern:

### Controller

Handles HTTP request/response.

```typescript
// src/modules/projects/projects.controller.ts

import { Request, Response, NextFunction } from 'express';
import { projectsService } from './projects.service';
import { CreateProjectSchema, UpdateProjectSchema } from './projects.types';
import { success, error } from '../../utils/response';

export const projectsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateProjectSchema.parse(req.body);
      const project = await projectsService.create(req.user!.id, data);
      res.status(201).json(success(project));
    } catch (err) {
      next(err);
    }
  },
  
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const projects = await projectsService.listByUser(req.user!.id);
      res.json(success({ items: projects }));
    } catch (err) {
      next(err);
    }
  },
  
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.get(req.params.id, req.user!.id);
      res.json(success(project));
    } catch (err) {
      next(err);
    }
  },
  
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = UpdateProjectSchema.parse(req.body);
      const project = await projectsService.update(req.params.id, req.user!.id, data);
      res.json(success(project));
    } catch (err) {
      next(err);
    }
  },
  
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await projectsService.delete(req.params.id, req.user!.id);
      res.json(success({ deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
```

### Service

Contains business logic.

```typescript
// src/modules/projects/projects.service.ts

import { supabase } from '../../config/supabase';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import type { CreateProject, UpdateProject, Project } from './projects.types';

export const projectsService = {
  async create(userId: string, data: CreateProject): Promise<Project> {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
        environment: data.environment || 'development',
      })
      .select()
      .single();
    
    if (error) throw error;
    return project;
  },
  
  async listByUser(userId: string): Promise<Project[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return projects;
  },
  
  async get(projectId: string, userId: string): Promise<Project> {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error || !project) {
      throw new NotFoundError('Project not found');
    }
    
    if (project.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    return project;
  },
  
  async update(projectId: string, userId: string, data: UpdateProject): Promise<Project> {
    // Verify ownership first
    await this.get(projectId, userId);
    
    const { data: project, error } = await supabase
      .from('projects')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();
    
    if (error) throw error;
    return project;
  },
  
  async delete(projectId: string, userId: string): Promise<void> {
    // Verify ownership first
    await this.get(projectId, userId);
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    
    if (error) throw error;
  },
};
```

### Routes

Defines endpoints and middleware.

```typescript
// src/modules/projects/projects.routes.ts

import { Router } from 'express';
import { projectsController } from './projects.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', projectsController.create);
router.get('/', projectsController.list);
router.get('/:id', projectsController.get);
router.patch('/:id', projectsController.update);
router.delete('/:id', projectsController.delete);

export const projectRoutes = router;
```

### Types

TypeScript types and Zod schemas.

```typescript
// src/modules/projects/projects.types.ts

import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  environment: z.enum(['development', 'production']).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.record(z.any()).optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  environment: 'development' | 'production';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

---

## Middleware Examples

### API Key Verification

```typescript
// src/middlewares/verify-api-key.ts

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { InvalidApiKeyError } from '../utils/errors';

export async function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  const publicKey = req.headers['x-link-public-key'] as string;
  
  if (!publicKey) {
    return next(new InvalidApiKeyError('Missing API key'));
  }
  
  const { data: apiKey, error } = await supabase
    .from('project_api_keys')
    .select('*, projects(*)')
    .eq('public_key', publicKey)
    .eq('status', 'active')
    .single();
  
  if (error || !apiKey) {
    return next(new InvalidApiKeyError('Invalid or revoked API key'));
  }
  
  // Attach to request for later use
  req.apiKey = apiKey;
  req.project = apiKey.projects;
  
  // Update last_used_at
  await supabase
    .from('project_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);
  
  next();
}
```

### Signature Verification

```typescript
// src/middlewares/verify-signature.ts

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { InvalidSignatureError, TimestampExpiredError } from '../utils/errors';
import { decrypt } from '../utils/crypto';

export async function verifySignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-link-signature'] as string;
  const timestamp = req.headers['x-link-timestamp'] as string;
  
  if (!signature || !timestamp) {
    return next(new InvalidSignatureError('Missing signature or timestamp'));
  }
  
  // Check timestamp (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return next(new TimestampExpiredError('Request timestamp too old'));
  }
  
  // Get secret key from API key (set by verifyApiKey middleware)
  const secretKey = decrypt(req.apiKey!.secret_key_encrypted);
  
  // Recreate expected signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  
  // Constant-time comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  if (!isValid) {
    return next(new InvalidSignatureError('Signature verification failed'));
  }
  
  next();
}
```

### Error Handler

```typescript
// src/middlewares/error-handler.ts

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { LinkError } from '../utils/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Log error
  logger.error('Request error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  // Handle known error types
  if (err instanceof LinkError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: err.errors,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Unknown error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

## Utility Examples

### Response Helpers

```typescript
// src/utils/response.ts

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export function success<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}
```

### Custom Errors

```typescript
// src/utils/errors.ts

export class LinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'LinkError';
  }
}

export class InvalidApiKeyError extends LinkError {
  constructor(message = 'Invalid API key') {
    super(message, 'INVALID_API_KEY', 401);
  }
}

export class InvalidSignatureError extends LinkError {
  constructor(message = 'Invalid signature') {
    super(message, 'INVALID_SIGNATURE', 401);
  }
}

export class TimestampExpiredError extends LinkError {
  constructor(message = 'Timestamp expired') {
    super(message, 'TIMESTAMP_EXPIRED', 401);
  }
}

export class NotFoundError extends LinkError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ForbiddenError extends LinkError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConnectionExpiredError extends LinkError {
  constructor(message = 'Connection expired') {
    super(message, 'CONNECTION_EXPIRED', 401);
  }
}

export class ProviderError extends LinkError {
  constructor(message = 'Provider error', details?: any) {
    super(message, 'PROVIDER_ERROR', 502, details);
  }
}

export class RateLimitError extends LinkError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMITED', 429);
  }
}
```

---

## NPM Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "express": "^4.x",
    "helmet": "^7.x",
    "cors": "^2.x",
    "zod": "^3.x",
    "rate-limiter-flexible": "^3.x",
    "pino": "^8.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/express": "^4.x",
    "@types/node": "^20.x",
    "vitest": "^1.x",
    "eslint": "^8.x"
  }
}
```
