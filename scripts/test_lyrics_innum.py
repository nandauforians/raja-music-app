import sys
import os
import requests
import urllib.request
from pymongo import MongoClient

# Setup paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.daily_karaoke import generate_lyrics_with_gemini

MONGODB_URI = os.environ.get('MONGODB_URI', "mongodb+srv://raja_music_app_user:ggC1gX8ioaPtGjck@cluster0.wvg2owx.mongodb.net/raja-music-db?appName=Cluster0")

def main():
    client = MongoClient(MONGODB_URI)
    db = client['raja-music-db']
    song = db['songs'].find_one({"id": "25"})
    if not song:
        print("Song not found!")
        return

    original_url = song.get('original_url')
    if not original_url:
        print("No original_url found for song 25")
        return
        
    print(f"Downloading {original_url}...")
    audio_path = "/tmp/25.mp3"
    urllib.request.urlretrieve(original_url, audio_path)
    
    print("Generating lyrics...")
    synced_lyrics = generate_lyrics_with_gemini(audio_path, song['title'])
    if not synced_lyrics:
        print("Failed to generate lyrics.")
        return
        
    print("Lyrics generated:")
    print(synced_lyrics)
    
    print("Updating DB...")
    db['songs'].update_one({"id": "25"}, {"$set": {"synced_lyrics": synced_lyrics}})
    print("Done!")

if __name__ == '__main__':
    main()
