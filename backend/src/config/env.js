import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

// Define known placeholders to reject in production/development
const knownPlaceholders = [
  'replace_with_at_least_32_character_long_secure_random_key_1',
  'replace_with_at_least_32_character_long_secure_random_key_2',
  'gsk_replace_with_your_groq_api_secret_key',
  'your_google_client_id.apps.googleusercontent.com',
  'your_google_client_secret',
  'your_email@gmail.com',
  'your_email_app_password',
  'secret',
  'default',
  'password'
];

const productionSecretSchema = z.string()
  .min(32, 'Secrets must be at least 32 characters long for production-grade security')
  .refine(val => !knownPlaceholders.some(ph => val.includes(ph)), {
    message: 'Secret cannot contain known placeholder values'
  });

const envSchema = z.object({
  PORT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string().url('MONGO_URI must be a valid URL connecting to MongoDB')
    .default(isTest ? 'mongodb://localhost:27017/ai-study-planner-tests' : undefined),
  
  // Secrets validation
  JWT_SECRET: isTest ? z.string().default('ci_test_secret_key_32_characters_long_minimum') : productionSecretSchema,
  JWT_REFRESH_SECRET: isTest ? z.string().default('ci_test_refresh_secret_key_32_characters_long_minimum') : productionSecretSchema,
  
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required')
    .refine(val => isTest || !knownPlaceholders.some(ph => val.includes(ph)), {
      message: 'GROQ_API_KEY cannot contain known placeholder values'
    })
    .default(isTest ? 'gsk_fake_key_for_testing' : undefined),
    
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL')
    .default(isTest ? 'http://localhost:5173' : undefined),
  
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Google OAuth Settings
  GOOGLE_CLIENT_ID: z.string().optional().refine(val => !val || !knownPlaceholders.some(ph => val.includes(ph)), {
    message: 'GOOGLE_CLIENT_ID cannot contain placeholders'
  }),
  GOOGLE_CLIENT_SECRET: z.string().optional().refine(val => !val || !knownPlaceholders.some(ph => val.includes(ph)), {
    message: 'GOOGLE_CLIENT_SECRET cannot contain placeholders'
  }),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // SMTP Settings
  EMAIL_USER: z.string().email().optional().refine(val => !val || !knownPlaceholders.some(ph => val.includes(ph)), {
    message: 'EMAIL_USER cannot contain placeholders'
  }),
  EMAIL_PASS: z.string().optional().refine(val => !val || !knownPlaceholders.some(ph => val.includes(ph)), {
    message: 'EMAIL_PASS cannot contain placeholders'
  }),

  // AI Configurations
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
