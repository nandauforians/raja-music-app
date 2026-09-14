#!/usr/bin/env node
// ============================================================================
// BACKFILL VOICE SEARCH METADATA
// Adds 'actors' and 'searchable_text' to all songs missing them.
// Uses Gemini to look up cast of each Tamil film.
// Run: node scripts/backfill_voice_metadata.js
// ============================================================================

require('dotenv').config();
const { MongoClient } = require('../backend/node_modules/mongodb');
const { GoogleGenerativeAI } = require('../backend/node_modules/@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function buildSearchableText(song) {
  const parts = [
    song.title,
    song.movie,
    song.year ? String(song.year) : '',
    song.decade || '',
    song.director || '',
    (song.singers || []).join(' '),
    (song.actors || []).join(' '),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

async function enrichSong(song) {
  const prompt = `You are a Tamil cinema expert with deep knowledge of all Ilayaraja films.
For the Tamil/Telugu film "${song.movie}" (${song.year || 'unknown year'}), provide metadata as JSON.

Return ONLY a raw JSON object (no markdown, no backticks):
{
  "actors": ["Lead Actor 1", "Lead Actor 2"],
  "director": "Director Name"
}

Rules:
- actors: list the 2-3 lead cast members of the film (not singers, not musicians). 
- director: the film's director (not Ilayaraja).
- If unsure about a film, return empty arrays/strings rather than guessing incorrectly.
- Use the most common English transliteration of Tamil names (e.g., "Kamal Haasan" not "Kamal Hassan").`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);
    return {
      actors: Array.isArray(data.actors) ? data.actors : [],
      director: data.director || '',
    };
  } catch (e) {
    console.warn(`  Warning: Gemini failed for "${song.title}" (${song.movie}): ${e.message}`);
    return { actors: [], director: song.director || '' };
  }
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('raja-music-db');
  const col = db.collection('songs');

  const songs = await col.find({}).toArray();
  console.log(`Found ${songs.length} songs to process.`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const alreadyHasActors = Array.isArray(song.actors) && song.actors.length > 0;
    const alreadyHasText = !!song.searchable_text;

    if (alreadyHasActors && alreadyHasText) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${songs.length}] "${song.title}" (${song.movie}) ... `);

    let enriched = {};
    if (!alreadyHasActors) {
      enriched = await enrichSong(song);
      await new Promise(r => setTimeout(r, 600)); // rate limit
    } else {
      enriched = { actors: song.actors, director: song.director };
    }

    const mergedSong = { ...song, ...enriched };
    const searchable_text = buildSearchableText(mergedSong);

    const updateData = {
      searchable_text,
      ...(enriched.actors && enriched.actors.length ? { actors: enriched.actors } : {}),
      ...(enriched.director && !song.director ? { director: enriched.director } : {}),
    };

    await col.updateOne({ _id: song._id }, { $set: updateData });
    console.log(`OK - actors: [${(enriched.actors || []).join(', ')}]`);
    updated++;
  }

  console.log(`\nDone! Updated: ${updated}, Skipped (already complete): ${skipped}`);
  await client.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
