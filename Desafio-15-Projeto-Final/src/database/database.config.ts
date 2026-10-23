import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

export function mysqlOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USER ?? 'marketplace',
    password: env.DB_PASSWORD ?? 'marketplace',
    database: env.DB_NAME ?? 'marketplace',
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: true,
    synchronize: false,
  };
}
