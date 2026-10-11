const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('./db');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function toId(value, field) {
  if (typeof value !== 'string' || !ObjectId.isValid(value) || value.length !== 24) {
    throw new HttpError(400, `${field} inválido`);
  }
  return new ObjectId(value);
}

function extractHashtags(content, extra = []) {
  const found = [...content.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  return [...new Set([...found, ...extra].map((h) => str(h).replace(/^#/, '').toLowerCase()).filter(Boolean))];
}

async function requireUser(id, field) {
  const _id = toId(id, field);
  const user = await getDb().collection('users').findOne({ _id });
  if (!user) throw new HttpError(404, 'Usuário não encontrado');
  return user;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/users', wrap(async (req, res) => {
  const name = str(req.body.name);
  const username = str(req.body.username).toLowerCase();
  const errors = {};
  if (!name) errors.name = 'obrigatório';
  if (!/^[a-z0-9_]{3,30}$/.test(username)) errors.username = 'obrigatório: 3-30 caracteres [a-z0-9_]';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dados inválidos', errors);

  const doc = { name, username, createdAt: new Date() };
  try {
    const { insertedId } = await getDb().collection('users').insertOne(doc);
    res.status(201).json({ _id: insertedId, ...doc });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, 'username já em uso');
    throw e;
  }
}));

app.post('/posts', wrap(async (req, res) => {
  const content = str(req.body.content);
  if (!content) throw new HttpError(400, 'Dados inválidos', { content: 'obrigatório' });
  if (content.length > 500) throw new HttpError(400, 'Dados inválidos', { content: 'máximo 500 caracteres' });
  if (req.body.hashtags !== undefined && !Array.isArray(req.body.hashtags)) {
    throw new HttpError(400, 'Dados inválidos', { hashtags: 'deve ser um array' });
  }
  const author = await requireUser(req.body.author, 'author');

  const doc = {
    author: author._id,
    content,
    hashtags: extractHashtags(content, req.body.hashtags),
    comments: [], // embutidos: lidos sempre junto com o post
    commentsCount: 0,
    likes: [],
    likesCount: 0,
    createdAt: new Date(),
  };
  const { insertedId } = await getDb().collection('posts').insertOne(doc);
  res.status(201).json({ _id: insertedId, ...doc });
}));

app.post('/posts/:id/comments', wrap(async (req, res) => {
  const postId = toId(req.params.id, 'id');
  const text = str(req.body.text);
  if (!text) throw new HttpError(400, 'Dados inválidos', { text: 'obrigatório' });
  const author = await requireUser(req.body.author, 'author');

  const comment = { _id: new ObjectId(), author: author._id, text, createdAt: new Date() };
  const r = await getDb().collection('posts').updateOne(
    { _id: postId },
    { $push: { comments: comment }, $inc: { commentsCount: 1 } },
  );
  if (!r.matchedCount) throw new HttpError(404, 'Post não encontrado');
  res.status(201).json(comment);
}));

// Opcional: curtir (idempotente via $addToSet)
app.post('/posts/:id/likes', wrap(async (req, res) => {
  const postId = toId(req.params.id, 'id');
  const user = await requireUser(req.body.user, 'user');
  const posts = getDb().collection('posts');
  const r = await posts.updateOne({ _id: postId, likes: { $ne: user._id } }, { $addToSet: { likes: user._id }, $inc: { likesCount: 1 } });
  if (!r.matchedCount && !(await posts.countDocuments({ _id: postId }))) throw new HttpError(404, 'Post não encontrado');
  res.status(r.modifiedCount ? 201 : 200).json({ liked: true });
}));

app.get('/feed', wrap(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const match = {};
  if (req.query.hashtag) match.hashtags = str(String(req.query.hashtag)).replace(/^#/, '').toLowerCase();

  const posts = await getDb().collection('posts').aggregate([
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'author', pipeline: [{ $project: { name: 1, username: 1 } }] } },
    { $unwind: '$author' },
    // Só os 3 comentários mais recentes vão no feed; o total vem de commentsCount
    { $addFields: { recentComments: { $slice: [{ $reverseArray: '$comments' }, 3] } } },
    { $project: { comments: 0, likes: 0 } },
  ]).toArray();

  res.json({ page, limit, data: posts });
}));

// Opcional: top hashtags
app.get('/hashtags/top', wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const top = await getDb().collection('posts').aggregate([
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', total: { $sum: 1 } } },
    { $sort: { total: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, hashtag: '$_id', total: 1 } },
  ]).toArray();
  res.json(top);
}));

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

module.exports = app;
