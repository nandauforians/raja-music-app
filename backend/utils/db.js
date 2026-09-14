const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function getDb() {
  if (global.__MONGO_CACHED_CLIENT__) {
    return global.__MONGO_CACHED_CLIENT__.db("raja-music-db");
  }
  const client = new MongoClient(uri);
  await client.connect();
  global.__MONGO_CACHED_CLIENT__ = client;
  return client.db("raja-music-db");
}

function resetDb() {
  global.__MONGO_CACHED_CLIENT__ = null;
}

function setMockClient(mockDb) {
  global.__MONGO_CACHED_CLIENT__ = { db: () => mockDb };
}

module.exports = { getDb, resetDb, setMockClient };
