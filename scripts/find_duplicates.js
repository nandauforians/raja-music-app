require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('raja-music-db');
    const songs = await db.collection('songs').find({}).toArray();

    console.log(`Found ${songs.length} songs. Checking for duplicates...`);

    const duplicates = [];
    // Group songs by normalized movie
    const moviesMap = new Map();

    for (const song of songs) {
      const normMovie = normalizeString(song.movie);
      if (!normMovie) continue;

      if (!moviesMap.has(normMovie)) {
        moviesMap.set(normMovie, []);
      }
      moviesMap.get(normMovie).push(song);
    }

    for (const [movie, movieSongs] of moviesMap.entries()) {
      for (let i = 0; i < movieSongs.length; i++) {
        for (let j = i + 1; j < movieSongs.length; j++) {
          const songA = movieSongs[i];
          const songB = movieSongs[j];

          const normTitleA = normalizeString(songA.title);
          const normTitleB = normalizeString(songB.title);

          let isDuplicate = false;
          let reason = '';

          if (normTitleA === normTitleB && normTitleA !== '') {
            isDuplicate = true;
            reason = 'Title Match (Same Movie)';
          } else if (songA.spotify_id && songB.spotify_id && songA.spotify_id === songB.spotify_id) {
            isDuplicate = true;
            reason = 'Spotify ID Match (Same Movie)';
          }

          if (isDuplicate) {
            // Avoid adding the exact same pair multiple times if we somehow process it again
            duplicates.push({ song1: songA, song2: songB, reason });
          }
        }
      }
    }

    if (duplicates.length === 0) {
      console.log('No duplicates found!');
    } else {
      console.log(`\nFound ${duplicates.length} potential duplicates:\n`);
      duplicates.forEach((d, i) => {
        console.log(`[Duplicate ${i + 1}] - Reason: ${d.reason}`);
        console.log(`  Song A (ID: ${d.song1.id}): ${d.song1.title} - ${d.song1.movie}`);
        console.log(`  Song B (ID: ${d.song2.id}): ${d.song2.title} - ${d.song2.movie}`);
        console.log('---');
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
