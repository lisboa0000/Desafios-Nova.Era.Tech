const { assertImplements, contracts } = require('../../src/contracts')
const { buildMocks } = require('../factories/fakeData')
const InMemoryUserRepository = require('../../src/infra/inMemoryUserRepository')
const FakePaymentGateway = require('../../src/infra/fakePaymentGateway')

describe('assertImplements', () => {
  it('os mocks da factory respeitam todos os contratos', () => {
    const mocks = buildMocks()
    for (const name of Object.keys(mocks)) {
      const contract = name[0].toUpperCase() + name.slice(1)
      expect(assertImplements(contract, mocks[name])).toBe(mocks[name])
    }
  })

  it('lista os metodos ausentes', () => {
    expect(() => assertImplements('UserRepository', { create: () => {} })).toThrow(
      'UserRepository invalido, metodos ausentes: findByEmail, findById'
    )
  })

  it('rejeita null e contrato desconhecido', () => {
    expect(() => assertImplements('PasswordHasher', null)).toThrow(TypeError)
    expect(() => assertImplements('Inexistente', {})).toThrow('Contrato desconhecido')
  })
})

// Testes de contrato: implementacoes fake devem se comportar como os mocks assumem.
describe('contrato UserRepository', () => {
  const repo = new InMemoryUserRepository()

  it('implementa todos os metodos do contrato', () => {
    contracts.UserRepository.forEach((m) => expect(typeof repo[m]).toBe('function'))
  })

  it('create devolve id; findByEmail/findById encontram; ausente devolve null', async () => {
    const created = await repo.create({ name: 'A', email: 'a@a.com', passwordHash: 'h' })
    expect(created.id).toBeDefined()
    await expect(repo.findByEmail('a@a.com')).resolves.toEqual(created)
    await expect(repo.findById(created.id)).resolves.toEqual(created)
    await expect(repo.findByEmail('nao@existe.com')).resolves.toBeNull()
    await expect(repo.findById('999')).resolves.toBeNull()
  })
})

describe('contrato PaymentGateway', () => {
  it('charge devolve transactionId em sucesso e rejeita em falha', async () => {
    const gateway = new FakePaymentGateway()
    await expect(gateway.charge({ amount: 10 })).resolves.toEqual({
      transactionId: expect.any(String)
    })

    gateway.failNext(new Error('recusado'))
    await expect(gateway.charge({ amount: 10 })).rejects.toThrow('recusado')
    await expect(gateway.charge({ amount: 10 })).resolves.toBeDefined()
  })
})
