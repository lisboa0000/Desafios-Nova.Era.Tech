import { ConflictException, NotFoundException } from '@nestjs/common';
import { Order, OrderItem, Product } from '../src/database/entities';
import { OrdersService } from '../src/orders/orders.service';

function setup(products: Partial<Product>[], updateResults: number[] = []) {
  const calls: { entity: unknown; where: any; set: any }[] = [];
  const results = [...updateResults];
  const manager = {
    find: jest.fn().mockResolvedValue(products),
    update: jest.fn(async (entity, where, set) => {
      calls.push({ entity, where, set });
      return { affected: results.length ? results.shift() : 1 };
    }),
    create: jest.fn((_entity, data) => ({ ...data })),
    save: jest.fn(async (o) => ({ id: 10, ...o })),
    findOne: jest.fn(),
  };
  const dataSource = { transaction: jest.fn((cb) => cb(manager)) };
  const service = new OrdersService(dataSource as any, {} as any);
  return { service, manager, calls };
}

describe('OrdersService.checkout', () => {
  const products = [
    { id: 1, name: 'A', priceCents: 1000, stock: 5 },
    { id: 2, name: 'B', priceCents: 250, stock: 5 },
  ];

  it('calcula total, congela preco unitario e baixa estoque', async () => {
    const { service, manager, calls } = setup(products);
    const order = await service.checkout(7, {
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 4 },
      ],
    });
    expect(order.totalCents).toBe(2 * 1000 + 4 * 250);
    expect(order.status).toBe('pending');
    expect(order.userId).toBe(7);
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ productId: 1, productName: 'A', unitPriceCents: 1000, quantity: 2 });
    expect(calls.filter((c) => c.entity === Product)).toHaveLength(2);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('agrupa itens duplicados em uma unica baixa de estoque', async () => {
    const { service, calls } = setup(products);
    const order = await service.checkout(1, {
      items: [
        { productId: 1, quantity: 1 },
        { productId: 1, quantity: 2 },
      ],
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(3);
    expect(calls).toHaveLength(1);
  });

  it('falha com 404 quando produto nao existe e nao grava nada', async () => {
    const { service, manager } = setup([products[0]]);
    await expect(
      service.checkout(1, { items: [{ productId: 1, quantity: 1 }, { productId: 99, quantity: 1 }] }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('falha com 409 quando a baixa condicional nao afeta linhas (estoque insuficiente)', async () => {
    const { service, manager } = setup(products, [0]);
    await expect(service.checkout(1, { items: [{ productId: 1, quantity: 99 }] })).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('OrdersService.transition', () => {
  const order = (over: Partial<Order> = {}) =>
    ({ id: 5, userId: 1, status: 'pending', items: [{ productId: 1, quantity: 3 } as OrderItem], ...over }) as Order;

  it('cancelamento devolve o estoque dos itens', async () => {
    const { service, manager, calls } = setup([]);
    manager.findOne.mockResolvedValue(order());
    const result = await service.transition({ id: 1, role: 'customer' }, 5, 'cancel');
    expect(result.status).toBe('cancelled');
    const restock = calls.find((c) => c.entity === Product);
    expect(restock?.where).toEqual({ id: 1 });
    expect(typeof restock?.set.stock).toBe('function');
    expect(restock?.set.stock()).toBe('stock + 3');
  });

  it('pedido de outro usuario aparece como inexistente', async () => {
    const { service, manager } = setup([]);
    manager.findOne.mockResolvedValue(order({ userId: 2 }));
    await expect(service.transition({ id: 1, role: 'customer' }, 5, 'pay')).rejects.toThrow(NotFoundException);
  });

  it('conflito quando outra operacao alterou o status antes', async () => {
    const { service, manager } = setup([], [0]);
    manager.findOne.mockResolvedValue(order());
    await expect(service.transition({ id: 1, role: 'customer' }, 5, 'pay')).rejects.toThrow(ConflictException);
  });
});
