import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { paginate, PaginationQuery } from '../common/pagination';
import { Album, Artist } from '../entities/entities';

export class CreateArtistDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
}
export class UpdateArtistDto extends PartialType(CreateArtistDto) {}
export class ListArtistsQuery extends PaginationQuery {
  @IsOptional() @IsString() q?: string;
}

@Injectable()
export class ArtistsService {
  constructor(
    @InjectRepository(Artist) private artists: Repository<Artist>,
    @InjectRepository(Album) private albums: Repository<Album>,
  ) {}

  async create(dto: CreateArtistDto) {
    await this.assertNameFree(dto.name);
    return this.artists.save(this.artists.create({ country: null, ...dto }));
  }

  list(q: ListArtistsQuery) {
    const qb = this.artists.createQueryBuilder('a').orderBy('a.name');
    if (q.q) qb.where('a.name LIKE :q', { q: `%${q.q}%` });
    return paginate(qb, q);
  }

  async findOne(id: number) {
    const artist = await this.artists.findOne({ where: { id }, relations: { albums: true } });
    if (!artist) throw new NotFoundException(`Artista ${id} não encontrado`);
    return artist;
  }

  async update(id: number, dto: UpdateArtistDto) {
    const artist = await this.findOne(id);
    if (dto.name && dto.name !== artist.name) await this.assertNameFree(dto.name);
    await this.artists.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    if (await this.albums.count({ where: { artistId: id } }))
      throw new ConflictException('Artista possui álbuns; remova-os antes');
    await this.artists.delete(id);
  }

  private async assertNameFree(name: string) {
    if (await this.artists.exist({ where: { name } }))
      throw new ConflictException(`Já existe um artista chamado "${name}"`);
  }
}

@Controller('artists')
export class ArtistsController {
  constructor(private s: ArtistsService) {}

  @Post() async create(@Body() dto: CreateArtistDto) { return { data: await this.s.create(dto) }; }
  @Get() list(@Query() q: ListArtistsQuery) { return this.s.list(q); }
  @Get(':id') async one(@Param('id', ParseIntPipe) id: number) { return { data: await this.s.findOne(id) }; }
  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArtistDto) {
    return { data: await this.s.update(id, dto) };
  }
  @Delete(':id') @HttpCode(204) async remove(@Param('id', ParseIntPipe) id: number) { await this.s.remove(id); }
}
