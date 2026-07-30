import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  PORT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  MONGO_URI: z.string().url('MONGO_URI must be a valid URL connecting to MongoDB')
    .default(isTest ? 'mongodb://localhost:27017/ai-study-planner-tests' : undefined),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for production grade security')
    .default(isTest ? 'ci_test_secret_key_32_characters_long_minimum' : undefined),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long for production grade security')
    .default(isTest ? 'ci_test_refresh_secret_key_32_characters_long_minimum' : undefined),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required')
    .default(isTest ? 'gsk_fake_key_for_testing' : undefined),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL')
    .default(isTest ? 'http://localhost:5173' : undefined),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  
  // AI Configs
  AI_MODEL: z.string().default('llama-3.1-8b-instant'),
  AI_INPUT_COST_1M: z.string().transform(val => parseFloat(val)).default('0.05'),
  AI_OUTPUT_COST_1M: z.string().transform(val => parseFloat(val)).default('0.08')
});

// Parse process.env parameters
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed on startup:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
