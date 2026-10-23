import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/auth.decorators';
import { User, publicUser } from '../database/entities';
import { LoginDto, RegisterDto } from './auth.dto';

export interface AuthOptions {
  jwtSecret: string;
  accessTtl: string | number;
  bcryptRounds: number;
}
export const AUTH_OPTIONS = 'AUTH_OPTIONS';

@Injectable()
export class AuthService {
  private dummyHash: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(AUTH_OPTIONS) private readonly opts: AuthOptions,
  ) {
    this.dummyHash = bcrypt.hashSync('dummy-password', opts.bcryptRounds);
  }

  async register(dto: RegisterDto) {
    if (await this.users.findOne({ where: { email: dto.email } })) {
      throw new ConflictException('E-mail ja cadastrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.opts.bcryptRounds);
    const user = await this.users.save(this.users.create({ name: dto.name, email: dto.email, passwordHash, role: 'customer' }));
    return publicUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) throw new UnauthorizedException('Credenciais invalidas');
    return { accessToken: this.sign(user), user: publicUser(user) };
  }

  sign(user: Pick<User, 'id' | 'role'>): string {
    return jwt.sign({ role: user.role }, this.opts.jwtSecret, {
      subject: String(user.id),
      expiresIn: this.opts.accessTtl as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
  }

  async authenticate(token: string): Promise<AuthUser> {
    let sub: string;
    try {
      const payload = jwt.verify(token, this.opts.jwtSecret, { algorithms: ['HS256'] });
      sub = String((payload as jwt.JwtPayload).sub);
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }
    const user = await this.users.findOne({ where: { id: Number(sub) } });
    if (!user) throw new UnauthorizedException('Usuario nao encontrado');
    return { id: user.id, role: user.role };
  }
}
