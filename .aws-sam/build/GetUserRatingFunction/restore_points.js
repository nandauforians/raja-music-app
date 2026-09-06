const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('raja-music-db');
  
  const targetUser = await db.collection('users').findOne({ $or: [{ email: /nanda\.subramaniam\.74/i }, { userId: /nanda/i }, { name: /nanda/i }] });
  console.log("Target user:", targetUser);
  
  if (targetUser) {
    const result = await db.collection('users').updateOne(
      { _id: targetUser._id },
      { $inc: { totalPoints: 100 } }
    );
    console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
  } else {
    console.log("User not found!");
  }
  
  await client.close();
}

main().catch(console.error);
