const { validateUserPayload } = require('../src/validators/userValidator')
const { ValidationError } = require('../src/errors/AppError')

describe('userValidator', () => {
  const validPayload = { name: 'Maria Silva', email: 'maria@email.com', age: 25 }

  it('aceita um payload valido', () => {
    const payload = { ...validPayload }

    const result = validateUserPayload(payload)

    expect(result).toBe(true)
  })

  it.each([null, undefined, 'texto', 10, []])(
    'rejeita payload que nao e um objeto: %p',
    (payload) => {
      expect(() => validateUserPayload(payload)).toThrow(ValidationError)
    }
  )

  it('rejeita nome curto', () => {
    const payload = { ...validPayload, name: 'Al' }

    expect(() => validateUserPayload(payload)).toThrow(ValidationError)
  })

  it('rejeita nome que nao e texto', () => {
    const payload = { ...validPayload, name: 123 }

    expect(() => validateUserPayload(payload)).toThrow(ValidationError)
  })

  it('rejeita email invalido', () => {
    const payload = { ...validPayload, email: 'email-invalido' }

    expect(() => validateUserPayload(payload)).toThrow(ValidationError)
  })

  it.each([-1, 121, 20.5, '30', null])('rejeita idade invalida: %p', (age) => {
    const payload = { ...validPayload, age }

    expect(() => validateUserPayload(payload)).toThrow(ValidationError)
  })

  it('reune todos os erros encontrados', () => {
    const payload = { name: '', email: 'x', age: -5 }

    let error
    try {
      validateUserPayload(payload)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.statusCode).toBe(400)
    expect(error.details).toHaveLength(3)
  })

  describe('modo parcial', () => {
    it('aceita apenas um campo valido', () => {
      const payload = { name: 'Novo Nome' }

      const result = validateUserPayload(payload, { partial: true })

      expect(result).toBe(true)
    })

    it('rejeita objeto vazio', () => {
      expect(() => validateUserPayload({}, { partial: true })).toThrow(ValidationError)
    })

    it('rejeita campo informado com valor invalido', () => {
      const payload = { email: 'invalido' }

      expect(() => validateUserPayload(payload, { partial: true })).toThrow(ValidationError)
    })
  })
})
