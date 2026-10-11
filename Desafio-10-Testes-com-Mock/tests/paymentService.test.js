const PaymentService = require('../src/services/paymentService')
const { NotFoundError, ConflictError, PaymentError } = require('../src/errors/AppError')
const { buildOrder, buildCard, buildMocks } = require('./factories/fakeData')

describe('PaymentService (gateway externo mockado)', () => {
  let mocks
  let service
  let order
  const card = buildCard()

  beforeEach(() => {
    mocks = buildMocks()
    service = new PaymentService(mocks)
    order = buildOrder({ id: 'o-1', total: 150.5 })
    mocks.orderRepository.findById.mockResolvedValue(order)
  })

  describe('sucesso', () => {
    beforeEach(() => {
      mocks.paymentGateway.charge.mockResolvedValue({ transactionId: 'tx-99' })
    })

    it('cobra o valor correto no gateway', async () => {
      await service.pay('o-1', card)

      expect(mocks.orderRepository.findById).toHaveBeenCalledWith('o-1')
      expect(mocks.paymentGateway.charge).toHaveBeenCalledWith({
        amount: 150.5,
        currency: 'BRL',
        card,
        reference: 'o-1'
      })
    })

    it('salva o pedido como PAID com o id da transacao', async () => {
      const result = await service.pay('o-1', card)

      const expected = { ...order, status: 'PAID', transactionId: 'tx-99' }
      expect(mocks.orderRepository.save).toHaveBeenCalledWith(expected)
      expect(result).toEqual(expected)
    })

    it('publica order.paid e nao altera o objeto original do pedido', async () => {
      await service.pay('o-1', card)

      expect(mocks.eventQueue.publish).toHaveBeenCalledWith('order.paid', {
        orderId: 'o-1',
        transactionId: 'tx-99'
      })
      expect(order.status).toBe('PENDING')
    })
  })

  describe('erro no gateway', () => {
    const gatewayError = new Error('timeout')

    beforeEach(() => {
      mocks.paymentGateway.charge.mockRejectedValue(gatewayError)
    })

    it('lanca PaymentError preservando a causa original', async () => {
      const promise = service.pay('o-1', card)

      await expect(promise).rejects.toBeInstanceOf(PaymentError)
      await expect(promise).rejects.toMatchObject({ code: 'PAYMENT_FAILED', cause: gatewayError })
    })

    it('marca o pedido como PAYMENT_FAILED e nao publica evento de sucesso', async () => {
      await expect(service.pay('o-1', card)).rejects.toThrow()

      expect(mocks.orderRepository.save).toHaveBeenCalledTimes(1)
      expect(mocks.orderRepository.save).toHaveBeenCalledWith({
        ...order,
        status: 'PAYMENT_FAILED'
      })
      expect(mocks.eventQueue.publish).not.toHaveBeenCalled()
    })
  })

  describe('regras de negocio', () => {
    it('rejeita pedido inexistente sem chamar o gateway', async () => {
      mocks.orderRepository.findById.mockResolvedValue(null)

      await expect(service.pay('x', card)).rejects.toBeInstanceOf(NotFoundError)
      expect(mocks.paymentGateway.charge).not.toHaveBeenCalled()
    })

    it('impede cobranca duplicada de pedido ja pago', async () => {
      mocks.orderRepository.findById.mockResolvedValue({ ...order, status: 'PAID' })

      await expect(service.pay('o-1', card)).rejects.toBeInstanceOf(ConflictError)
      expect(mocks.paymentGateway.charge).not.toHaveBeenCalled()
      expect(mocks.orderRepository.save).not.toHaveBeenCalled()
    })
  })
})
