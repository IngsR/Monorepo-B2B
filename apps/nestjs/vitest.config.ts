import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_NAME: 'scrapbid',
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1d',
      CORS_ORIGIN: 'http://localhost:4200',
    },
  },
});
