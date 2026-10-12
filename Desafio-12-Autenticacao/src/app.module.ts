import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AUTH_OPTIONS, AdminController, AuthController, AuthGuard, AuthOptions, AuthService, MeController, RolesGuard,
} from './auth';
import { User } from './entities';

/** `location` vazio = banco em memória (usado nos testes). */
export function createAppModule(options: AuthOptions, location?: string) {
  @Module({
    imports: [
      TypeOrmModule.forRoot({ type: 'sqljs', location, autoSave: !!location, entities: [User], synchronize: true }),
      TypeOrmModule.forFeature([User]),
    ],
    controllers: [AuthController, MeController, AdminController],
    providers: [
      AuthService,
      { provide: AUTH_OPTIONS, useValue: options },
      // ordem importa: autentica primeiro, depois checa o perfil
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
  class AppModule {}
  return AppModule;
}

export function configureApp(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
