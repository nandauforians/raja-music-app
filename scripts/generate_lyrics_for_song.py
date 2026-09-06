import os, sys
from pathlib import Path
from daily_karaoke import generate_lyrics_with_gemini, update_mongodb, load_env

project_root = Path(__file__).parent.parent
load_env(project_root / '.env')

song_id = "7"
title = "Thenpaandi Cheemaiyile"
# The source file for song 7
audio_path = str(project_root / "songs" / "Thenpaandi-Nayagan.m4a")

print(f"Generating lyrics for {title}...")
lyrics = generate_lyrics_with_gemini(audio_path, title)

if lyrics:
    print("Lyrics generated. Updating MongoDB...")
    # Get current DB entry to preserve existing karaoke_url if any, or just update synced_lyrics
    from pymongo import MongoClient
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client['raja-music-db']
    songs = db['songs']
    songs.update_one({"id": song_id}, {"$set": {"synced_lyrics": lyrics}})
    print("Done!")
else:
    print("Failed to generate lyrics.")
