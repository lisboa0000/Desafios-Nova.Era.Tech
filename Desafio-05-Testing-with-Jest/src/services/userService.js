const { validateUserPayload } = require('../validators/userValidator')
const {
  NotFoundError,
  ConflictError,
  BusinessRuleError
} = require('../errors/AppError')

const MINIMUM_AGE = 18

class UserService {
  constructor(repository) {
    this.repository = repository
  }

  async create(payload) {
    validateUserPayload(payload)

    if (payload.age < MINIMUM_AGE) {
      throw new BusinessRuleError(`Usuario deve ter no minimo ${MINIMUM_AGE} anos`)
    }

    const email = payload.email.trim().toLowerCase()
    const existing = await this.repository.findByEmail(email)

    if (existing) {
      throw new ConflictError('Ja existe um usuario com este email')
    }

    return this.repository.create({
      name: payload.name.trim(),
      email,
      age: payload.age
    })
  }

  async getById(id) {
    const user = await this.repository.findById(id)

    if (!user) {
      throw new NotFoundError('Usuario nao encontrado')
    }

    return user
  }

  async list() {
    return this.repository.findAll()
  }

  async update(id, payload) {
    validateUserPayload(payload, { partial: true })

    await this.getById(id)

    const changes = { ...payload }

    if (changes.age !== undefined && changes.age < MINIMUM_AGE) {
      throw new BusinessRuleError(`Usuario deve ter no minimo ${MINIMUM_AGE} anos`)
    }

    if (changes.name !== undefined) {
      changes.name = changes.name.trim()
    }

    if (changes.email !== undefined) {
      changes.email = changes.email.trim().toLowerCase()
      const owner = await this.repository.findByEmail(changes.email)

      if (owner && owner.id !== id) {
        throw new ConflictError('Ja existe um usuario com este email')
      }
    }

    return this.repository.update(id, changes)
  }

  async remove(id) {
    await this.getById(id)
    await this.repository.delete(id)
    return true
  }
}

module.exports = UserService
