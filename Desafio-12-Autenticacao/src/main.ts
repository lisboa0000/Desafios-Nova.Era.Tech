import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { configureApp, createAppModule } from './app.module';
import { optionsFromEnv } from './auth';

async function bootstrap() {
  mkdirSync('data', { recursive: true });
  const app = await NestFactory.create(createAppModule(optionsFromEnv(), process.env.DB_FILE ?? 'data/auth.db'));
  configureApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}`);
}
bootstrap();
