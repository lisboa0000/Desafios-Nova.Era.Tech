import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser, Public } from '../common/auth.decorators';
import { User, publicUser } from '../database/entities';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, @InjectRepository(User) private readonly users: Repository<User>) {}

  @Public() @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public() @Post('auth/login') @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  async me(@CurrentUser() actor: AuthUser) {
    return publicUser((await this.users.findOneOrFail({ where: { id: actor.id } })));
  }
}
