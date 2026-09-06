const fs = require('fs');
const path = require('path');

// Run with: SPOTIFY_CLIENT_ID=your_id SPOTIFY_CLIENT_SECRET=your_secret node scripts/fetch_spotify_ids.js
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '70a1295210854963b95b8b687eb68883';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'f84766db292541318bd8e73a568f5e53';

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

async function searchSpotifyTrack(title, movie, token) {
  // Construct search query
  const query = encodeURIComponent(`${title} ${movie}`);
  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (data.tracks && data.tracks.items.length > 0) {
    return data.tracks.items[0].id;
  }
  return null;
}

async function processSongs() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are not set.");
    process.exit(1);
  }

  console.log("Fetching Spotify Access Token...");
  const token = await getSpotifyToken();
  if (!token) {
    console.error("Failed to get token.");
    return;
  }

  const dbPath = path.join(process.cwd(), 'ilayaraja_songs_database.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  let updatedCount = 0;

  console.log(`Processing ${db.songs.length} songs...`);

  // Process sequentially to respect rate limits
  for (let i = 0; i < db.songs.length; i++) {
    const song = db.songs[i];
    
    if (!song.spotify_id) {
      console.log(`Searching for: ${song.title} (${song.movie})...`);
      const spotifyId = await searchSpotifyTrack(song.title, song.movie, token);
      
      if (spotifyId) {
        song.spotify_id = spotifyId;
        console.log(`✅ Found ID: ${spotifyId}`);
        updatedCount++;
      } else {
        console.log(`❌ Not found.`);
      }
      
      // Small delay to avoid aggressive rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`\n🎉 Successfully updated ${updatedCount} songs with Spotify IDs!`);
  } else {
    console.log("\nNo new Spotify IDs found.");
  }
}

processSongs();
