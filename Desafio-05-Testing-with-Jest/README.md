# Desafio 05 - Testes com Jest

Suite de testes unitarios para as regras de negocio de um servico de usuarios.

## Estrutura

```
src/
  errors/AppError.js             erros de dominio com status HTTP e codigo
  validators/userValidator.js    validacao de payload (completo e parcial)
  repositories/userRepository.js repositorio em memoria (assincrono)
  services/userService.js        regras de negocio
tests/
  userValidator.test.js
  userService.test.js
  userRepository.test.js
  AppError.test.js
evidencias/                      prints dos testes e da cobertura
.github/workflows/ci.yml         pipeline de testes
```

## Regras de negocio cobertas

- Criacao de usuario valido, com normalizacao de nome e email.
- Rejeicao de payload invalido (nome, email e idade).
- Usuario deve ter no minimo 18 anos.
- Email deve ser unico, inclusive na atualizacao.
- Atualizacao parcial de dados.
- Busca e remocao de usuario inexistente geram erro 404.

## Como executar

```
npm install
npm test
npm run test:coverage
```

O relatorio de cobertura e exibido no terminal e gerado em `coverage/lcov-report/index.html`.

## Tecnicas utilizadas

- Padrao arrange, act, assert em todos os testes.
- Testes sincronos (validador) e assincronos (`async/await`, `resolves`, `rejects`).
- Matchers: `toBe`, `toEqual`, `toMatchObject`, `toThrow`, `toHaveBeenCalledWith`, `toHaveLength`, `toBeInstanceOf`, `expect.any`, `expect.arrayContaining`.
- Mocks com `jest.fn()` para isolar o service do repositorio.
- Testes parametrizados com `it.each`.
- Testes de integracao leve entre service e repositorio em memoria.

## Parte opcional

- Meta minima de 80% de cobertura configurada em `jest.config.js` (`coverageThreshold`). O comando falha se a cobertura cair abaixo disso.
- Pipeline de CI com GitHub Actions em `.github/workflows/ci.yml`.
