import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PRE_SCANNER_USER_AGENT: z.string().min(5).default('PRE-Scanner/0.1 (+https://example.com/pre-scan-policy)'),
  PRE_MAX_PAGES: z.coerce.number().int().positive().default(25),
  PRE_MAX_PRODUCTS: z.coerce.number().int().positive().default(100),
  PRE_MAX_COLLECTIONS: z.coerce.number().int().positive().default(50),
  PRE_MAX_CONCURRENCY: z.coerce.number().int().positive().max(3).default(3),
  PRE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  PRE_SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  PRE_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(10485760),
  PRE_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
  PRE_ALLOWED_PORTS: z.string().default('80,443'),
  LOG_LEVEL: z.string().default('info')
});
export const env = schema.parse(process.env);
