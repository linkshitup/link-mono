import { createClient } from '@supabase/supabase-js'; // importing supabase package
import { config } from './env.js'; //importing zod schema for environment variables

export const supabase = createClient(
    config.supabase.url, // need url of supabase project
    config.supabase.serviceKey, // need service key of supabase project
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);