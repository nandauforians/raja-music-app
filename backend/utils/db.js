const { MongoClient } = require('mongodb');

async function getDb() {
  if (global.__MONGO_CACHED_CLIENT__) {
    return global.__MONGO_CACHED_CLIENT__.db("raja-music-db");
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is missing");
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
