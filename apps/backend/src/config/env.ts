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

const parsed = envSchema.safeParse(process.env);

if(!parsed.success){
    console.log('Invalid env variables:', parsed.error.flatten().fieldErrors);
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
  };