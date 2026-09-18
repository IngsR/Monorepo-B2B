import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from './app.module.js';

const server = express();

let initialized = false;

async function createApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const rawOrigin = config.get<string>('CORS_ORIGIN', '');
  const userOrigins = rawOrigin
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const defaultOrigins = [
    'http://localhost:3000',
  ];
  const allowlist = Array.from(new Set([...defaultOrigins, ...userOrigins]));

  app.enableCors({
    origin: userOrigins.includes('*') ? true : allowlist,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ScrapBid Auction API')
    .setDescription('REST API untuk sistem lelang (auction) ScrapBid.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  initialized = true;
  logger.log('Serverless handler initialized');
}

// Initialize once (Vercel reuses the instance across warm invocations)
let initPromise: Promise<void> | null = null;
function getAppReady() {
  if (!initPromise) {
    initPromise = createApp();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  try {
    if (!initialized) {
      await getAppReady();
    }
  } catch (err: any) {
    console.error('Failed to initialize NestJS serverless app:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error during initialization',
        error: err?.message || String(err),
      }),
    );
    return;
  }

  return new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    server(req, res);
  });
}