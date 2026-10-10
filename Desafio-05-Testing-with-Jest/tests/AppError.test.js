const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
} = require('../src/errors/AppError')

describe('AppError', () => {
  it('usa valores padrao quando nenhum argumento e informado', () => {
    const error = new AppError('falha')

    expect(error.message).toBe('falha')
    expect(error.statusCode).toBe(500)
    expect(error.code).toBe('APP_ERROR')
    expect(error.details).toEqual([])
  })

  it('aceita valores personalizados', () => {
    const error = new AppError('falha', 418, 'TEAPOT', ['detalhe'])

    expect(error.statusCode).toBe(418)
    expect(error.code).toBe('TEAPOT')
    expect(error.details).toEqual(['detalhe'])
  })

  it('NotFoundError usa mensagem padrao', () => {
    const error = new NotFoundError()

    expect(error.message).toBe('Recurso nao encontrado')
    expect(error.statusCode).toBe(404)
  })

  it('ConflictError usa mensagem padrao', () => {
    const error = new ConflictError()

    expect(error.message).toBe('Conflito de dados')
    expect(error.statusCode).toBe(409)
  })

  it('BusinessRuleError usa status 422', () => {
    const error = new BusinessRuleError('regra violada')

    expect(error.statusCode).toBe(422)
    expect(error.code).toBe('BUSINESS_RULE')
  })

  it('ValidationError guarda a lista de detalhes', () => {
    const error = new ValidationError(['campo invalido'])

    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual(['campo invalido'])
  })

  it('mantem o nome da classe e e instancia de Error', () => {
    const error = new NotFoundError()

    expect(error.name).toBe('NotFoundError')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })
})