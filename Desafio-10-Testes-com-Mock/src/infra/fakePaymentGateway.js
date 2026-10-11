// Gateway fake que respeita o contrato PaymentGateway, sem rede.
class FakePaymentGateway {
  constructor() {
    this.nextError = null
  }

  failNext(error) {
    this.nextError = error
  }

  async charge() {
    if (this.nextError) {
      const error = this.nextError
      this.nextError = null
      throw error
    }
    return { transactionId: 'tx-fake-1' }
  }
}

module.exports = FakePaymentGateway
