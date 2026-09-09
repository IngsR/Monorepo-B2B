import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { TransformInterceptor } from './interceptors/transform.interceptor.js';
import { createValidationPipe } from './pipes/validation.pipe.js';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_PIPE,
      useFactory: createValidationPipe,
    },
  ],
})
export class CommonModule {}
