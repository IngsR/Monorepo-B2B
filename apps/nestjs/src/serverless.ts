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
  const allowlist = rawOrigin.split(',').map((v) => v.trim()).filter(Boolean);
  app.enableCors({
    origin: allowlist.length === 0 || allowlist.includes('*') ? true : allowlist,
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
const ready = createApp();

export default async function handler(req: any, res: any) {
  if (!initialized) await ready;
  server(req, res);
}