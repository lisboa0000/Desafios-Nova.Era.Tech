import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

const isPresent = (_: unknown, value: unknown) => value !== undefined;

export class UpdateUserDto {
  @ValidateIf(isPresent)
  @IsString({ message: 'name deve ser um texto' })
  @IsNotEmpty({ message: 'name não pode ser vazio' })
  @MinLength(2, { message: 'name deve ter pelo menos 2 caracteres' })
  name?: string;

  @ValidateIf(isPresent)
  @IsEmail({}, { message: 'email deve ser um email válido' })
  email?: string;

  @ValidateIf(isPresent)
  @IsEnum(UserRole, { message: 'role deve ser "admin" ou "member"' })
  role?: UserRole;
}
