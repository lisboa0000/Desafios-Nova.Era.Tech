const { MongoClient } = require('mongodb');

let client;
let db;

async function connect(uri, dbName) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  // Feed: ordenação por data e filtro por hashtag + data
  await db.collection('posts').createIndexes([
    { key: { createdAt: -1 } },
    { key: { hashtags: 1, createdAt: -1 } },
    { key: { author: 1, createdAt: -1 } },
  ]);
  return db;
}

const getDb = () => db;
const close = () => client && client.close();

module.exports = { connect, getDb, close };
