import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createTypeOrmOptions } from './database.options.js';
import { createTestDataSource } from './test-data-source.js';

@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const isTest = process.env.NODE_ENV === 'test';

    if (isTest) {
      return {
        module: DatabaseModule,
        global: true,
        providers: [
          {
            provide: DataSource,
            useFactory: createTestDataSource,
          },
        ],
        exports: [DataSource],
      };
    }

    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: createTypeOrmOptions,
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
