import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { SKIP_RESPONSE_WRAP_KEY } from '../decorators/skip-response-wrap.decorator.js';
import { TransformInterceptor } from './transform.interceptor.js';

describe('TransformInterceptor', () => {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  it('wraps a successful response', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const interceptor = new TransformInterceptor(reflector);

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ id: '1' }) }),
    );

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_RESPONSE_WRAP_KEY,
      expect.any(Array),
    );
    expect(result).toEqual({
      success: true,
      data: { id: '1' },
      message: 'Operation successful',
    });
  });

  it('skips wrapping when the handler opts out', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const interceptor = new TransformInterceptor(reflector);

    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ status: 'ok' }),
      }),
    );

    expect(result).toEqual({ status: 'ok' });
  });
});
