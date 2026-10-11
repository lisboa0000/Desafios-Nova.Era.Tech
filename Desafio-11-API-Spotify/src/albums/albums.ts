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
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { paginate, PaginationQuery } from '../common/pagination';
import { Album, Artist, Track } from '../entities/entities';

export class CreateAlbumDto {
  @IsString() @IsNotEmpty() @MaxLength(150) title: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) releaseYear?: number;
  @IsInt() @Min(1) artistId: number;
}
export class UpdateAlbumDto extends PartialType(CreateAlbumDto) {}
export class ListAlbumsQuery extends PaginationQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() artistId?: number;
}

@Injectable()
export class AlbumsService {
  constructor(
    @InjectRepository(Album) private albums: Repository<Album>,
    @InjectRepository(Artist) private artists: Repository<Artist>,
    @InjectRepository(Track) private tracks: Repository<Track>,
  ) {}

  async create(dto: CreateAlbumDto) {
    await this.assertArtist(dto.artistId);
    const saved = await this.albums.save(this.albums.create({ releaseYear: null, ...dto }));
    return this.findOne(saved.id);
  }

  list(q: ListAlbumsQuery) {
    const qb = this.albums.createQueryBuilder('al').leftJoinAndSelect('al.artist', 'ar').orderBy('al.title');
    if (q.q) qb.andWhere('al.title LIKE :q', { q: `%${q.q}%` });
    if (q.artistId) qb.andWhere('al.artistId = :aid', { aid: q.artistId });
    return paginate(qb, q);
  }

  async findOne(id: number) {
    const album = await this.albums.findOne({ where: { id }, relations: { artist: true, tracks: true } });
    if (!album) throw new NotFoundException(`Álbum ${id} não encontrado`);
    return album;
  }

  async update(id: number, dto: UpdateAlbumDto) {
    await this.findOne(id);
    if (dto.artistId) await this.assertArtist(dto.artistId);
    await this.albums.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    if (await this.tracks.count({ where: { albumId: id } }))
      throw new ConflictException('Álbum possui faixas; remova-as antes');
    await this.albums.delete(id);
  }

  private async assertArtist(id: number) {
    if (!(await this.artists.exist({ where: { id } })))
      throw new NotFoundException(`Artista ${id} não encontrado`);
  }
}

@Controller('albums')
export class AlbumsController {
  constructor(private s: AlbumsService) {}

  @Post() async create(@Body() dto: CreateAlbumDto) { return { data: await this.s.create(dto) }; }
  @Get() list(@Query() q: ListAlbumsQuery) { return this.s.list(q); }
  @Get(':id') async one(@Param('id', ParseIntPipe) id: number) { return { data: await this.s.findOne(id) }; }
  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAlbumDto) {
    return { data: await this.s.update(id, dto) };
  }
  @Delete(':id') @HttpCode(204) async remove(@Param('id', ParseIntPipe) id: number) { await this.s.remove(id); }
}
