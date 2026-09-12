import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuctionsModule } from './auctions/auctions.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BiddersModule } from './bidders/bidders.module.js';
import { BidsModule } from './bids/bids.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ProductsModule } from './products/products.module.js';
import { UsersModule } from './users/users.module.js';
import { VendorsModule } from './vendors/vendors.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
    UsersModule,
    VendorsModule,
    BiddersModule,
    CategoriesModule,
    ProductsModule,
    AuctionsModule,
    BidsModule,
    AuthModule,
  ],
})
export class AppModule {}
