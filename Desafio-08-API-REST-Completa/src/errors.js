class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const errors = {
  validation: (details) => new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos', details),
  unauthorized: (msg = 'Autenticação necessária') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso'),
  notFound: (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} não encontrado`),
  conflict: (msg) => new AppError(409, 'CONFLICT', msg),
};

module.exports = { AppError, errors };
