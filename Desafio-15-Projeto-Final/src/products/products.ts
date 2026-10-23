import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { Public, Roles } from '../common/auth.decorators';
import { PaginationQuery, paginated } from '../common/pagination';
import { Category, Product } from '../database/entities';

export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsInt() @Min(1) @Max(100_000_000) priceCents: number;
  @IsInt() @Min(0) @Max(1_000_000) stock: number;
  @IsInt() @Min(1) categoryId: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ListProductsQuery extends PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async list(q: ListProductsQuery) {
    const where: FindOptionsWhere<Product> = { active: true };
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.search) where.name = Like(`%${q.search.replace(/[%_\\]/g, '\\$&')}%`);
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginated(rows, total, q);
  }

  async get(id: number) {
    const p = await this.repo.findOne({ where: { id, active: true } });
    if (!p) throw new NotFoundException('Produto nao encontrado');
    return p;
  }

  async create(dto: CreateProductDto) {
    await this.assertCategory(dto.categoryId);
    return this.repo.save(this.repo.create({ ...dto, description: dto.description ?? null }));
  }

  async update(id: number, dto: UpdateProductDto) {
    const p = await this.get(id);
    if (dto.categoryId !== undefined) await this.assertCategory(dto.categoryId);
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: number) {
    const p = await this.get(id);
    p.active = false;
    await this.repo.save(p);
  }

  private async assertCategory(id: number) {
    if (!(await this.categories.findOne({ where: { id } }))) throw new BadRequestException('Categoria inexistente');
  }
}

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Public() @Get()
  list(@Query() q: ListProductsQuery) {
    return this.service.list(q);
  }

  @Public() @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Roles('admin') @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Roles('admin') @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin') @Delete(':id') @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
