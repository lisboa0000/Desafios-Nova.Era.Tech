import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumsController, AlbumsService } from './albums/albums';
import { ArtistsController, ArtistsService } from './artists/artists';
import { ALL_ENTITIES } from './entities/entities';
import { PlaylistsController, PlaylistsService } from './playlists/playlists';
import { TracksController, TracksService } from './tracks/tracks';

/** `location` vazio = banco em memória (usado nos testes). */
export function createAppModule(location?: string) {
  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqljs',
        location,
        autoSave: !!location,
        entities: ALL_ENTITIES,
        synchronize: true,
      }),
      TypeOrmModule.forFeature(ALL_ENTITIES),
    ],
    controllers: [ArtistsController, AlbumsController, TracksController, PlaylistsController],
    providers: [ArtistsService, AlbumsService, TracksService, PlaylistsService],
  })
  class AppModule {}
  return AppModule;
}

export function configureApp(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
