// Contratos das dependencias externas: metodos que cada colaborador deve expor.
// Os services dependem apenas destes contratos, nunca de uma implementacao concreta.
const contracts = {
  UserRepository: ['create', 'findByEmail', 'findById'],
  PasswordHasher: ['hash'],
  EventQueue: ['publish'],
  PaymentGateway: ['charge'],
  OrderRepository: ['findById', 'save']
}

function assertImplements(contractName, candidate) {
  const methods = contracts[contractName]
  if (!methods) throw new Error(`Contrato desconhecido: ${contractName}`)

  const missing = methods.filter((m) => !candidate || typeof candidate[m] !== 'function')
  if (missing.length) {
    throw new TypeError(`${contractName} invalido, metodos ausentes: ${missing.join(', ')}`)
  }
  return candidate
}

module.exports = { contracts, assertImplements }
