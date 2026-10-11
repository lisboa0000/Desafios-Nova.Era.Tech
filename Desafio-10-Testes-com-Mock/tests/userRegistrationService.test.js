const UserRegistrationService = require('../src/services/userRegistrationService')
const { ConflictError, ValidationError } = require('../src/errors/AppError')
const { buildUserInput, buildUser, buildMocks } = require('./factories/fakeData')

describe('UserRegistrationService (repositorio, hasher e fila mockados)', () => {
  let mocks
  let service

  beforeEach(() => {
    mocks = buildMocks()
    service = new UserRegistrationService(mocks)
    mocks.userRepository.findByEmail.mockResolvedValue(null)
    mocks.passwordHasher.hash.mockResolvedValue('hash:senha')
    mocks.userRepository.create.mockImplementation(async (data) => buildUser(data))
  })

  it('cria usuario com dados normalizados e senha hasheada', async () => {
    const result = await service.register(
      buildUserInput({ name: '  Ana  ', email: '  ANA@Email.com ', password: 'senha-12345' })
    )

    expect(mocks.userRepository.findByEmail).toHaveBeenCalledWith('ana@email.com')
    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('senha-12345')
    expect(mocks.userRepository.create).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@email.com',
      passwordHash: 'hash:senha'
    })
    expect(result).toEqual({ id: expect.any(String), name: 'Ana', email: 'ana@email.com' })
  })

  it('nunca expoe o hash da senha no retorno', async () => {
    const result = await service.register(buildUserInput())
    expect(result).not.toHaveProperty('passwordHash')
    expect(result).not.toHaveProperty('password')
  })

  it('publica o evento user.registered uma unica vez', async () => {
    mocks.userRepository.create.mockResolvedValue(
      buildUser({ id: 'u-1', email: 'maria@email.com' })
    )

    await service.register(buildUserInput())

    expect(mocks.eventQueue.publish).toHaveBeenCalledTimes(1)
    expect(mocks.eventQueue.publish).toHaveBeenCalledWith('user.registered', {
      userId: 'u-1',
      email: 'maria@email.com'
    })
  })

  it('publica o evento somente depois de persistir o usuario', async () => {
    await service.register(buildUserInput())

    const [createOrder] = mocks.userRepository.create.mock.invocationCallOrder
    const [publishOrder] = mocks.eventQueue.publish.mock.invocationCallOrder
    expect(createOrder).toBeLessThan(publishOrder)
  })

  it('rejeita email ja cadastrado sem criar usuario nem publicar evento', async () => {
    mocks.userRepository.findByEmail.mockResolvedValue(buildUser())

    await expect(service.register(buildUserInput())).rejects.toBeInstanceOf(ConflictError)

    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled()
    expect(mocks.userRepository.create).not.toHaveBeenCalled()
    expect(mocks.eventQueue.publish).not.toHaveBeenCalled()
  })

  it.each([
    ['nome vazio', { name: '   ' }, 'Nome obrigatorio'],
    ['email invalido', { email: 'sem-arroba' }, 'Email invalido'],
    ['senha curta', { password: '123' }, 'Senha deve ter no minimo 8 caracteres']
  ])('valida entrada: %s', async (_label, override, message) => {
    const promise = service.register(buildUserInput(override))

    await expect(promise).rejects.toBeInstanceOf(ValidationError)
    await expect(promise).rejects.toThrow(message)
    expect(mocks.userRepository.findByEmail).not.toHaveBeenCalled()
    expect(mocks.userRepository.create).not.toHaveBeenCalled()
  })

  it('propaga falha do repositorio e nao publica evento', async () => {
    mocks.userRepository.create.mockRejectedValue(new Error('db down'))

    await expect(service.register(buildUserInput())).rejects.toThrow('db down')
    expect(mocks.eventQueue.publish).not.toHaveBeenCalled()
  })

  it('propaga falha da fila (usuario ja foi criado)', async () => {
    mocks.eventQueue.publish.mockRejectedValue(new Error('queue down'))

    await expect(service.register(buildUserInput())).rejects.toThrow('queue down')
    expect(mocks.userRepository.create).toHaveBeenCalledTimes(1)
  })

  it('falha cedo quando uma dependencia nao respeita o contrato', () => {
    expect(() => new UserRegistrationService({ ...mocks, eventQueue: {} })).toThrow(
      /EventQueue invalido, metodos ausentes: publish/
    )
  })
})
