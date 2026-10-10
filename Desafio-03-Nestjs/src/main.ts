import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos nao declarados no DTO
      forbidNonWhitelisted: true, // erro 400 se enviar campos extras
      transform: true, // converte tipos (ex: query params)
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}`);
}
bootstrap();
