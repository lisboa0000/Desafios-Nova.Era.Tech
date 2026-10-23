import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export const ROLES = ['admin', 'customer'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 160 }) email: string;
  @Column({ type: 'varchar', length: 100 }) passwordHash: string;
  @Column({ type: 'varchar', length: 20, default: 'customer' }) role: Role;
  @CreateDateColumn() createdAt: Date;
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 80 }) name: string;
  @OneToMany(() => Product, (p) => p.category) products: Product[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'int' }) priceCents: number;
  @Column({ type: 'int' }) stock: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Index() @Column({ type: 'int' }) categoryId: number;
  @ManyToOne(() => Category, (c) => c.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ type: 'int' }) userId: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: OrderStatus;
  @Column({ type: 'int' }) totalCents: number;
  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true }) items: OrderItem[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) orderId: number;
  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
  @Column({ type: 'int' }) productId: number;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;
  @Column({ type: 'varchar', length: 120 }) productName: string;
  @Column({ type: 'int' }) unitPriceCents: number;
  @Column({ type: 'int' }) quantity: number;
}

export const ENTITIES = [User, Category, Product, Order, OrderItem];

export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}
