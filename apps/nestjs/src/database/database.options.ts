import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function createTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  return {
    type: 'postgres',
    host: config.get<string>('DATABASE_HOST'),
    port: config.get<number>('DATABASE_PORT'),
    username: config.get<string>('DATABASE_USER'),
    password: config.get<string>('DATABASE_PASSWORD', ''),
    database: config.get<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: false,
    logging: nodeEnv === 'development' ? ['error'] : false,
  };
}
