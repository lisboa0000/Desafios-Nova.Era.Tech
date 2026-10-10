const { ValidationError } = require('../errors/AppError')

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function collectErrors(payload, partial) {
  const errors = []
  const has = (field) => payload[field] !== undefined

  if (!partial || has('name')) {
    if (typeof payload.name !== 'string' || payload.name.trim().length < 3) {
      errors.push('name deve ser um texto com no minimo 3 caracteres')
    }
  }

  if (!partial || has('email')) {
    if (typeof payload.email !== 'string' || !EMAIL_REGEX.test(payload.email)) {
      errors.push('email deve ser um endereco valido')
    }
  }

  if (!partial || has('age')) {
    if (!Number.isInteger(payload.age) || payload.age < 0 || payload.age > 120) {
      errors.push('age deve ser um numero inteiro entre 0 e 120')
    }
  }

  return errors
}

function validateUserPayload(payload, options = {}) {
  const partial = Boolean(options.partial)

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError(['payload deve ser um objeto'])
  }

  const errors = collectErrors(payload, partial)

  if (partial && Object.keys(payload).length === 0) {
    errors.push('informe ao menos um campo para atualizar')
  }

  if (errors.length > 0) {
    throw new ValidationError(errors)
  }

  return true
}

module.exports = { validateUserPayload }
