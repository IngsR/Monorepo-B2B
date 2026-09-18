import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS_ORIGIN accepts a comma-separated list so local development and the
  // deployed frontend can both be allowed at once (e.g.
  // "http://localhost:3000,https://bidforge.vercel.app"). "*" allows any
  // origin but cannot be combined with credentials, so it is handled
  // separately.
  const rawOrigin = config.get<string>('CORS_ORIGIN', '');
  const userOrigins = rawOrigin
    .split(',')
    .map((value) => value.trim())
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

  const port = config.get<number>('PORT', 8000);
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

await bootstrap();
