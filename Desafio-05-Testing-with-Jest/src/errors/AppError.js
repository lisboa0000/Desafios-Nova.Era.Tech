class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR', details = []) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Payload invalido', 400, 'VALIDATION_ERROR', details)
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso nao encontrado') {
    super(message, 404, 'NOT_FOUND')
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflito de dados') {
    super(message, 409, 'CONFLICT')
  }
}

class BusinessRuleError extends AppError {
  constructor(message) {
    super(message, 422, 'BUSINESS_RULE')
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
}
