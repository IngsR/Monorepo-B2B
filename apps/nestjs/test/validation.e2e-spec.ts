import { IsEmail, IsString } from 'class-validator';
import { Body, Controller, INestApplication, Module, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CommonModule } from '../src/common/common.module.js';
import { ErrorCode } from '../src/common/constants/error-codes.js';

class SampleDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;
}

@Controller('sample')
class SampleController {
  @Post()
  create(@Body() body: SampleDto): SampleDto {
    return body;
  }
}

@Module({
  imports: [CommonModule],
  controllers: [SampleController],
})
class SampleModule {}

describe('Validation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SampleModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unknown fields', async () => {
    const response = await request(app.getHttpServer()).post('/sample').send({
      email: 'admin@scrapbid.test',
      name: 'Admin',
      extra: true,
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('wraps a valid request in the success envelope', async () => {
    const response = await request(app.getHttpServer()).post('/sample').send({
      email: 'admin@scrapbid.test',
      name: 'Admin',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        email: 'admin@scrapbid.test',
        name: 'Admin',
      },
      message: 'Operation successful',
    });
  });
});
