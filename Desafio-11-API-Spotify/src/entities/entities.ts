import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('artists')
export class Artist {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) name: string;
  @Column({ type: 'varchar', nullable: true }) country: string | null;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Album, (a) => a.artist) albums: Album[];
}

@Entity('albums')
export class Album {
  @PrimaryGeneratedColumn() id: number;
  @Column() title: string;
  @Column({ type: 'integer', nullable: true }) releaseYear: number | null;
  @Column() artistId: number;
  @ManyToOne(() => Artist, (a) => a.albums, { nullable: false })
  @JoinColumn({ name: 'artistId' })
  artist: Artist;
  @OneToMany(() => Track, (t) => t.album) tracks: Track[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('tracks')
export class Track {
  @PrimaryGeneratedColumn() id: number;
  @Column() title: string;
  @Column() durationSeconds: number;
  @Column({ type: 'varchar', nullable: true }) genre: string | null;
  @Column() albumId: number;
  @ManyToOne(() => Album, (a) => a.tracks, { nullable: false })
  @JoinColumn({ name: 'albumId' })
  album: Album;
  @CreateDateColumn() createdAt: Date;
}

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) description: string | null;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => PlaylistTrack, (pt) => pt.playlist) items: PlaylistTrack[];
}

@Entity('playlist_tracks')
@Unique(['playlistId', 'trackId'])
export class PlaylistTrack {
  @PrimaryGeneratedColumn() id: number;
  @Column() playlistId: number;
  @Column() trackId: number;
  @Column() position: number;
  @CreateDateColumn() addedAt: Date;
  @ManyToOne(() => Playlist, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist: Playlist;
  @ManyToOne(() => Track, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackId' })
  track: Track;
}

export const ALL_ENTITIES = [Artist, Album, Track, Playlist, PlaylistTrack];
