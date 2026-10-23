import {
  Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param,
  ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Public, Roles } from '../common/auth.decorators';
import { Category, Product } from '../database/entities';

export class CategoryDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  list() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async get(id: number) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Categoria nao encontrada');
    return c;
  }

  async create(dto: CategoryDto) {
    await this.assertNameFree(dto.name);
    return this.repo.save(this.repo.create({ name: dto.name }));
  }

  async update(id: number, dto: CategoryDto) {
    const c = await this.get(id);
    if (c.name !== dto.name) await this.assertNameFree(dto.name);
    c.name = dto.name;
    return this.repo.save(c);
  }

  async remove(id: number) {
    await this.get(id);
    if (await this.products.count({ where: { categoryId: id } })) {
      throw new ConflictException('Categoria possui produtos e nao pode ser removida');
    }
    await this.repo.delete(id);
  }

  private async assertNameFree(name: string) {
    if (await this.repo.findOne({ where: { name } })) throw new ConflictException('Categoria ja existe');
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Public() @Get()
  list() {
    return this.service.list();
  }

  @Public() @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Roles('admin') @Post()
  create(@Body() dto: CategoryDto) {
    return this.service.create(dto);
  }

  @Roles('admin') @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin') @Delete(':id') @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
