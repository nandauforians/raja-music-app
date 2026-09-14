import os
import sys
import tempfile
import shutil
import requests
from pathlib import Path
from pymongo import MongoClient

# Adjust path to import from daily_karaoke.py
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from scripts.daily_karaoke import (
    MONGODB_URI,
    separate_vocals,
    extract_pitch_data,
    upload_to_s3,
    log
)

def download_file_s3(s3_url, out_path):
    import boto3
    from urllib.parse import urlparse
    log(f"Downloading {s3_url} to {out_path} via boto3...")
    
    parsed = urlparse(s3_url)
    bucket_name = parsed.netloc.split('.')[0]
    key = parsed.path.lstrip('/')
    
    s3 = boto3.client('s3')
    s3.download_file(bucket_name, key, out_path)

def process_song(song):
    song_id = song['id']
    title = song['title']
    original_url = song.get('original_url')
    
    if not original_url:
        log(f"Skipping {title} ({song_id}): No original_url found.")
        return

    work_dir = tempfile.mkdtemp(prefix=f"backfill_{song_id}_")
    try:
        source_path = os.path.join(work_dir, "original.mp3")
        download_file_s3(original_url, source_path)
        
        karaoke_path, vocals_path = separate_vocals(source_path, work_dir)
        
        if vocals_path:
            pitch_json_path = os.path.join(work_dir, "pitch_data.json")
            extract_pitch_data(vocals_path, pitch_json_path)
            pitch_data_url = upload_to_s3(pitch_json_path, f"pitch_data_{song_id}.json", content_type='application/json')
            
            # Update DB
            client = MongoClient(MONGODB_URI)
            db = client['raja-music-db']
            db['songs'].update_one(
                {"id": str(song_id)},
                {"$set": {"pitch_data_url": pitch_data_url}}
            )
            client.close()
            log(f"✅ Successfully backfilled pitch data for {title}")
        else:
            log(f"❌ Failed to extract vocals for {title}")
            
    except Exception as e:
        log(f"❌ Error processing {title}: {str(e)}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

def main():
    log("Starting pitch data backfill...")
    client = MongoClient(MONGODB_URI)
    db = client['raja-music-db']
    
    # Find songs where karaoke is enabled but pitch_data_url is missing
    query = {
        "$and": [
            {"$or": [{"karaoke_enabled": True}, {"karaoke_enabled": {"$exists": False}}]},
            {"karaoke_url": {"$exists": True, "$ne": None}},
            {"pitch_data_url": {"$exists": False}}
        ]
    }
    
    songs = list(db['songs'].find(query))
    client.close()
    
    log(f"Found {len(songs)} songs to process.")
    
    for i, song in enumerate(songs):
        log(f"\n[{i+1}/{len(songs)}] Processing {song['title']}...")
        process_song(song)
        
    log("\n🎉 Backfill complete!")

if __name__ == "__main__":
    main()
