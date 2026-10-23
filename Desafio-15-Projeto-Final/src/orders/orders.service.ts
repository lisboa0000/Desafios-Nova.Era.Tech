import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { AuthUser } from '../common/auth.decorators';
import { PaginationQuery, paginated } from '../common/pagination';
import { Order, OrderItem, Product } from '../database/entities';
import { OrderAction, mergeItems, resolveTransition } from './order.rules';

export class OrderItemDto {
  @IsInt() @Min(1) productId: number;
  @IsInt() @Min(1) @Max(1000) quantity: number;
}

export class CreateOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  checkout(userId: number, dto: CreateOrderDto) {
    const wanted = mergeItems(dto.items);
    const ids = [...wanted.keys()];

    return this.dataSource.transaction(async (m) => {
      const products = await m.find(Product, { where: { id: In(ids), active: true } });
      const byId = new Map(products.map((p) => [p.id, p]));
      const missing = ids.filter((id) => !byId.has(id));
      if (missing.length) throw new NotFoundException(`Produtos nao encontrados: ${missing.join(', ')}`);

      let totalCents = 0;
      const items: OrderItem[] = [];
      for (const [productId, quantity] of wanted) {
        const product = byId.get(productId)!;
        const res = await m.update(
          Product,
          { id: productId, stock: MoreThanOrEqual(quantity) },
          { stock: () => `stock - ${Number(quantity)}` },
        );
        if (!res.affected) throw new ConflictException(`Estoque insuficiente para ${product.name}`);
        totalCents += product.priceCents * quantity;
        items.push(
          m.create(OrderItem, { productId, productName: product.name, unitPriceCents: product.priceCents, quantity }),
        );
      }

      if (totalCents <= 0) throw new BadRequestException('Total do pedido invalido');
      return m.save(m.create(Order, { userId, status: 'pending', totalCents, items }));
    });
  }

  async list(actor: AuthUser, q: PaginationQuery) {
    const [rows, total] = await this.orders.findAndCount({
      where: actor.role === 'admin' ? {} : { userId: actor.id },
      relations: { items: true },
      order: { id: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginated(rows, total, q);
  }

  async get(actor: AuthUser, id: number) {
    const order = await this.orders.findOne({ where: { id }, relations: { items: true } });
    if (!order || (actor.role !== 'admin' && order.userId !== actor.id)) {
      throw new NotFoundException('Pedido nao encontrado');
    }
    return order;
  }

  transition(actor: AuthUser, orderId: number, action: OrderAction) {
    return this.dataSource.transaction(async (m) => {
      const order = await m.findOne(Order, { where: { id: orderId }, relations: { items: true } });
      if (!order || (actor.role !== 'admin' && order.userId !== actor.id)) {
        throw new NotFoundException('Pedido nao encontrado');
      }

      const next = resolveTransition(action, order.status, actor.role);
      const res = await m.update(Order, { id: order.id, status: order.status }, { status: next });
      if (!res.affected) throw new ConflictException('Pedido alterado por outra operacao');

      if (action === 'cancel') {
        for (const item of order.items) {
          await m.update(Product, { id: item.productId }, { stock: () => `stock + ${Number(item.quantity)}` });
        }
      }
      order.status = next;
      return order;
    });
  }
}
