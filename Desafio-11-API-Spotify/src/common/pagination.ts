import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function buildPage<T>(data: T[], total: number, p: PaginationQuery): Paginated<T> {
  return {
    data,
    meta: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) },
  };
}

export async function paginate<E extends ObjectLiteral>(
  qb: SelectQueryBuilder<E>,
  p: PaginationQuery,
): Promise<Paginated<E>> {
  const [rows, total] = await qb.skip((p.page - 1) * p.limit).take(p.limit).getManyAndCount();
  return buildPage(rows, total, p);
}
