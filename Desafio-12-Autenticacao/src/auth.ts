import {
  CanActivate, ConflictException, Controller, Body, ExecutionContext, ForbiddenException, Get, Inject,
  Injectable, NotFoundException, OnModuleInit, Param, ParseIntPipe, Patch, Post, SetMetadata,
  UnauthorizedException, createParamDecorator, HttpCode,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { ROLES, Role, User, publicUser } from './entities';

export interface AuthOptions {
  jwtSecret: string;
  /** ex.: '15m' ou segundos (number) */
  accessTtl: string | number;
  refreshTtl: string | number;
  bcryptRounds: number;
  /** Se informados, cria um admin no boot (única forma de obter o perfil admin sem outro admin). */
  adminEmail?: string;
  adminPassword?: string;
}
export const AUTH_OPTIONS = 'AUTH_OPTIONS';

export function optionsFromEnv(): AuthOptions {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET é obrigatório em produção');
  return {
    jwtSecret: secret ?? 'dev-only-secret-change-me',
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  };
}

// ---------- DTOs ----------
const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @Transform(normalizeEmail) @IsEmail() email: string;
  // 72 = limite de bytes do bcrypt
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
export class LoginDto {
  @Transform(normalizeEmail) @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
}
export class RefreshDto {
  @IsString() refreshToken: string;
}
export class ChangeRoleDto {
  @IsIn(ROLES) role: Role;
}

// ---------- Decorators ----------
export const Public = () => SetMetadata('isPublic', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user);

// ---------- Service ----------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  // hash descartável: login de e-mail inexistente gasta o mesmo tempo (evita enumeração por timing)
  private dummyHash: string;

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @Inject(AUTH_OPTIONS) private opts: AuthOptions,
  ) {
    this.dummyHash = bcrypt.hashSync('dummy-password', opts.bcryptRounds);
  }

  async onModuleInit() {
    const { adminEmail, adminPassword } = this.opts;
    if (adminEmail && adminPassword && !(await this.users.findOneBy({ email: adminEmail.toLowerCase() }))) {
      await this.users.save(this.users.create({
        name: 'Admin', email: adminEmail.toLowerCase(), role: 'admin',
        passwordHash: await bcrypt.hash(adminPassword, this.opts.bcryptRounds), refreshTokenHash: null,
      }));
    }
  }

  async register(dto: RegisterDto) {
    if (await this.users.findOneBy({ email: dto.email })) throw new ConflictException('E-mail já cadastrado');
    // perfil SEMPRE member no cadastro público (evita escalada de privilégio)
    const user = await this.users.save(this.users.create({
      name: dto.name, email: dto.email, role: 'member',
      passwordHash: await bcrypt.hash(dto.password, this.opts.bcryptRounds), refreshTokenHash: null,
    }));
    return publicUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOneBy({ email: dto.email });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) throw new UnauthorizedException('Credenciais inválidas');
    return this.issueTokens(user);
  }

  async refresh(token: string) {
    const invalid = new UnauthorizedException('Refresh token inválido ou expirado');
    let payload: jwt.JwtPayload;
    try { payload = this.verify(token, 'refresh'); } catch { throw invalid; }
    const user = await this.users.findOneBy({ id: Number(payload.sub) });
    if (!user || user.refreshTokenHash !== sha256(token)) throw invalid; // reuso de token antigo é rejeitado
    return this.issueTokens(user);
  }

  async logout(user: User) {
    await this.users.update(user.id, { refreshTokenHash: null });
  }

  /** Valida um access token e devolve o usuário atual (role sempre lida do banco). */
  async authenticate(token: string): Promise<User> {
    let payload: jwt.JwtPayload;
    try { payload = this.verify(token, 'access'); } catch { throw new UnauthorizedException('Token inválido ou expirado'); }
    const user = await this.users.findOneBy({ id: Number(payload.sub) });
    if (!user) throw new UnauthorizedException('Token inválido ou expirado');
    return user;
  }

  private verify(token: string, typ: 'access' | 'refresh') {
    const payload = jwt.verify(token, this.opts.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.typ !== typ) throw new Error('tipo de token incorreto');
    return payload;
  }

  private async issueTokens(user: User) {
    const sign = (typ: 'access' | 'refresh', expiresIn: string | number) =>
      jwt.sign({ typ }, this.opts.jwtSecret, { algorithm: 'HS256', subject: String(user.id), expiresIn, jwtid: randomUUID() } as jwt.SignOptions);
    const accessToken = sign('access', this.opts.accessTtl);
    const refreshToken = sign('refresh', this.opts.refreshTtl);
    await this.users.update(user.id, { refreshTokenHash: sha256(refreshToken) });
    return { tokenType: 'Bearer', accessToken, refreshToken, expiresIn: this.opts.accessTtl };
  }
}

// ---------- Guards (globais) ----------
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Autenticação necessária');
    req.user = await this.auth.authenticate(token);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user: User | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Você não tem permissão para acessar este recurso');
    return true;
  }
}

// ---------- Controllers ----------
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto).then((data) => ({ data })); }

  @Public() @Post('login') @HttpCode(200)
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Public() @Post('refresh') @HttpCode(200)
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Post('logout') @HttpCode(204)
  logout(@CurrentUser() user: User) { return this.auth.logout(user); }
}

@Controller()
export class MeController {
  @Get('me')
  me(@CurrentUser() user: User) { return { data: publicUser(user) }; }

  /** Qualquer usuário autenticado (admin ou member). */
  @Roles('admin', 'member') @Get('member/area')
  memberArea(@CurrentUser() user: User) { return { message: `Área de membros — olá, ${user.name}` }; }
}

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  @Get('users')
  async list() { return { data: (await this.users.find({ order: { id: 'ASC' } })).map(publicUser) }; }

  @Patch('users/:id/role')
  async changeRole(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangeRoleDto) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    user.role = dto.role;
    return { data: publicUser(await this.users.save(user)) };
  }
}
