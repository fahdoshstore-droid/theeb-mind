import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_PATH: z.string().default('./theeb-mind.db'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Environment validation failed: ${errors}`);
  }
  return result.data;
}

export const env: Env = loadEnv();