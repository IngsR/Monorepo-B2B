import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origin = config.get<string>('CORS_ORIGIN');

  app.enableCors({
    origin,
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

await bootstrap();
