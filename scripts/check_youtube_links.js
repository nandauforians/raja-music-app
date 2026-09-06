const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const songs = await db.collection('songs').find({ youtube_url: { $exists: true, $ne: null } }).toArray();
  console.log(JSON.stringify(songs.map(s => ({ id: s.id, title: s.title, youtube_url: s.youtube_url })), null, 2));
  await client.close();
}
check().catch(console.error);
