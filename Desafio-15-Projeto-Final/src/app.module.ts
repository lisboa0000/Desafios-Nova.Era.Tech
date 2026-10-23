import { DynamicModule, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories';
import { AppConfig } from './config';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { requestLogger } from './common/request-logger';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products';

@Module({})
export class AppModule {
  static forRoot(config: Pick<AppConfig, 'db' | 'jwtSecret' | 'accessTtl' | 'bcryptRounds'>): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRoot(config.db),
        AuthModule.forRoot({ jwtSecret: config.jwtSecret, accessTtl: config.accessTtl, bcryptRounds: config.bcryptRounds }),
        CategoriesModule,
        ProductsModule,
        OrdersModule,
      ],
      controllers: [HealthController],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    };
  }
}

export function configureApp(app: INestApplication, logRequests = false) {
  app.use(requestLogger(logRequests));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
