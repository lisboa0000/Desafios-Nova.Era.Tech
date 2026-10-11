import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp, createAppModule } from '../src/app.module';

describe('API estilo Spotify', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let artistId: number;
  let albumId: number;
  const trackIds: number[] = [];
  let playlistId: number;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [createAppModule()] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    artistId = (await http.post('/artists').send({ name: 'Queen', country: 'UK' }).expect(201)).body.data.id;
    albumId = (await http.post('/albums').send({ title: 'A Night at the Opera', releaseYear: 1975, artistId }).expect(201)).body.data.id;
    for (const [title, d] of [['Bohemian Rhapsody', 355], ['Love of My Life', 219], ['39', 210]] as const) {
      const r = await http.post('/tracks').send({ title, durationSeconds: d, genre: 'Rock', albumId }).expect(201);
      trackIds.push(r.body.data.id);
    }
    playlistId = (await http.post('/playlists').send({ name: 'Clássicos' }).expect(201)).body.data.id;
  });
  afterAll(() => app.close());

  it('valida payload e conflito de nome de artista', async () => {
    await http.post('/artists').send({ name: '' }).expect(400);
    await http.post('/artists').send({ name: 'Queen' }).expect(409);
    await http.post('/albums').send({ title: 'X', artistId: 999 }).expect(404);
  });

  it('retorna faixa com álbum e artista', async () => {
    const r = await http.get(`/tracks/${trackIds[0]}`).expect(200);
    expect(r.body.data).toMatchObject({ title: 'Bohemian Rhapsody', artist: { name: 'Queen' }, album: { id: albumId } });
  });

  it('pagina listagens com meta consistente', async () => {
    const r = await http.get('/tracks?limit=2&page=2').expect(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('busca por faixa e por artista', async () => {
    expect((await http.get('/search?q=bohemian').expect(200)).body.meta.total).toBe(1);
    expect((await http.get('/search?q=queen').expect(200)).body.meta.total).toBe(3);
    expect((await http.get('/search?q=zzz').expect(200)).body.meta.total).toBe(0);
  });

  it('adiciona faixas, soma duração e bloqueia duplicata', async () => {
    await http.post(`/playlists/${playlistId}/tracks`).send({ trackId: trackIds[0] }).expect(201);
    await http.post(`/playlists/${playlistId}/tracks`).send({ trackId: trackIds[1] }).expect(201);
    await http.post(`/playlists/${playlistId}/tracks`).send({ trackId: trackIds[0] }).expect(409);
    await http.post(`/playlists/${playlistId}/tracks`).send({ trackId: 999 }).expect(404);

    const r = await http.get(`/playlists/${playlistId}`).expect(200);
    expect(r.body.data.trackCount).toBe(2);
    expect(r.body.data.totalDurationSeconds).toBe(355 + 219);
    expect(r.body.data.tracks.map((t: any) => t.position)).toEqual([1, 2]);

    const list = await http.get('/playlists').expect(200);
    expect(list.body.data[0].totalDurationSeconds).toBe(574);
  });

  it('remove faixa da playlist e reordena posições', async () => {
    await http.delete(`/playlists/${playlistId}/tracks/${trackIds[0]}`).expect(204);
    await http.delete(`/playlists/${playlistId}/tracks/${trackIds[0]}`).expect(404);
    const r = await http.get(`/playlists/${playlistId}`).expect(200);
    expect(r.body.data.tracks).toHaveLength(1);
    expect(r.body.data.tracks[0].position).toBe(1);
    expect(r.body.data.totalDurationSeconds).toBe(219);
  });

  it('ranking e recomendação por gênero', async () => {
    const p2 = (await http.post('/playlists').send({ name: 'Outra' })).body.data.id;
    await http.post(`/playlists/${p2}/tracks`).send({ trackId: trackIds[1] }).expect(201);
    const rank = await http.get('/tracks/ranking').expect(200);
    expect(rank.body.data[0]).toMatchObject({ id: trackIds[1], addedCount: 2 });

    const rec = await http.get('/recommendations?genre=rock').expect(200);
    expect(rec.body.data[0].id).toBe(trackIds[1]);
    expect(rec.body.meta.total).toBe(3);
    await http.get('/recommendations').expect(400);
  });

  it('protege integridade na remoção do catálogo', async () => {
    await http.delete(`/albums/${albumId}`).expect(409);
    await http.delete(`/artists/${artistId}`).expect(409);
    await http.delete(`/tracks/${trackIds[1]}`).expect(204); // sai das playlists junto
    const r = await http.get(`/playlists/${playlistId}`).expect(200);
    expect(r.body.data.trackCount).toBe(0);
    await http.delete(`/tracks/${trackIds[0]}`).expect(204);
    await http.delete(`/tracks/${trackIds[2]}`).expect(204);
    await http.delete(`/albums/${albumId}`).expect(204);
    await http.delete(`/artists/${artistId}`).expect(204);
    await http.get(`/artists/${artistId}`).expect(404);
  });
});
