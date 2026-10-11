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
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { buildPage, PaginationQuery } from '../common/pagination';
import { Playlist, PlaylistTrack, Track } from '../entities/entities';
import { toTrackView } from '../tracks/tracks';

export class CreatePlaylistDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class UpdatePlaylistDto extends PartialType(CreatePlaylistDto) {}
export class AddTrackDto {
  @IsInt() @Min(1) trackId: number;
}

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist) private playlists: Repository<Playlist>,
    @InjectRepository(PlaylistTrack) private items: Repository<PlaylistTrack>,
    @InjectRepository(Track) private tracks: Repository<Track>,
  ) {}

  create(dto: CreatePlaylistDto) {
    return this.playlists
      .save(this.playlists.create({ description: null, ...dto }))
      .then((p) => this.summary(p));
  }

  async list(q: PaginationQuery) {
    const [rows, total] = await this.playlists.findAndCount({
      order: { name: 'ASC', id: 'ASC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return buildPage(await Promise.all(rows.map((p) => this.summary(p))), total, q);
  }

  /** Detalhe: faixas na ordem de inserção + duração total. */
  async findOne(id: number) {
    const playlist = await this.get(id);
    const rows = await this.items
      .createQueryBuilder('pt')
      .innerJoinAndSelect('pt.track', 't')
      .innerJoinAndSelect('t.album', 'al')
      .innerJoinAndSelect('al.artist', 'ar')
      .where('pt.playlistId = :id', { id })
      .orderBy('pt.position')
      .getMany();
    return {
      ...(await this.summary(playlist)),
      tracks: rows.map((pt) => toTrackView(pt.track, { position: pt.position, addedAt: pt.addedAt })),
    };
  }

  async update(id: number, dto: UpdatePlaylistDto) {
    await this.get(id);
    await this.playlists.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.get(id);
    await this.playlists.delete(id); // itens saem por cascade
  }

  async addTrack(playlistId: number, trackId: number) {
    await this.get(playlistId);
    if (!(await this.tracks.exist({ where: { id: trackId } })))
      throw new NotFoundException(`Faixa ${trackId} não encontrada`);
    if (await this.items.exist({ where: { playlistId, trackId } }))
      throw new ConflictException(`Faixa ${trackId} já está na playlist ${playlistId}`);
    const { max } = (await this.items
      .createQueryBuilder('pt')
      .select('COALESCE(MAX(pt.position), 0)', 'max')
      .where('pt.playlistId = :playlistId', { playlistId })
      .getRawOne())!;
    await this.items.save(this.items.create({ playlistId, trackId, position: Number(max) + 1 }));
    return this.findOne(playlistId);
  }

  async removeTrack(playlistId: number, trackId: number) {
    await this.get(playlistId);
    const item = await this.items.findOne({ where: { playlistId, trackId } });
    if (!item) throw new NotFoundException(`Faixa ${trackId} não está na playlist ${playlistId}`);
    await this.items.delete(item.id);
    await this.items
      .createQueryBuilder()
      .update()
      .set({ position: () => 'position - 1' })
      .where('playlistId = :playlistId AND position > :pos', { playlistId, pos: item.position })
      .execute();
  }

  private async get(id: number) {
    const p = await this.playlists.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Playlist ${id} não encontrada`);
    return p;
  }

  private async summary(p: Playlist) {
    const agg = (await this.items
      .createQueryBuilder('pt')
      .innerJoin('pt.track', 't')
      .select('COUNT(*)', 'trackCount')
      .addSelect('COALESCE(SUM(t.durationSeconds), 0)', 'total')
      .where('pt.playlistId = :id', { id: p.id })
      .getRawOne())!;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      trackCount: Number(agg.trackCount),
      totalDurationSeconds: Number(agg.total),
    };
  }
}

@Controller('playlists')
export class PlaylistsController {
  constructor(private s: PlaylistsService) {}

  @Post() async create(@Body() dto: CreatePlaylistDto) { return { data: await this.s.create(dto) }; }
  @Get() list(@Query() q: PaginationQuery) { return this.s.list(q); }
  @Get(':id') async one(@Param('id', ParseIntPipe) id: number) { return { data: await this.s.findOne(id) }; }
  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaylistDto) {
    return { data: await this.s.update(id, dto) };
  }
  @Delete(':id') @HttpCode(204) async remove(@Param('id', ParseIntPipe) id: number) { await this.s.remove(id); }

  @Post(':id/tracks') async addTrack(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTrackDto) {
    return { data: await this.s.addTrack(id, dto.trackId) };
  }
  @Delete(':id/tracks/:trackId') @HttpCode(204)
  async removeTrack(@Param('id', ParseIntPipe) id: number, @Param('trackId', ParseIntPipe) trackId: number) {
    await this.s.removeTrack(id, trackId);
  }
}
