import { ConflictException, ForbiddenException } from '@nestjs/common';
import { mergeItems, resolveTransition } from '../src/orders/order.rules';

describe('regras de transicao de pedido', () => {
  it('cliente paga pedido pendente', () => {
    expect(resolveTransition('pay', 'pending', 'customer')).toBe('paid');
  });

  it('nao permite pagar pedido ja pago', () => {
    expect(() => resolveTransition('pay', 'paid', 'customer')).toThrow(ConflictException);
  });

  it('somente admin envia pedido', () => {
    expect(() => resolveTransition('ship', 'paid', 'customer')).toThrow(ForbiddenException);
    expect(resolveTransition('ship', 'paid', 'admin')).toBe('shipped');
  });

  it('nao envia pedido pendente', () => {
    expect(() => resolveTransition('ship', 'pending', 'admin')).toThrow(ConflictException);
  });

  it('cliente cancela pendente, mas nao pago; admin cancela pago', () => {
    expect(resolveTransition('cancel', 'pending', 'customer')).toBe('cancelled');
    expect(() => resolveTransition('cancel', 'paid', 'customer')).toThrow(ForbiddenException);
    expect(resolveTransition('cancel', 'paid', 'admin')).toBe('cancelled');
  });

  it('nao cancela pedido enviado ou ja cancelado', () => {
    expect(() => resolveTransition('cancel', 'shipped', 'admin')).toThrow(ConflictException);
    expect(() => resolveTransition('cancel', 'cancelled', 'admin')).toThrow(ConflictException);
  });

  it('agrupa itens repetidos do mesmo produto', () => {
    const merged = mergeItems([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
      { productId: 1, quantity: 3 },
    ]);
    expect(merged.get(1)).toBe(5);
    expect(merged.get(2)).toBe(1);
  });
});
