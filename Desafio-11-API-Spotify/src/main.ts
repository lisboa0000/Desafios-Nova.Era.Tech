import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { configureApp, createAppModule } from './app.module';

async function bootstrap() {
  mkdirSync('data', { recursive: true });
  const app = await NestFactory.create(createAppModule(process.env.DB_FILE ?? 'data/spotify.db'));
  configureApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}`);
}
bootstrap();
