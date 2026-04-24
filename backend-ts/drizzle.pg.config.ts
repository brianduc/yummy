import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/pg/schema.ts',
  out: './src/db/pg/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.POSTGRES_URL ??
      'postgres://yummy:yummy@localhost:5432/yummy',
  },
  verbose: true,
  strict: true,
});
