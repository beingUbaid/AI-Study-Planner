import { z } from 'zod';
import { URL } from 'node:url';

if (process.env.JEST_WORKER_ID) {
  process.env.NODE_ENV = 'test';
}

const isTest = process.env.NODE_ENV === 'test';

// Boolean-string helper: accepts "true" / "false" / "1" / "0"
const boolStr = (defaultVal) =>
  z.string()
    .transform(v => v === 'true' || v === '1')
    .default(defaultVal ? 'true' : 'false');

// ─── Schema definition ────────────────────────────────────────────────────────
const envSchema = z.object({
  // ── Runtime ─────────────────────────────────────────────────────────────────
  PORT: z.string().transform(v => parseInt(v, 10)).refine(v => !isNaN(v) && v >= 0 && v <= 65535, 'PORT must be a valid port number').default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_VERSION: z.string().default('1.0.0'),
  GIT_COMMIT_SHA: z.string().optional(),

  // ── Database ─────────────────────────────────────────────────────────────────
  MONGO_URI: z.string()
    .url('MONGO_URI must be a valid MongoDB connection URL')
    .default(isTest ? 'mongodb://localhost:27017/ai-study-planner-tests' : 'mongodb://localhost:27017/studyplanner'),

  // ── JWT secrets ──────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().default(isTest ? 'ci_test_jwt_access_secret_32chars_long_ok' : 'replace_with_at_least_32_character_long_secure_random_key_1'),
  JWT_REFRESH_SECRET: z.string().default(isTest ? 'ci_test_jwt_refresh_secret_32chars_long_ok' : 'replace_with_at_least_32_character_long_secure_random_key_2'),

  // ── Groq AI ──────────────────────────────────────────────────────────────────
  GROQ_API_KEY: z.string().default(isTest ? 'gsk_fakekeyforcitesting00000000000000000000000' : 'gsk_replace_with_your_groq_api_secret_key'),
  AI_MODEL: z.string().default('llama-3.1-8b-instant'),
  AI_INPUT_COST_1M: z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v) && v >= 0, 'AI_INPUT_COST_1M must be non-negative').default('0.05'),
  AI_OUTPUT_COST_1M: z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v) && v >= 0, 'AI_OUTPUT_COST_1M must be non-negative').default('0.08'),

  // ── CORS & client ────────────────────────────────────────────────────────────
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL').default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().transform(val => val.split(',').map(o => o.trim())).refine(urls => urls.every(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }), 'ALLOWED_ORIGINS must be a comma-separated list of valid URLs').default('http://localhost:5173'),

  // ── Cookie ───────────────────────────────────────────────────────────────────
  COOKIE_DOMAIN: z.string().optional(),

  // ── Feature flags ────────────────────────────────────────────────────────────
  EMAIL_ENABLED: boolStr(!isTest),
  ENABLE_EMAIL: boolStr(!isTest).optional(),
  GOOGLE_OAUTH_ENABLED: boolStr(false),
  ENABLE_GOOGLE_OAUTH: boolStr(false).optional(),

  // ── SMTP / Email ─────────────────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(v => v ? parseInt(v, 10) : 587).default('587'),
  SMTP_SECURE: boolStr(false),
  SMTP_FROM: z.string().email('SMTP_FROM must be a valid email address').optional().default(isTest ? 'test-sender@example.com' : undefined),
  EMAIL_USER: z.string().email('EMAIL_USER must be a valid email').optional().default(isTest ? 'test-user@example.com' : undefined),
  EMAIL_PASS: z.string().optional().default(isTest ? 'test-password' : undefined),

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional().default(isTest ? 'test-client-id' : undefined),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(isTest ? 'test-client-secret' : undefined),
  GOOGLE_CALLBACK_URL: z.string().optional().default(isTest ? 'http://localhost:5000/api/auth/google/callback' : undefined)
}).superRefine((data, ctx) => {
  // Determine if email/oauth are enabled
  const emailEnabled = data.EMAIL_ENABLED || data.ENABLE_EMAIL;
  const oauthEnabled = data.GOOGLE_OAUTH_ENABLED || data.ENABLE_GOOGLE_OAUTH;

  if (emailEnabled) {
    if (!data.EMAIL_USER) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_USER'], message: 'EMAIL_USER is required when email is enabled' });
    }
    if (!data.EMAIL_PASS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_PASS'], message: 'EMAIL_PASS is required when email is enabled' });
    }
    if (!data.SMTP_FROM) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_FROM'], message: 'SMTP_FROM is required when email is enabled' });
    }
  }

  if (oauthEnabled) {
    if (!data.GOOGLE_CLIENT_ID) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_ID'], message: 'GOOGLE_CLIENT_ID is required when Google OAuth is enabled' });
    }
    if (!data.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_SECRET'], message: 'GOOGLE_CLIENT_SECRET is required when Google OAuth is enabled' });
    }
    if (!data.GOOGLE_CALLBACK_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CALLBACK_URL'], message: 'GOOGLE_CALLBACK_URL is required when Google OAuth is enabled' });
    } else {
      try {
        new URL(data.GOOGLE_CALLBACK_URL);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CALLBACK_URL'], message: 'GOOGLE_CALLBACK_URL must be a valid URL' });
      }
    }
  }

  // Reject placeholder secrets in production
  if (data.NODE_ENV === 'production') {
    const sensitiveSecrets = [
      { key: 'JWT_SECRET', val: data.JWT_SECRET, minLen: 32 },
      { key: 'JWT_REFRESH_SECRET', val: data.JWT_REFRESH_SECRET, minLen: 32 },
      { key: 'GROQ_API_KEY', val: data.GROQ_API_KEY, minLen: 10 }
    ];

    sensitiveSecrets.forEach(({ key, val, minLen }) => {
      if (!val) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required in production` });
        return;
      }
      if (val.length < minLen) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} must be at least ${minLen} characters long` });
      }
      const lower = val.toLowerCase();
      const hasPlaceholder = ['replace_with', 'your_', 'example', 'test_secret', 'changeme', 'placeholder'].some(ph => lower.includes(ph));
      if (hasPlaceholder) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} contains a known placeholder value and is unsafe for production` });
      }
    });

    const verifyPlaceholders = [
      { key: 'EMAIL_USER', val: data.EMAIL_USER },
      { key: 'EMAIL_PASS', val: data.EMAIL_PASS },
      { key: 'GOOGLE_CLIENT_ID', val: data.GOOGLE_CLIENT_ID },
      { key: 'GOOGLE_CLIENT_SECRET', val: data.GOOGLE_CLIENT_SECRET }
    ];
    verifyPlaceholders.forEach(({ key, val }) => {
      if (val) {
        const lower = val.toLowerCase();
        const hasPlaceholder = ['replace_with', 'your_', 'example', 'test_secret', 'changeme', 'placeholder'].some(ph => lower.includes(ph));
        if (hasPlaceholder) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} cannot contain placeholder values in production` });
        }
      }
    });
  }
});

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

// Normalize feature flags
const rawEnv = parsed.data;
export const env = {
  ...rawEnv,
  EMAIL_ENABLED: rawEnv.EMAIL_ENABLED || rawEnv.ENABLE_EMAIL || false,
  ENABLE_EMAIL: rawEnv.EMAIL_ENABLED || rawEnv.ENABLE_EMAIL || false,
  GOOGLE_OAUTH_ENABLED: rawEnv.GOOGLE_OAUTH_ENABLED || rawEnv.ENABLE_GOOGLE_OAUTH || false,
  ENABLE_GOOGLE_OAUTH: rawEnv.GOOGLE_OAUTH_ENABLED || rawEnv.ENABLE_GOOGLE_OAUTH || false
};
