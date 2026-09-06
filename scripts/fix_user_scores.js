const { MongoClient } = require('mongodb');


async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(); // Uses default DB from URI
    const usersCol = db.collection('users');
    const recordingsCol = db.collection('recordings');

    console.log("Connected to MongoDB. Fetching users...");
    const users = await usersCol.find({}).toArray();
    
    for (const user of users) {
      if (!user.userId) continue;

      // Group recordings by songId to get the latest/best score per song
      const recordings = await recordingsCol.find({ userId: user.userId }).toArray();
      
      // Since our new rule is 1 per song (and overwrite), we only care about unique songIds.
      // If there are somehow multiple recordings per song from before the bug fix,
      // we'll just take the highest score for that song.
      const bestScores = {};
      
      for (const rec of recordings) {
        const score = rec.score || 0;
        if (!bestScores[rec.songId] || score > bestScores[rec.songId]) {
          bestScores[rec.songId] = score;
        }
      }

      const karaokeCount = Object.keys(bestScores).length;
      const totalKaraokeRating = Object.values(bestScores).reduce((sum, score) => sum + score, 0);

      if (user.totalKaraokeRating !== totalKaraokeRating || user.karaokeCount !== karaokeCount) {
        console.log(`Updating user ${user.name} (${user.userId}): totalKaraokeRating ${user.totalKaraokeRating} -> ${totalKaraokeRating}, karaokeCount ${user.karaokeCount} -> ${karaokeCount}`);
        
        await usersCol.updateOne(
          { _id: user._id },
          { $set: { totalKaraokeRating, karaokeCount } }
        );
      } else {
        console.log(`User ${user.name} (${user.userId}) is already correct.`);
      }
    }
    
    console.log("Finished repairing user scores.");

  } catch (error) {
    console.error("Error repairing scores:", error);
  } finally {
    await client.close();
  }
}

main();
