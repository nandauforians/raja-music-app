const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('raja-music-db');
  
  // Update user by email if we don't have the exact userId, but let's see if we can find them
  const result = await db.collection('users').updateOne(
    { email: 'nanda.subramaniam.74@gmail.com' },
    { $inc: { totalPoints: 100 } }
  );
  
  console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
  await client.close();
}

main().catch(console.error);
