export class LinkError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number,
        public details?: unknown,
    ) {
        super(message);
        this.name = 'LinkError';
  }
}

export class ValidationError extends LinkError {
    constructor(message = 'Validation failed', details?: unknown) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
} 