// Implementacao em memoria do contrato UserRepository (usada nos testes de contrato).
class InMemoryUserRepository {
  constructor() {
    this.users = []
  }

  async create(data) {
    const user = { id: String(this.users.length + 1), ...data }
    this.users.push(user)
    return user
  }

  async findByEmail(email) {
    return this.users.find((u) => u.email === email) || null
  }

  async findById(id) {
    return this.users.find((u) => u.id === id) || null
  }
}

module.exports = InMemoryUserRepository
