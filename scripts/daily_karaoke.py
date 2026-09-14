#!/usr/bin/env python3
"""
Uforian Music - Daily Karaoke Workflow Runner
=============================================
Run this ONCE every morning after placing today's song audio in karaoke_source/today.m4a

Usage:
    python3 scripts/daily_karaoke.py

What it does:
1. Fetches today's song name from the API
2. Looks for karaoke_source/today.m4a  (or today.mp3, today.wav, etc.)
3. Runs Demucs AI vocal separation (strips vocals → instrumental)
4. Uploads the instrumental to S3
5. Updates MongoDB with the karaoke_url
6. Archives today's source file to karaoke_source/archive/{date}_{song_id}.m4a

Setup (one-time):
    pip3 install demucs boto3 pymongo requests
"""

import os
import sys
import glob
import shutil
import subprocess
import tempfile
import requests
from pathlib import Path
from datetime import datetime

# ─── Load env ─────────────────────────────────────────────────────────────────
def load_env(env_path):
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

script_dir = Path(__file__).parent
project_root = script_dir.parent
load_env(project_root / '.env')

MONGODB_URI = os.environ.get('MONGODB_URI')
API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:3000')
S3_BUCKET = 'uforian-karaoke-tracks'
S3_REGION = 'us-east-1'
SOURCE_DIR = project_root / 'karaoke_source'
ARCHIVE_DIR = SOURCE_DIR / 'archive'

def log(msg):
    print(f"[daily-karaoke] {msg}", flush=True)

def find_source_file(target_date, song_id):
    """Look for date.*, song_id.*, or today.* in karaoke_source/"""
    patterns = [
        f"{target_date}.m4a", f"{target_date}.mp3", f"{target_date}.mp4a",
        f"{song_id}.m4a", f"{song_id}.mp3", f"{song_id}.mp4a",
        'today.m4a', 'today.mp3', 'today.mp4a', 'today.wav'
    ]
    for pattern in patterns:
        path = SOURCE_DIR / pattern
        if path.exists():
            return str(path)
    return None

def fetch_todays_song():
    resp = requests.get(f"{API_BASE_URL}/song/today", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get('success') or not data.get('song'):
        raise ValueError("API did not return a song")
    return data['song']

def separate_vocals(audio_path, work_dir):
    log("Running Demucs AI vocal separation (this takes 3–5 minutes)...")
    cmd = [
        "python3", "-m", "demucs",
        "--two-stems", "vocals",
        "--out", work_dir,
        "--mp3",
        "--mp3-bitrate", "128",
        audio_path,
    ]
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed with exit code {result.returncode}")
    
    no_vocals_files = list(Path(work_dir).rglob("no_vocals.mp3"))
    if not no_vocals_files:
        raise FileNotFoundError("Demucs succeeded but 'no_vocals.mp3' not found")
    
    vocals_files = list(Path(work_dir).rglob("vocals.mp3"))
    vocals_path = str(vocals_files[0]) if vocals_files else None
    
    return str(no_vocals_files[0]), vocals_path

def upload_to_s3(file_path, s3_key, content_type='audio/mpeg'):
    import boto3
    file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
    log(f"Uploading to s3://{S3_BUCKET}/{s3_key} ...")
    s3 = boto3.client('s3', region_name=S3_REGION)
    with open(file_path, 'rb') as f:
        s3.upload_fileobj(f, S3_BUCKET, s3_key, ExtraArgs={
            'ContentType': content_type,
            'CacheControl': 'max-age=86400',
        })
    log(f"Uploaded! Public URL: {file_url}")
    return file_url

def extract_pitch_data(audio_path, out_json_path):
    import librosa
    import numpy as np
    import json
    log("Extracting pitch using librosa.pyin...")
    
    # Load audio (mono, 22050Hz is sufficient for pitch)
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    
    # Extract fundamental frequency (F0) from C2 to C7
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr
    )
    
    times = librosa.times_like(f0, sr=sr)
    
    pitch_data = []
    # Compress data: only save voiced frames to save JSON space
    for i in range(len(f0)):
        if voiced_flag[i] and not np.isnan(f0[i]):
            pitch_data.append({
                "t": round(float(times[i]), 2),
                "f": round(float(f0[i]), 2)
            })
            
    with open(out_json_path, 'w') as f:
        json.dump(pitch_data, f)
    
    log(f"Extracted {len(pitch_data)} pitch points.")
    return out_json_path

def convert_to_mp3(source_path, work_dir):
    """Convert source to 192k mp3 for the original playback track"""
    if source_path.lower().endswith('.mp3'):
        return source_path
    log("Converting source to MP3 for original playback...")
    out_path = os.path.join(work_dir, "original.mp3")
    cmd = [
        "ffmpeg", "-y", "-i", source_path,
        "-codec:a", "libmp3lame", "-b:a", "192k",
        out_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"FFmpeg conversion failed: {result.stderr}")
        # Fallback to returning original file if ffmpeg is missing
        return source_path
    return out_path

