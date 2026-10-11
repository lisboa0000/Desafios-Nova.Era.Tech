const { assertImplements } = require('../contracts')
const { ConflictError, ValidationError } = require('../errors/AppError')

class UserRegistrationService {
  constructor({ userRepository, passwordHasher, eventQueue }) {
    this.userRepository = assertImplements('UserRepository', userRepository)
    this.passwordHasher = assertImplements('PasswordHasher', passwordHasher)
    this.eventQueue = assertImplements('EventQueue', eventQueue)
  }

  async register({ name, email, password }) {
    if (!name || !name.trim()) throw new ValidationError('Nome obrigatorio')
    if (!email || !email.includes('@')) throw new ValidationError('Email invalido')
    if (!password || password.length < 8) {
      throw new ValidationError('Senha deve ter no minimo 8 caracteres')
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (await this.userRepository.findByEmail(normalizedEmail)) {
      throw new ConflictError('Ja existe um usuario com este email')
    }

    const passwordHash = await this.passwordHasher.hash(password)
    const user = await this.userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    })

    // O evento so e publicado depois que o usuario foi persistido.
    await this.eventQueue.publish('user.registered', { userId: user.id, email: user.email })

    return { id: user.id, name: user.name, email: user.email }
  }
}

module.exports = UserRegistrationService
