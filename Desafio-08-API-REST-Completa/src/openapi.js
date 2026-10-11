const err = { description: 'Erro padronizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const sec = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const body = (ref) => ({ required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
const json = (ref, d = 'OK') => ({ description: d, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
const levels = ['beginner', 'intermediate', 'advanced'];

const openapi = {
  openapi: '3.0.3',
  info: { title: 'API de Cursos', version: '1.0.0' },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: { nullable: true } } } } },
      CourseInput: { type: 'object', required: ['title', 'category', 'level'], properties: { title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, level: { type: 'string', enum: levels } } },
      Course: { allOf: [{ $ref: '#/components/schemas/CourseInput' }, { type: 'object', properties: { id: { type: 'integer' }, created_at: { type: 'string' } } }] },
      CoursePage: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Course' } }, meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } } } },
      Register: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 6 } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      Token: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
      Enrollment: { type: 'object', properties: { id: { type: 'integer' }, user_id: { type: 'integer' }, course_id: { type: 'integer' }, created_at: { type: 'string' } } },
    },
  },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], summary: 'Cadastra aluno', requestBody: body('Register'), responses: { 201: json('User', 'Criado'), 400: err, 409: err } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Login (retorna JWT)', requestBody: body('Login'), responses: { 200: json('Token'), 401: err } } },
    '/courses': {
      get: {
        tags: ['Cursos'], summary: 'Lista paginada',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'string', enum: levels } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Busca no título' },
        ],
        responses: { 200: json('CoursePage'), 400: err },
      },
      post: { tags: ['Cursos'], summary: 'Cria curso (admin)', security: sec, requestBody: body('CourseInput'), responses: { 201: json('Course', 'Criado'), 400: err, 401: err, 403: err } },
    },
    '/courses/{id}': {
      get: { tags: ['Cursos'], summary: 'Detalhe', parameters: [idParam], responses: { 200: json('Course'), 404: err } },
      put: { tags: ['Cursos'], summary: 'Atualiza (admin)', security: sec, parameters: [idParam], requestBody: body('CourseInput'), responses: { 200: json('Course'), 400: err, 401: err, 403: err, 404: err } },
      delete: { tags: ['Cursos'], summary: 'Remove (admin)', security: sec, parameters: [idParam], responses: { 204: { description: 'Removido' }, 401: err, 403: err, 404: err } },
    },
    '/courses/{id}/enrollments': {
      post: { tags: ['Matrículas'], summary: 'Matricula o usuário logado', security: sec, parameters: [idParam], responses: { 201: json('Enrollment', 'Criada'), 401: err, 404: err, 409: err } },
      delete: { tags: ['Matrículas'], summary: 'Cancela a matrícula do usuário logado', security: sec, parameters: [idParam], responses: { 204: { description: 'Cancelada' }, 401: err, 404: err } },
      get: { tags: ['Matrículas'], summary: 'Lista alunos do curso (admin)', security: sec, parameters: [idParam], responses: { 200: { description: 'OK' }, 401: err, 403: err, 404: err } },
    },
    '/me/enrollments': { get: { tags: ['Matrículas'], summary: 'Minhas matrículas', security: sec, responses: { 200: { description: 'OK' }, 401: err } } },
  },
};

const docsHtml = `<!doctype html><html><head><meta charset="utf-8"><title>API de Cursos - Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/v1/openapi.json', dom_id: '#ui' });</script></body></html>`;

module.exports = { openapi, docsHtml };
