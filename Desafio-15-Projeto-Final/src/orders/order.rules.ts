import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, Role } from '../database/entities';

export type OrderAction = 'pay' | 'ship' | 'cancel';

interface Rule {
  from: OrderStatus[];
  to: OrderStatus;
  adminOnly: boolean;
}

export const ORDER_RULES: Record<OrderAction, Rule> = {
  pay: { from: ['pending'], to: 'paid', adminOnly: false },
  ship: { from: ['paid'], to: 'shipped', adminOnly: true },
  cancel: { from: ['pending', 'paid'], to: 'cancelled', adminOnly: false },
};

export function resolveTransition(action: OrderAction, current: OrderStatus, role: Role): OrderStatus {
  const rule = ORDER_RULES[action];
  if (rule.adminOnly && role !== 'admin') throw new ForbiddenException('Acao restrita a administradores');
  if (action === 'cancel' && current === 'paid' && role !== 'admin') {
    throw new ForbiddenException('Somente administradores cancelam pedidos pagos');
  }
  if (!rule.from.includes(current)) {
    throw new ConflictException(`Pedido com status ${current} nao permite a acao ${action}`);
  }
  return rule.to;
}

export function mergeItems(items: { productId: number; quantity: number }[]): Map<number, number> {
  const merged = new Map<number, number>();
  for (const i of items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  return merged;
}
