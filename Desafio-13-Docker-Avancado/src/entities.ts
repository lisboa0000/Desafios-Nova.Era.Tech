import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Role = 'admin' | 'member';
export const ROLES: Role[] = ['admin', 'member'];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column({ type: 'varchar', default: 'member' }) role: Role;
  /** SHA-256 do refresh token vigente (rotação: só o último é válido). */
  @Column({ type: 'varchar', nullable: true }) refreshTokenHash: string | null;
  @CreateDateColumn() createdAt: Date;
}

/** Nunca devolve passwordHash/refreshTokenHash nas respostas. */
export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}
