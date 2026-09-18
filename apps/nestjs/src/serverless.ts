import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from './app.module.js';

// ─── DEBUG HELPER ─────────────────────────────────────────────────────────────
function dbg(section: string, msg: string, data?: unknown) {
  const payload = data !== undefined ? JSON.stringify(data, null, 2) : '';
  console.log(`\n[DEBUG:${section}] ${msg}${payload ? '\n' + payload : ''}`);
}

const server = express();

let initialized = false;

async function createApp() {
  // ── STEP 1: ENV CHECK ────────────────────────────────────────────────────
  dbg('ENV', 'Checking required environment variables...');
  const envReport = {
    NODE_ENV: process.env.NODE_ENV ?? '❌ MISSING',
    DATABASE_URL: process.env.DATABASE_URL ? '✅ SET (hidden)' : '❌ MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ SET (hidden)' : '❌ MISSING',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '❌ MISSING',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? '❌ MISSING',
  };
  dbg('ENV', 'Environment variable status:', envReport);

  const missingRequired = ['DATABASE_URL', 'JWT_SECRET'].filter(
    (key) => !process.env[key],
  );
  if (missingRequired.length > 0) {
    dbg('ENV', `❌ FATAL: Missing required env vars: ${missingRequired.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  // ── STEP 2: NESTJS INIT ──────────────────────────────────────────────────
  dbg('INIT', 'Starting NestJS app with ExpressAdapter...');
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  try {
    app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn', 'log'],
    });
    dbg('INIT', '✅ NestJS app created successfully');
  } catch (err: any) {
    dbg('INIT', '❌ FATAL: NestFactory.create failed', {
      message: err?.message,
      hint: 'Likely a module import error, DB connection, or missing provider',
      stack: err?.stack?.split('\n').slice(0, 8),
    });
    throw err;
  }

  const config = app.get(ConfigService);
  const logger = new Logger('Serverless');

  // ── STEP 3: GLOBAL PREFIX & VERSIONING ───────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  dbg('ROUTING', 'Global prefix set: /api | Versioning: URI with default /v1');
  dbg('ROUTING', 'Example route: /api/v1/auth/login');

  // ── STEP 4: CORS ─────────────────────────────────────────────────────────
  const rawOrigin = config.get<string>('CORS_ORIGIN', '');
  const userOrigins = rawOrigin.split(',').map((v) => v.trim()).filter(Boolean);
  const defaultOrigins = ['http://localhost:3000'];
  const allowlist = Array.from(new Set([...defaultOrigins, ...userOrigins]));
  dbg('CORS', 'Allowed origins:', allowlist);

  app.enableCors({
    origin: userOrigins.includes('*') ? true : allowlist,
    credentials: true,
  });

  // ── STEP 5: SWAGGER ───────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ScrapBid Auction API')
    .setDescription('REST API untuk sistem lelang (auction) ScrapBid.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  dbg('SWAGGER', '✅ Swagger docs available at /api/docs');

  // ── STEP 6: APP INIT ──────────────────────────────────────────────────────
  dbg('INIT', 'Calling app.init() — connecting to database...');
  try {
    await app.init();
    initialized = true;
    dbg('INIT', '✅ NestJS fully initialized — handler is ready');
    logger.log('Serverless handler initialized');
  } catch (err: any) {
    dbg('INIT', '❌ FATAL: app.init() failed', {
      message: err?.message,
      hint: 'Most likely cause: DATABASE_URL is wrong or DB is not reachable from Vercel IP',
      stack: err?.stack?.split('\n').slice(0, 10),
    });
    throw err;
  }
}

// Initialize once — Vercel reuses instance across warm invocations
let initPromise: Promise<void> | null = null;
function getAppReady() {
  if (!initPromise) {
    initPromise = createApp();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  // ── LOG EVERY INCOMING REQUEST ────────────────────────────────────────────
  dbg('REQUEST', `→ ${req.method} ${req.url}`, {
    host: req.headers?.host,
    origin: req.headers?.origin,
    'content-type': req.headers?.['content-type'],
  });

  try {
    if (!initialized) {
      dbg('COLD_START', 'First request — running cold start initialization...');
      await getAppReady();
    } else {
      dbg('WARM', 'App already initialized — skipping cold start');
    }
  } catch (err: any) {
    dbg('ERROR', '❌ Initialization failed — returning 500', {
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 5),
    });
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        message: 'Server failed to initialize',
        error: err?.message || String(err),
        tip: 'Open Vercel dashboard → Functions → Logs and search [DEBUG:] to find root cause',
      }),
    );
    return;
  }

  dbg('REQUEST', `Forwarding to NestJS Express: ${req.method} ${req.url}`);

  return new Promise<void>((resolve, reject) => {
    res.on('finish', () => {
      dbg('RESPONSE', `← ${req.method} ${req.url} | status: ${res.statusCode}`);
      resolve();
    });
    res.on('close', resolve);
    res.on('error', (err: any) => {
      dbg('RESPONSE', `❌ Stream error for ${req.url}`, { message: err?.message });
      reject(err);
    });
    server(req, res);
  });
}