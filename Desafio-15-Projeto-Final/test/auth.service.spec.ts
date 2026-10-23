import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../src/auth/auth.service';

const opts = { jwtSecret: 'segredo-de-teste', accessTtl: '1h', bcryptRounds: 4 };

function makeService(user: any = null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(user),
    create: jest.fn((d) => ({ ...d })),
    save: jest.fn(async (u) => ({ id: 1, createdAt: new Date(), ...u })),
  };
  return { service: new AuthService(repo as any, opts), repo };
}

describe('AuthService', () => {
  it('registra sempre como customer e nao expoe o hash', async () => {
    const { service, repo } = makeService(null);
    const out: any = await service.register({ name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1' });
    expect(out.role).toBe('customer');
    expect(out.passwordHash).toBeUndefined();
    expect(repo.save.mock.calls[0][0].passwordHash).not.toBe('senha-forte-1');
  });

  it('rejeita e-mail duplicado', async () => {
    const { service } = makeService({ id: 1 });
    await expect(service.register({ name: 'Ana', email: 'ana@x.com', password: 'senha-forte-1' })).rejects.toThrow(ConflictException);
  });

  it('login valido devolve token com sub e role', async () => {
    const passwordHash = bcrypt.hashSync('senha-forte-1', 4);
    const { service } = makeService({ id: 9, email: 'a@x.com', role: 'admin', passwordHash, name: 'A', createdAt: new Date() });
    const { accessToken } = await service.login({ email: 'a@x.com', password: 'senha-forte-1' });
    const payload = jwt.verify(accessToken, opts.jwtSecret) as jwt.JwtPayload;
    expect(payload.sub).toBe('9');
    expect(payload.role).toBe('admin');
  });

  it('senha errada e usuario inexistente geram o mesmo erro', async () => {
    const passwordHash = bcrypt.hashSync('outra-senha-1', 4);
    const wrong = makeService({ id: 1, passwordHash }).service;
    const missing = makeService(null).service;
    await expect(wrong.login({ email: 'a@x.com', password: 'errada-123' })).rejects.toThrow('Credenciais invalidas');
    await expect(missing.login({ email: 'a@x.com', password: 'errada-123' })).rejects.toThrow('Credenciais invalidas');
  });

  it('rejeita token assinado com outro segredo ou expirado', async () => {
    const { service } = makeService({ id: 1, role: 'customer' });
    const forged = jwt.sign({}, 'outro-segredo', { subject: '1' });
    const expired = jwt.sign({}, opts.jwtSecret, { subject: '1', expiresIn: -10 });
    await expect(service.authenticate(forged)).rejects.toThrow(UnauthorizedException);
    await expect(service.authenticate(expired)).rejects.toThrow(UnauthorizedException);
  });
});
