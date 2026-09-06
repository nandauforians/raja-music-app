import os, boto3, subprocess
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('.env')

s3 = boto3.client('s3', region_name='us-east-1')
c = MongoClient(os.getenv('MONGODB_URI'))
db = c['raja-music-db']

def upload_and_update(song_id, local_file):
    print(f"Uploading {local_file} for song {song_id}")
    ext = local_file.split('.')[-1]
    s3_key = f"source/{song_id}.{ext}"
    s3.upload_file(local_file, 'uforian-karaoke-tracks', s3_key, ExtraArgs={'ContentType': f'audio/{ext}', 'CacheControl': 'max-age=86400'})
    url = f"https://uforian-karaoke-tracks.s3.us-east-1.amazonaws.com/{s3_key}"
    db.songs.update_one({'id': song_id}, {'$set': {'original_url': url}})
    print(f"Updated song {song_id} with original_url: {url}")

# Song 7
upload_and_update('7', 'songs/Thenpaandi-Nayagan.m4a')

# Song 9 - redownload using yt-dlp to current dir
print("Downloading song 9...")
subprocess.run(['yt-dlp', 'ytsearch1:Kanne Kalaimane Moondram Pirai original audio', '--extract-audio', '--audio-format', 'm4a', '--output', 'song9.%(ext)s'])
upload_and_update('9', 'song9.m4a')

print("Done!")
