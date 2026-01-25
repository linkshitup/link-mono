import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development','production','test']).default('development'),
    PORT: z.string().default('3001').transform(Number),

    // Supabase
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(1),

    // Encryption
    ENCRYPTION_KEY: z.string().length(64), // 32 bytes as hex
    
    
});