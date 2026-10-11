const { assertImplements } = require('../contracts')
const { NotFoundError, PaymentError, ConflictError } = require('../errors/AppError')

class PaymentService {
  constructor({ orderRepository, paymentGateway, eventQueue }) {
    this.orderRepository = assertImplements('OrderRepository', orderRepository)
    this.paymentGateway = assertImplements('PaymentGateway', paymentGateway)
    this.eventQueue = assertImplements('EventQueue', eventQueue)
  }

  async pay(orderId, card) {
    const order = await this.orderRepository.findById(orderId)
    if (!order) throw new NotFoundError('Pedido nao encontrado')
    if (order.status === 'PAID') throw new ConflictError('Pedido ja foi pago')

    let result
    try {
      result = await this.paymentGateway.charge({
        amount: order.total,
        currency: 'BRL',
        card,
        reference: order.id
      })
    } catch (error) {
      // Falha do gateway: o pedido e marcado como falho e nenhum evento de sucesso sai.
      await this.orderRepository.save({ ...order, status: 'PAYMENT_FAILED' })
      throw new PaymentError('Falha ao processar pagamento', error)
    }

    const paid = { ...order, status: 'PAID', transactionId: result.transactionId }
    await this.orderRepository.save(paid)
    await this.eventQueue.publish('order.paid', {
      orderId: order.id,
      transactionId: result.transactionId
    })

    return paid
  }
}

module.exports = PaymentService
