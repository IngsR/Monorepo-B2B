import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator.js';
import { HEALTH_SERVICE_NAME } from './health.constants.js';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @SkipResponseWrap()
  async check(): Promise<{ status: 'ok'; service: string }> {
    await this.healthService.assertDatabase();

    return {
      status: 'ok',
      service: HEALTH_SERVICE_NAME,
    };
  }
}
