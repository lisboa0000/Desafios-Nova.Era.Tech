import {
  Body,
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
import { buildPage, PaginationQuery } from '../common/pagination';
import { Album, PlaylistTrack, Track } from '../entities/entities';

export class CreateTrackDto {
  @IsString() @IsNotEmpty() @MaxLength(150) title: string;
  @IsInt() @Min(1) @Max(36000) durationSeconds: number;
  @IsOptional() @IsString() @MaxLength(60) genre?: string;
  @IsInt() @Min(1) albumId: number;
}
export class UpdateTrackDto extends PartialType(CreateTrackDto) {}

export class ListTracksQuery extends PaginationQuery {
  /** busca por nome da faixa OU do artista */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() genre?: string;
  @IsOptional() @Type(() => Number) @IsInt() albumId?: number;
  @IsOptional() @Type(() => Number) @IsInt() artistId?: number;
}
export class RankingQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 10;
}
export class RecommendationQuery extends PaginationQuery {
  @IsString() @IsNotEmpty() genre: string;
}

export function toTrackView(t: Track, extra: Record<string, unknown> = {}) {
  return {
    id: t.id,
    title: t.title,
    durationSeconds: t.durationSeconds,
    genre: t.genre,
    album: { id: t.album.id, title: t.album.title, releaseYear: t.album.releaseYear },
    artist: { id: t.album.artist.id, name: t.album.artist.name },
    ...extra,
  };
}

@Injectable()
export class TracksService {
  constructor(
    @InjectRepository(Track) private tracks: Repository<Track>,
    @InjectRepository(Album) private albums: Repository<Album>,
    @InjectRepository(PlaylistTrack) private items: Repository<PlaylistTrack>,
  ) {}

  private base() {
    return this.tracks
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.album', 'al')
      .innerJoinAndSelect('al.artist', 'ar');
  }

  async create(dto: CreateTrackDto) {
    await this.assertAlbum(dto.albumId);
    const saved = await this.tracks.save(this.tracks.create({ genre: null, ...dto }));
    return this.findOne(saved.id);
  }

  async list(q: ListTracksQuery) {
    const qb = this.base().orderBy('t.title').addOrderBy('t.id');
    if (q.q) qb.andWhere('(t.title LIKE :q OR ar.name LIKE :q)', { q: `%${q.q}%` });
    if (q.genre) qb.andWhere('t.genre = :g COLLATE NOCASE', { g: q.genre });
    if (q.albumId) qb.andWhere('t.albumId = :alb', { alb: q.albumId });
    if (q.artistId) qb.andWhere('al.artistId = :art', { art: q.artistId });
    const [rows, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return buildPage(rows.map((t) => toTrackView(t)), total, q);
  }

  async findOne(id: number) {
    const t = await this.base().where('t.id = :id', { id }).getOne();
    if (!t) throw new NotFoundException(`Faixa ${id} não encontrada`);
    return toTrackView(t);
  }

  async update(id: number, dto: UpdateTrackDto) {
    await this.findOne(id);
    if (dto.albumId) await this.assertAlbum(dto.albumId);
    await this.tracks.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.items.delete({ trackId: id }); // sai de todas as playlists
    await this.tracks.delete(id);
  }

  /** Faixas mais adicionadas em playlists. */
  async ranking(limit: number) {
    const rows = await this.items
      .createQueryBuilder('pt')
      .select('pt.trackId', 'trackId')
      .addSelect('COUNT(*)', 'addedCount')
      .groupBy('pt.trackId')
      .orderBy('addedCount', 'DESC')
      .addOrderBy('pt.trackId', 'ASC')
      .limit(limit)
      .getRawMany<{ trackId: number; addedCount: number }>();
    const data = [];
    for (const r of rows) data.push({ ...(await this.findOne(Number(r.trackId))), addedCount: Number(r.addedCount) });
    return { data };
  }

  /** Recomendação simples: faixas do gênero, das mais para as menos adicionadas em playlists. */
  async recommend(q: RecommendationQuery) {
    const qb = this.base()
      .addSelect((sub) => sub.select('COUNT(*)').from(PlaylistTrack, 'x').where('x.trackId = t.id'), 'popularity')
      .where('t.genre = :g COLLATE NOCASE', { g: q.genre })
      .orderBy('popularity', 'DESC')
      .addOrderBy('t.title', 'ASC');
    const total = await qb.getCount();
    const { entities, raw } = await qb.offset((q.page - 1) * q.limit).limit(q.limit).getRawAndEntities();
    const data = entities.map((t, i) => toTrackView(t, { addedCount: Number(raw[i].popularity) }));
    return buildPage(data, total, q);
  }

  private async assertAlbum(id: number) {
    if (!(await this.albums.exist({ where: { id } })))
      throw new NotFoundException(`Álbum ${id} não encontrado`);
  }
}

@Controller()
export class TracksController {
  constructor(private s: TracksService) {}

  @Post('tracks') async create(@Body() dto: CreateTrackDto) { return { data: await this.s.create(dto) }; }
  @Get('tracks') list(@Query() q: ListTracksQuery) { return this.s.list(q); }
  @Get('tracks/ranking') ranking(@Query() q: RankingQuery) { return this.s.ranking(q.limit); }
  @Get('tracks/:id') async one(@Param('id', ParseIntPipe) id: number) { return { data: await this.s.findOne(id) }; }
  @Patch('tracks/:id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTrackDto) {
    return { data: await this.s.update(id, dto) };
  }
  @Delete('tracks/:id') @HttpCode(204) async remove(@Param('id', ParseIntPipe) id: number) { await this.s.remove(id); }

  /** Busca por nome de faixa/artista (atalho de GET /tracks?q=). */
  @Get('search') search(@Query() q: ListTracksQuery) { return this.s.list(q); }
  @Get('recommendations') recommend(@Query() q: RecommendationQuery) { return this.s.recommend(q); }
}
