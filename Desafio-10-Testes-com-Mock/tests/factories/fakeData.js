// Factory de dados fake reutilizavel: cada funcao aceita overrides.
let sequence = 0
const nextId = () => `id-${++sequence}`

const buildUserInput = (overrides = {}) => ({
  name: 'Maria Silva',
  email: 'maria@email.com',
  password: 'senha-segura-123',
  ...overrides
})

const buildUser = (overrides = {}) => ({
  id: nextId(),
  name: 'Maria Silva',
  email: 'maria@email.com',
  passwordHash: 'hash:senha-segura-123',
  ...overrides
})

const buildOrder = (overrides = {}) => ({
  id: nextId(),
  total: 150.5,
  status: 'PENDING',
  ...overrides
})

const buildCard = (overrides = {}) => ({
  number: '4111111111111111',
  holder: 'MARIA SILVA',
  expiry: '12/30',
  cvv: '123',
  ...overrides
})

// Mocks que respeitam os contratos: todos os metodos sao jest.fn().
// As chaves seguem o nome do contrato em camelCase.
const buildMocks = () => ({
  userRepository: { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() },
  passwordHasher: { hash: jest.fn() },
  eventQueue: { publish: jest.fn() },
  paymentGateway: { charge: jest.fn() },
  orderRepository: { findById: jest.fn(), save: jest.fn() }
})

module.exports = { buildUserInput, buildUser, buildOrder, buildCard, buildMocks }
