import os, sys, tempfile, shutil
from pathlib import Path
from daily_karaoke import convert_to_mp3, upload_to_s3, update_mongodb, load_env

project_root = Path(__file__).parent.parent
load_env(project_root / '.env')

song_id = "25"
audio_path = str(project_root / "karaoke_source" / "archive" / "2026-08-27_25.m4a")

print("Processing original audio...")
work_dir = tempfile.mkdtemp()
try:
    original_mp3_path = convert_to_mp3(audio_path, work_dir)
    original_url = upload_to_s3(original_mp3_path, f"original_{song_id}.mp3")
    
    # We don't want to overwrite synced_lyrics or karaoke_url with None, so we'll just update the field manually
    from pymongo import MongoClient
    client = MongoClient(os.environ.get('MONGODB_URI'))
    db = client['raja-music-db']
    db['songs'].update_one({"id": song_id}, {"$set": {"original_url": original_url}})
    client.close()
    print("Done! Original URL:", original_url)
finally:
    shutil.rmtree(work_dir)
