import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

// ─── Known placeholder values that must never be used in production ───────────
const KNOWN_PLACEHOLDERS = [
  'replace_with_at_least_32_character_long_secure_random_key_1',
  'replace_with_at_least_32_character_long_secure_random_key_2',
  'gsk_replace_with_your_groq_api_secret_key',
  'your_google_client_id.apps.googleusercontent.com',
  'your_google_client_secret',
  'your_email@gmail.com',
  'your_email_app_password',
  'changeme',
  'example',
  'placeholder',
];

const notPlaceholder = (ctx) => (val) => {
  if (!val) return true;
  if (KNOWN_PLACEHOLDERS.some(ph => val.toLowerCase().includes(ph.toLowerCase()))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Value is a known placeholder — replace with a real secret' });
    return z.NEVER;
  }
  return val;
};

// Production-grade secret: at least 32 chars and not a placeholder
const productionSecretSchema = z.string()
  .min(32, 'Secrets must be at least 32 characters long')
  .transform((val, ctx) => notPlaceholder(ctx)(val));

// Boolean-string helper: accepts "true" / "false" / "1" / "0"
const boolStr = (defaultVal) =>
  z.string()
    .transform(v => v === 'true' || v === '1')
    .default(defaultVal ? 'true' : 'false');

// ─── Schema definition ────────────────────────────────────────────────────────
const envSchema = z.object({
  // ── Runtime ─────────────────────────────────────────────────────────────────
  PORT:      z.string().transform(v => parseInt(v, 10)).default('5000'),
  NODE_ENV:  z.enum(['development', 'production', 'test']).default('development'),
  APP_VERSION: z.string().default('1.0.0'),

  // ── Database ─────────────────────────────────────────────────────────────────
  MONGO_URI: z.string()
    .url('MONGO_URI must be a valid MongoDB connection URL')
    .default(isTest ? 'mongodb://localhost:27017/ai-study-planner-tests' : undefined),

  // ── JWT secrets ──────────────────────────────────────────────────────────────
  JWT_SECRET: isTest
    ? z.string().min(32, 'JWT_SECRET must be at least 32 chars').default('ci_test_jwt_access_secret_32chars_long_ok')
    : productionSecretSchema,

  JWT_REFRESH_SECRET: isTest
    ? z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars').default('ci_test_jwt_refresh_secret_32chars_long_ok')
    : productionSecretSchema,

  // ── Groq AI ──────────────────────────────────────────────────────────────────
  GROQ_API_KEY: z.string().min(10, 'GROQ_API_KEY is required')
    .refine(val => isTest || !KNOWN_PLACEHOLDERS.some(ph => val.includes(ph)), {
      message: 'GROQ_API_KEY cannot be a placeholder'
    })
    .default(isTest ? 'gsk_fakekeyforcitesting00000000000000000000000' : undefined),

  AI_MODEL:          z.string().default('llama-3.1-8b-instant'),
  AI_INPUT_COST_1M:  z.string().transform(v => parseFloat(v)).default('0.05'),
  AI_OUTPUT_COST_1M: z.string().transform(v => parseFloat(v)).default('0.08'),

  // ── CORS & client ────────────────────────────────────────────────────────────
  CLIENT_URL:      z.string().url('CLIENT_URL must be a valid URL')
    .default(isTest ? 'http://localhost:5173' : undefined),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // ── Cookie ───────────────────────────────────────────────────────────────────
  COOKIE_DOMAIN: z.string().optional(),   // e.g. ".yourdomain.com" for cross-subdomain cookies

  // ── Feature flags ────────────────────────────────────────────────────────────
  ENABLE_EMAIL:       boolStr(!isTest),   // disable email in tests by default
  ENABLE_GOOGLE_OAUTH: boolStr(false),    // opt-in

  // ── SMTP / Email ─────────────────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),       // e.g. "smtp.gmail.com"
  SMTP_PORT: z.string().transform(v => v ? parseInt(v, 10) : 587).default('587'),
  SMTP_FROM: z.string().email('SMTP_FROM must be a valid email address').optional(),
  EMAIL_USER: z.string().email('EMAIL_USER must be a valid email').optional()
    .refine(val => !val || !KNOWN_PLACEHOLDERS.some(ph => val.includes(ph)), {
      message: 'EMAIL_USER cannot be a placeholder'
    }),
  EMAIL_PASS: z.string().optional()
    .refine(val => !val || !KNOWN_PLACEHOLDERS.some(ph => val.includes(ph)), {
      message: 'EMAIL_PASS cannot be a placeholder'
    }),

  // ── Google OAuth (only required when ENABLE_GOOGLE_OAUTH=true) ──────────────
  GOOGLE_CLIENT_ID: z.string().optional()
    .refine(val => !val || !KNOWN_PLACEHOLDERS.some(ph => val.includes(ph)), {
      message: 'GOOGLE_CLIENT_ID cannot be a placeholder'
    }),
  GOOGLE_CLIENT_SECRET: z.string().optional()
    .refine(val => !val || !KNOWN_PLACEHOLDERS.some(ph => val.includes(ph)), {
      message: 'GOOGLE_CLIENT_SECRET cannot be a placeholder'
    }),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
});

// ─── Parse & validate at startup ─────────────────────────────────────────────
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌  Environment validation failed — server cannot start safely:\n');
  const fmt = parsed.error.format();
  Object.entries(fmt).forEach(([key, val]) => {
    if (key === '_errors') return;
    const msgs = val?._errors ?? [];
    if (msgs.length) console.error(`  ${key}: ${msgs.join('; ')}`);
  });
  console.error('');
  process.exit(1);
}

export const env = parsed.data;
