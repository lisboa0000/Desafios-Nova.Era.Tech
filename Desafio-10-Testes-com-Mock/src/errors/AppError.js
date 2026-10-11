class AppError extends Error {
  constructor(message, code = 'APP_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 'CONFLICT')
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR')
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 'NOT_FOUND')
  }
}

class PaymentError extends AppError {
  constructor(message, cause) {
    super(message, 'PAYMENT_FAILED')
    this.cause = cause
  }
}

module.exports = { AppError, ConflictError, ValidationError, NotFoundError, PaymentError }
