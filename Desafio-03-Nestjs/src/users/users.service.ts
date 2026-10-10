import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
  // "Banco de dados" em memoria
  private users: User[] = [];

  create(dto: CreateUserDto): User {
    this.ensureEmailIsUnique(dto.email);

    const user: User = { id: randomUUID(), ...dto };
    this.users.push(user);
    return user;
  }

  findAll(role?: UserRole): User[] {
    return role ? this.users.filter((u) => u.role === role) : this.users;
  }

  findOne(id: string): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`Usuário com id "${id}" não encontrado`);
    }
    return user;
  }

  update(id: string, dto: UpdateUserDto): User {
    const user = this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      this.ensureEmailIsUnique(dto.email);
    }

    Object.assign(user, dto);
    return user;
  }

  private ensureEmailIsUnique(email: string): void {
    const exists = this.users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (exists) {
      throw new ConflictException(`Já existe um usuário com o email "${email}"`);
    }
  }
}
