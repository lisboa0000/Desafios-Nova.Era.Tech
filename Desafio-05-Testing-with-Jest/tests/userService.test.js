const UserService = require('../src/services/userService')
const UserRepository = require('../src/repositories/userRepository')
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
} = require('../src/errors/AppError')

function createRepositoryMock() {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}

describe('UserService com repositorio simulado', () => {
  let repository
  let service

  const validPayload = { name: '  Maria Silva ', email: 'Maria@Email.com', age: 25 }

  beforeEach(() => {
    repository = createRepositoryMock()
    service = new UserService(repository)
  })

  describe('create', () => {
    it('cria usuario valido normalizando nome e email', async () => {
      repository.findByEmail.mockResolvedValue(null)
      repository.create.mockImplementation(async (data) => ({ id: '1', ...data }))

      const result = await service.create(validPayload)

      expect(repository.findByEmail).toHaveBeenCalledWith('maria@email.com')
      expect(repository.create).toHaveBeenCalledWith({
        name: 'Maria Silva',
        email: 'maria@email.com',
        age: 25
      })
      expect(result).toEqual({
        id: '1',
        name: 'Maria Silva',
        email: 'maria@email.com',
        age: 25
      })
    })

    it('rejeita payload invalido sem consultar o repositorio', async () => {
      const payload = { name: 'A', email: 'x', age: 'dez' }

      await expect(service.create(payload)).rejects.toThrow(ValidationError)

      expect(repository.findByEmail).not.toHaveBeenCalled()
      expect(repository.create).not.toHaveBeenCalled()
    })

    it('rejeita usuario menor de idade', async () => {
      const payload = { ...validPayload, age: 17 }

      await expect(service.create(payload)).rejects.toThrow(BusinessRuleError)

      expect(repository.create).not.toHaveBeenCalled()
    })

    it('aceita usuario com exatamente 18 anos', async () => {
      repository.findByEmail.mockResolvedValue(null)
      repository.create.mockResolvedValue({ id: '2' })
      const payload = { ...validPayload, age: 18 }

      const result = await service.create(payload)

      expect(result).toEqual({ id: '2' })
    })

    it('rejeita email ja cadastrado', async () => {
      repository.findByEmail.mockResolvedValue({ id: '9', email: 'maria@email.com' })

      await expect(service.create(validPayload)).rejects.toThrow(ConflictError)

      expect(repository.create).not.toHaveBeenCalled()
    })

    it('propaga falha do repositorio', async () => {
      repository.findByEmail.mockRejectedValue(new Error('falha de conexao'))

      await expect(service.create(validPayload)).rejects.toThrow('falha de conexao')
    })
  })

  describe('getById', () => {
    it('retorna o usuario encontrado', async () => {
      const user = { id: '1', name: 'Maria' }
      repository.findById.mockResolvedValue(user)

      const result = await service.getById('1')

      expect(result).toBe(user)
    })

    it('lanca erro quando o usuario nao existe', async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.getById('404')).rejects.toThrow(NotFoundError)
    })
  })

  describe('list', () => {
    it('retorna todos os usuarios', async () => {
      const users = [{ id: '1' }, { id: '2' }]
      repository.findAll.mockResolvedValue(users)

      const result = await service.list()

      expect(result).toHaveLength(2)
      expect(result).toEqual(users)
    })

    it('retorna lista vazia quando nao ha usuarios', async () => {
      repository.findAll.mockResolvedValue([])

      const result = await service.list()

      expect(result).toEqual([])
    })
  })

  describe('update', () => {
    const existing = { id: '1', name: 'Maria', email: 'maria@email.com', age: 25 }

    it('atualiza dados validos', async () => {
      repository.findById.mockResolvedValue(existing)
      repository.findByEmail.mockResolvedValue(null)
      repository.update.mockImplementation(async (id, data) => ({ ...existing, ...data }))

      const result = await service.update('1', { name: ' Maria Souza ', email: 'NOVO@email.com' })

      expect(repository.update).toHaveBeenCalledWith('1', {
        name: 'Maria Souza',
        email: 'novo@email.com'
      })
      expect(result.name).toBe('Maria Souza')
      expect(result.email).toBe('novo@email.com')
    })

    it('permite manter o proprio email', async () => {
      repository.findById.mockResolvedValue(existing)
      repository.findByEmail.mockResolvedValue(existing)
      repository.update.mockResolvedValue(existing)

      const result = await service.update('1', { email: 'maria@email.com' })

      expect(result).toEqual(existing)
    })

    it('atualiza apenas a idade sem consultar email', async () => {
      repository.findById.mockResolvedValue(existing)
      repository.update.mockResolvedValue({ ...existing, age: 30 })

      const result = await service.update('1', { age: 30 })

      expect(repository.findByEmail).not.toHaveBeenCalled()
      expect(result.age).toBe(30)
    })

    it('rejeita payload vazio', async () => {
      await expect(service.update('1', {})).rejects.toThrow(ValidationError)
    })

    it('rejeita payload invalido', async () => {
      await expect(service.update('1', { email: 'invalido' })).rejects.toThrow(ValidationError)
    })

    it('lanca erro quando o usuario nao existe', async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.update('404', { name: 'Novo Nome' })).rejects.toThrow(NotFoundError)

      expect(repository.update).not.toHaveBeenCalled()
    })

    it('rejeita idade abaixo do minimo', async () => {
      repository.findById.mockResolvedValue(existing)

      await expect(service.update('1', { age: 10 })).rejects.toThrow(BusinessRuleError)
    })

    it('rejeita email pertencente a outro usuario', async () => {
      repository.findById.mockResolvedValue(existing)
      repository.findByEmail.mockResolvedValue({ id: '2', email: 'outro@email.com' })

      await expect(service.update('1', { email: 'outro@email.com' })).rejects.toThrow(
        ConflictError
      )

      expect(repository.update).not.toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('remove usuario existente', async () => {
      repository.findById.mockResolvedValue({ id: '1' })
      repository.delete.mockResolvedValue(true)

      const result = await service.remove('1')

      expect(repository.delete).toHaveBeenCalledWith('1')
      expect(result).toBe(true)
    })

    it('lanca erro ao remover usuario inexistente', async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.remove('404')).rejects.toThrow(NotFoundError)

      expect(repository.delete).not.toHaveBeenCalled()
    })
  })

  describe('erros de dominio', () => {
    it('expoe codigo e status HTTP', async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.getById('404')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND'
      })
    })
  })
})

