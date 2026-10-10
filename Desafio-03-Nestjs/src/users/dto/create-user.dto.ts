import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  @IsString({ message: 'name deve ser um texto' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  @MinLength(2, { message: 'name deve ter pelo menos 2 caracteres' })
  name: string;

  @IsEmail({}, { message: 'email deve ser um email válido' })
  @IsNotEmpty({ message: 'email é obrigatório' })
  email: string;

  @IsEnum(UserRole, { message: 'role deve ser "admin" ou "member"' })
  role: UserRole;
}
