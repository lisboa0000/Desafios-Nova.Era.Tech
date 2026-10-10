const UserRepository = require('../src/repositories/userRepository')

describe('UserRepository', () => {
  let repository

  beforeEach(() => {
    repository = new UserRepository()
  })

  it('cria usuario com id e data de criacao', async () => {
    const data = { name: 'Maria', email: 'maria@email.com', age: 25 }

    const result = await repository.create(data)

    expect(result.id).toEqual(expect.any(String))
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result).toMatchObject(data)
  })

  it('retorna null ao buscar id inexistente', async () => {
    const result = await repository.findById('inexistente')

    expect(result).toBeNull()
  })

  it('retorna null ao buscar email inexistente', async () => {
    const result = await repository.findByEmail('nao@existe.com')

    expect(result).toBeNull()
  })

  it('retorna null ao atualizar id inexistente', async () => {
    const result = await repository.update('inexistente', { name: 'Novo' })

    expect(result).toBeNull()
  })

  it('retorna false ao remover id inexistente', async () => {
    const result = await repository.delete('inexistente')

    expect(result).toBe(false)
  })
})