describe('UserService com repositorio em memoria', () => {
  let service

  beforeEach(() => {
    service = new UserService(new UserRepository())
  })

  it('executa o ciclo completo de criar, buscar, atualizar e remover', async () => {
    const created = await service.create({
      name: 'Joao Pereira',
      email: 'joao@email.com',
      age: 30
    })

    const found = await service.getById(created.id)
    const updated = await service.update(created.id, { age: 31 })
    const removed = await service.remove(created.id)

    expect(found.email).toBe('joao@email.com')
    expect(updated.age).toBe(31)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(removed).toBe(true)
    await expect(service.getById(created.id)).rejects.toThrow(NotFoundError)
  })

  it('impede dois usuarios com o mesmo email', async () => {
    const payload = { name: 'Ana Lima', email: 'ana@email.com', age: 22 }
    await service.create(payload)

    await expect(service.create(payload)).rejects.toThrow(ConflictError)
  })

  it('lista os usuarios criados', async () => {
    await service.create({ name: 'Ana Lima', email: 'ana@email.com', age: 22 })
    await service.create({ name: 'Bruno Costa', email: 'bruno@email.com', age: 28 })

    const users = await service.list()

    expect(users).toHaveLength(2)
    expect(users.map((u) => u.email)).toEqual(
      expect.arrayContaining(['ana@email.com', 'bruno@email.com'])
    )
  })

  it('retorna copias e nao expoe o estado interno', async () => {
    const created = await service.create({
      name: 'Carla Dias',
      email: 'carla@email.com',
      age: 40
    })

    created.name = 'Alterado fora do servico'
    const found = await service.getById(created.id)

    expect(found.name).toBe('Carla Dias')
  })
})
