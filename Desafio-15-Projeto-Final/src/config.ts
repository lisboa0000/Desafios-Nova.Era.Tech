import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mysqlOptions } from './database/database.config';

export interface AppConfig {
  jwtSecret: string;
  accessTtl: string | number;
  bcryptRounds: number;
  logRequests: boolean;
  db: TypeOrmModuleOptions;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.JWT_SECRET;
  if (!secret && env.NODE_ENV === 'production') throw new Error('JWT_SECRET e obrigatorio em producao');
  return {
    jwtSecret: secret ?? 'dev-only-secret-change-me',
    accessTtl: env.ACCESS_TOKEN_TTL ?? '1h',
    bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 12),
    logRequests: env.LOG_REQUESTS !== 'false',
    db: mysqlOptions(env),
  };
}