def generate_lyrics_with_gemini(audio_path, title):
    import base64
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        log("⚠️ No GEMINI_API_KEY found. Skipping AI lyrics generation.")
        return None
        
    log("🤖 Generating LRC lyrics with Gemini 2.5 Flash via REST (this takes ~15s)...")
    
    try:
        with open(audio_path, "rb") as audio_file:
            audio_base64 = base64.b64encode(audio_file.read()).decode("utf-8")
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
        
        prompt = f"""Listen to this song ('{title}') and provide the lyrics in LRC format with accurate timestamps for each line like [00:15.22] line of lyrics.
Provide TWO versions of the lyrics:
1. In native Tamil script.
2. Transliterated in Tanglish (English characters).
Return the result STRICTLY as a JSON object with two keys: "tamil" and "tanglish", where the values are the respective raw LRC strings. Do not include any markdown or extra text."""
        
        payload = {
            "contents": [{
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "audio/mp4",
                            "data": audio_base64
                        }
                    },
                    {"text": prompt}
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        headers = {'Content-Type': 'application/json'}
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        
        data = response.json()
        raw_text = data['candidates'][0]['content']['parts'][0]['text'].strip()
        
        # Clean up markdown code blocks if generated
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("\n", 1)[0]
        if raw_text.startswith("json"):
            raw_text = raw_text.split("\n", 1)[1]
            
        import json
        lyrics_data = json.loads(raw_text)
                
        log("✅ Lyrics generated successfully!")
        return lyrics_data
        
    except Exception as e:
        log(f"❌ Gemini lyrics generation failed: {e}")
        return None

def update_mongodb(song_id, original_url, karaoke_url, synced_lyrics=None, pitch_data_url=None):
    from pymongo import MongoClient
    log(f"Updating MongoDB: song_id={song_id}")
    client = MongoClient(MONGODB_URI)
    db = client['raja-music-db']
    
    update_fields = {
        "original_url": original_url,
        "karaoke_url": karaoke_url
    }
    if pitch_data_url:
        update_fields["pitch_data_url"] = pitch_data_url
    if synced_lyrics:
        if isinstance(synced_lyrics, dict):
            update_fields["synced_lyrics_tamil"] = synced_lyrics.get("tamil")
            update_fields["synced_lyrics_tanglish"] = synced_lyrics.get("tanglish")
            # Keep the old field populated with one of them for backward compatibility
            update_fields["synced_lyrics"] = synced_lyrics.get("tanglish") or synced_lyrics.get("tamil")
        else:
            update_fields["synced_lyrics"] = synced_lyrics
        
    db['songs'].update_one(
        {"id": str(song_id)},
        {"$set": update_fields},
    )
    client.close()
    log("MongoDB updated ✅")

def archive_source(source_path, song_id, today):
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(source_path).suffix
    archive_path = ARCHIVE_DIR / f"{today}_{song_id}{ext}"
    shutil.copy2(source_path, archive_path)
    os.remove(source_path)
    log(f"Source archived to: {archive_path}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Uforian Music Daily Karaoke Pipeline")
    parser.add_argument("--date", type=str, help="YYYY-MM-DD to process a specific scheduled date")
    parser.add_argument("--id", type=str, help="Numeric song ID to process directly (e.g. 10)")
    args = parser.parse_args()

    target_date = args.date if args.date else datetime.now().strftime('%Y-%m-%d')
    log(f"=== Uforian Music Karaoke Pipeline ===")

    # 1. Fetch scheduled song metadata for target date
    # We will query MongoDB directly for the schedule
    from pymongo import MongoClient
    client = MongoClient(MONGODB_URI)
    db = client['raja-music-db']
    
    song = None
    if args.id:
        log(f"Fetching song by explicit ID: {args.id}")
        song = db['songs'].find_one({"id": str(args.id)})
        if not song:
            log(f"❌ Error: Song with ID {args.id} not found in database.")
            sys.exit(1)
        song['karaoke_enabled'] = song.get('karaoke_enabled', True)
    else:
        log(f"Target Date: {target_date}")
        # Try schedule first
        scheduled = db['schedule'].find_one({"dateISO8601": target_date})
        if scheduled:
            song = db['songs'].find_one({"id": scheduled['song_id']})
            if song:
                song['karaoke_enabled'] = scheduled.get('karaoke_enabled', True)
        
        if not song:
            # Fallback to API if not scheduled
            try:
                song = fetch_todays_song()
            except Exception as e:
                log(f"ERROR fetching song for {target_date}: {e}")
                sys.exit(1)
            
    client.close()

    song_id = song['id']
    title = song['title']
    karaoke_enabled = song.get('karaoke_enabled', True)
    
    log(f"Processing song: '{title}' (id={song_id})")
    log(f"Karaoke Enabled: {karaoke_enabled}")

    # 2. Check for local source file first, otherwise check for YouTube URL
    source_path = find_source_file(target_date, song_id)
    youtube_url = song.get('youtube_url')
    
    if source_path:
        log(f"Found local source file: {source_path}. Skipping YouTube download.")
    elif youtube_url:
        log(f"Found YouTube URL: {youtube_url}")
        log("Downloading audio via yt-dlp...")
        
        # Download YouTube audio
        work_dir_yt = tempfile.mkdtemp(prefix="karaoke_yt_")
        out_template = os.path.join(work_dir_yt, "youtube_dl.%(ext)s")
        cmd = [
            "yt-dlp",
            youtube_url,
            "--extract-audio",
            "--audio-format", "mp3", 
            "--audio-quality", "0",
            "--output", out_template,
            "--no-playlist",
            "--extractor-args", "youtube:player_client=android,web"
        ]
        cookies_file = project_root / "www.youtube.com_cookies.txt"
        if cookies_file.exists():
            cmd.extend(["--cookies", str(cookies_file)])

        result = subprocess.run(cmd, capture_output=False, text=True)
        if result.returncode != 0:
            log(f"yt-dlp failed with exit code {result.returncode}")
            sys.exit(1)
            
        mp3_files = list(Path(work_dir_yt).glob("*.mp3"))
        if mp3_files:
            downloaded_path = str(mp3_files[0])
            # Move it to SOURCE_DIR so it acts exactly like a manually provided file
            source_path = str(SOURCE_DIR / f"{song_id}.mp3")
            shutil.move(downloaded_path, source_path)
            log(f"Downloaded YouTube audio to: {source_path}")
        else:
            log("yt-dlp succeeded but no mp3 file found.")
            sys.exit(1)
            
        shutil.rmtree(work_dir_yt, ignore_errors=True)
    else:
        source_path = find_source_file(target_date, song_id)
        if not source_path:
            log("")
            log("❌ No source file found in karaoke_source/ and no youtube_url provided.")
            log(f"Please download '{title}' and save it as:")
            log(f"  - karaoke_source/{target_date}.m4a  OR")
            log(f"  - karaoke_source/{song_id}.m4a")
            sys.exit(0)

    log(f"Using source file: {source_path}")

    # 3. Check if already processed
    original_exists = bool(song.get('original_url'))
    karaoke_exists = bool(song.get('karaoke_url'))
    lyrics_exists = bool(song.get('synced_lyrics_tamil')) and bool(song.get('synced_lyrics_tanglish'))
    pitch_data_exists = bool(song.get('pitch_data_url'))
    
    if original_exists and (karaoke_exists or not karaoke_enabled) and lyrics_exists and (pitch_data_exists or not karaoke_enabled):
        log(f"✅ Required audio tracks, lyrics, and pitch data already exist for '{title}'")
        log("Archiving source file and exiting.")
        archive_source(source_path, song_id, target_date)
        sys.exit(0)

    # 4. Process Audio and Lyrics
    work_dir = tempfile.mkdtemp(prefix="karaoke_")
    try:
        # 4a. Process Original Audio
        original_url = song.get('original_url')
        if not original_exists:
            original_mp3_path = convert_to_mp3(source_path, work_dir)
            original_url = upload_to_s3(original_mp3_path, f"original_{song_id}.mp3")
        else:
            log(f"⏭️ Skipping Original audio generation (already exists).")

        # 4b. Process Karaoke Audio (Demucs) if enabled
        karaoke_url = song.get('karaoke_url')
        pitch_data_url = song.get('pitch_data_url')
        
        if karaoke_enabled and (not karaoke_exists or not pitch_data_exists):
            karaoke_path, vocals_path = separate_vocals(source_path, work_dir)
            if not karaoke_exists:
                karaoke_url = upload_to_s3(karaoke_path, f"karaoke_{song_id}.mp3")
            
            if not pitch_data_exists and vocals_path:
                pitch_json_path = os.path.join(work_dir, "pitch_data.json")
                extract_pitch_data(vocals_path, pitch_json_path)
                pitch_data_url = upload_to_s3(pitch_json_path, f"pitch_data_{song_id}.json", content_type='application/json')
        elif karaoke_enabled:
            log(f"⏭️ Skipping Karaoke and Pitch generation (already exists).")
        else:
            log("⏭️ Skipping Karaoke generation (disabled for this song).")
        
        # 4c. Generate Lyrics
        synced_lyrics = song.get('synced_lyrics')
        if not lyrics_exists:
            synced_lyrics = generate_lyrics_with_gemini(source_path, title)
        else:
            log(f"⏭️ Skipping Lyrics generation (already exists).")
        
        # 4d. Save to DB
        update_mongodb(song_id, original_url, karaoke_url, synced_lyrics, pitch_data_url)
        archive_source(source_path, song_id, target_date)

        log("")
        log("=" * 60)
        log("🎤 KARAOKE PIPELINE COMPLETE!")
        log(f"   Song       : {title}")
        log(f"   Song ID    : {song_id}")
        log(f"   Original   : {original_url}")
        if karaoke_enabled:
            log(f"   Karaoke    : {karaoke_url}")
        log(f"   Lyrics     : {'✅ AI Generated' if synced_lyrics else '❌ Not Generated'}")
        log("=" * 60)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

if __name__ == '__main__':
    main()
