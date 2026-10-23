import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { mysqlOptions } from './database.config';

export default new DataSource(mysqlOptions(process.env));
