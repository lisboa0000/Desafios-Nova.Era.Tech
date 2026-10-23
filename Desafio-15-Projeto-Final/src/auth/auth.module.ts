import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities';
import { AuthController } from './auth.controller';
import { AUTH_OPTIONS, AuthOptions, AuthService } from './auth.service';
import { AuthGuard, RolesGuard } from './guards';

@Module({})
export class AuthModule {
  static forRoot(options: AuthOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [TypeOrmModule.forFeature([User])],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: AUTH_OPTIONS, useValue: options },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
      exports: [AuthService],
    };
  }
}
