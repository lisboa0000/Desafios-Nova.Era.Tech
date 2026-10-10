const { randomUUID } = require('crypto')

class UserRepository {
  constructor() {
    this.users = new Map()
  }

  async create(data) {
    const user = { id: randomUUID(), ...data, createdAt: new Date() }
    this.users.set(user.id, user)
    return { ...user }
  }

  async findById(id) {
    const user = this.users.get(id)
    return user ? { ...user } : null
  }

  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return { ...user }
      }
    }
    return null
  }

  async findAll() {
    return Array.from(this.users.values()).map((user) => ({ ...user }))
  }

  async update(id, data) {
    const current = this.users.get(id)
    if (!current) {
      return null
    }
    const updated = { ...current, ...data, updatedAt: new Date() }
    this.users.set(id, updated)
    return { ...updated }
  }

  async delete(id) {
    return this.users.delete(id)
  }
}

module.exports = UserRepository
