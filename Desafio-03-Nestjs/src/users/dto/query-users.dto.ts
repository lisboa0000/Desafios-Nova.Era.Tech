import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(UserRole, { message: 'role deve ser "admin" ou "member"' })
  role?: UserRole;
}
