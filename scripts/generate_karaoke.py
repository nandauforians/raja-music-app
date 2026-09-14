#!/usr/bin/env python3
"""
Uforian Music - Automated Karaoke Pipeline
==========================================
This script:
1. Fetches today's song from the backend API
2. Downloads the audio using yt-dlp (YouTube search)
3. Runs Demucs vocal separation to extract the instrumental track
4. Uploads the instrumental MP3 to S3: s3://uforian-karaoke-tracks/{song_id}.mp3
5. Updates the MongoDB document with `karaoke_url`

Usage:
    python3 scripts/generate_karaoke.py
    python3 scripts/generate_karaoke.py --song-id <id> --title "Song Name" --movie "Movie Name"

Requirements:
    pip3 install yt-dlp demucs boto3 pymongo requests
"""

import os
import sys
import argparse
import subprocess
import shutil
import tempfile
import json
import time
import re
import requests
from pathlib import Path

# ─── Load env ────────────────────────────────────────────────────────────────
def load_env(env_path='.env'):
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

load_env(os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGODB_URI = os.environ.get('MONGODB_URI')
API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:3000')
S3_BUCKET = 'uforian-karaoke-tracks'
S3_REGION = 'us-east-1'

# ─── Helpers ─────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[karaoke] {msg}", flush=True)

def sanitize(s):
    return re.sub(r'[^\w\s-]', '', s).strip()


def fetch_todays_song():
    """Fetch today's song of the day from the local API."""
    log(f"Fetching today's song from {API_BASE_URL}/song/today ...")
    resp = requests.get(f"{API_BASE_URL}/song/today", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get('success') or not data.get('song'):
        raise ValueError(f"API did not return a song: {data}")
    song = data['song']
    log(f"Today's song: '{song['title']}' from '{song.get('movie', 'Unknown')}' (id={song['id']})")
    return song


def fetch_song_by_id(song_id):
    """Fetch a song's metadata (including youtube_url) from MongoDB by its ID."""
    try:
        from pymongo import MongoClient
        if not MONGODB_URI:
            log("WARNING: MONGODB_URI not set, cannot fetch song metadata from DB.")
            return None
        client = MongoClient(MONGODB_URI)
        db = client['raja-music-db']
        song = db['songs'].find_one({'id': str(song_id)}, {'_id': 0})
        if song:
            log(f"Fetched song from DB: '{song.get('title')}' youtube_url={song.get('youtube_url')}")
        return song
    except Exception as e:
        log(f"WARNING: Could not fetch song from MongoDB: {e}")
        return None


def get_ytdlp_bin():
    """Return the best available yt-dlp binary (Homebrew preferred over pip-installed)."""
    for candidate in ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', 'yt-dlp']:
        if candidate == 'yt-dlp' or os.path.exists(candidate):
            return candidate
    return 'yt-dlp'

def download_audio(title, movie, work_dir, youtube_url=None):
    """Search YouTube and download best audio using yt-dlp, or use provided youtube link."""
    out_template = os.path.join(work_dir, "original.%(ext)s")
    ytdlp = get_ytdlp_bin()
    log(f"Using yt-dlp binary: {ytdlp}")
    
    cmd = [
        ytdlp,
        "--extract-audio",
        "--audio-format", "wav",        # Demucs works best with WAV
        "--audio-quality", "0",         # Best quality
        "--output", out_template,
        "--no-playlist",
        "--no-warnings",
        "--quiet",
        "--progress",
    ]
    
    if youtube_url:
        log(f"Downloading directly from YouTube URL: {youtube_url} ...")
        cmd.insert(1, youtube_url)
    else:
        query = f"{title} {movie} original audio"
        log(f"Searching YouTube: '{query}' ...")
        cmd.insert(1, f"ytsearch1:{query}")
    
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        # yt-dlp sometimes fails due to stale YouTube session. Retry with browser cookies.
        log("yt-dlp failed, retrying with Safari cookies...")
        retry_cmd = cmd + ['--cookies-from-browser', 'safari']
        result = subprocess.run(retry_cmd, capture_output=False, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed with exit code {result.returncode}")
    
    wav_files = list(Path(work_dir).glob("*.wav")) + list(Path(work_dir).glob("*.m4a")) + list(Path(work_dir).glob("*.opus"))
    if not wav_files:
        raise FileNotFoundError("yt-dlp succeeded but no audio file found in work_dir")
    
    audio_path = str(wav_files[0])
    log(f"Downloaded: {audio_path}")
    return audio_path


def separate_vocals(audio_path, work_dir):
    """Run Meta Demucs to separate vocals from accompaniment."""
    log("Running Demucs vocal separation (htdemucs 2-stem model)...")
    log("This may take 2–5 minutes depending on song length and CPU...")
    
    cmd = [
        "python3", "-m", "demucs",
        "--two-stems", "vocals",        # Only split into vocals + no_vocals
        "--out", work_dir,
        "--mp3",                        # Output as MP3 directly
        "--mp3-bitrate", "128",
        audio_path,
    ]
    
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed with exit code {result.returncode}")
    
    # Demucs outputs to: {work_dir}/htdemucs/{track_name}/no_vocals.mp3
    no_vocals_files = list(Path(work_dir).rglob("no_vocals.mp3"))
    if not no_vocals_files:
        raise FileNotFoundError("Demucs succeeded but no 'no_vocals.mp3' found in output")
    
    karaoke_path = str(no_vocals_files[0])
    log(f"Karaoke track created: {karaoke_path}")
    return karaoke_path


def upload_to_s3(karaoke_path, song_id):
    """Upload the karaoke MP3 to the S3 bucket."""
    import boto3
    
    s3_key = f"{song_id}.mp3"
    karaoke_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
    
    log(f"Uploading to s3://{S3_BUCKET}/{s3_key} ...")
    
    s3 = boto3.client('s3', region_name=S3_REGION)
    with open(karaoke_path, 'rb') as f:
        s3.upload_fileobj(
            f, S3_BUCKET, s3_key,
            ExtraArgs={
                'ContentType': 'audio/mpeg',
                'CacheControl': 'max-age=86400',  # Cache for 24 hours
            }
        )
    
    log(f"Uploaded! Public URL: {karaoke_url}")
    return karaoke_url


def update_mongodb(song_id, karaoke_url, original_url=None):
    """Update the song document in MongoDB with the karaoke_url and original_url."""
    from pymongo import MongoClient
    
    log(f"Updating MongoDB: song_id={song_id}, karaoke_url={karaoke_url}, original_url={original_url}")
    
    client = MongoClient(MONGODB_URI)
    db = client['raja-music-db']
    songs = db['songs']
    
    update_fields = {"karaoke_url": karaoke_url}
    if original_url:
        update_fields["original_url"] = original_url
        
    result = songs.update_one(
        {"id": str(song_id)},
        {"$set": update_fields},
        upsert=False
    )
    
    if result.matched_count == 0:
        log(f"WARNING: No song found with id='{song_id}' in MongoDB. Update skipped.")
    else:
        log(f"MongoDB updated! matched={result.matched_count}, modified={result.modified_count}")
    
    client.close()


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def run_pipeline(song_id, title, movie):
    work_dir = tempfile.mkdtemp(prefix="karaoke_")
    log(f"Working directory: {work_dir}")
    
    try:
        # Step 1: Download audio
        audio_path = download_audio(title, movie, work_dir)
        
        # Step 2: Vocal separation
        karaoke_path = separate_vocals(audio_path, work_dir)
        
        # Step 3: Upload to S3
        karaoke_url = upload_to_s3(karaoke_path, song_id)
        
        # Step 4: Update MongoDB
        update_mongodb(song_id, karaoke_url)
        
        log("=" * 60)
        log("✅ Pipeline completed successfully!")
        log(f"   Song ID  : {song_id}")
        log(f"   Title    : {title}")
        log(f"   Karaoke  : {karaoke_url}")
        log("=" * 60)
        
        return karaoke_url
        
    finally:
        log(f"Cleaning up temp directory: {work_dir}")
        shutil.rmtree(work_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description='Uforian Music Karaoke Pipeline')
    parser.add_argument('--song-id', help='Song ID in MongoDB (overrides API fetch)')
    parser.add_argument('--title', help='Song title (used with --song-id for YouTube search)')
    parser.add_argument('--movie', default='', help='Movie name for YouTube search')
    parser.add_argument('--local-file', help='Path to a local audio file (m4a, mp3, wav, etc.) — skips yt-dlp download entirely')
    parser.add_argument('--youtube-url', help='Direct YouTube URL to download instead of searching')
    parser.add_argument('--dry-run', action='store_true', help='Skip upload and DB update')
    args = parser.parse_args()
    
    # Determine which song to process
    if args.song_id:
        song_id = args.song_id
        title = args.title or "Unknown Title"
        movie = args.movie or ""
        # Option A: Auto-fetch youtube_url from DB if not explicitly provided
        if not args.youtube_url and not args.local_file:
            log(f"Fetching song metadata from DB for song_id={song_id} to get youtube_url...")
            db_song = fetch_song_by_id(song_id)
            if db_song:
                title = db_song.get('title', title)
                movie = db_song.get('movie', movie)
                if db_song.get('youtube_url'):
                    args.youtube_url = db_song['youtube_url']
                    log(f"Using youtube_url from DB: {args.youtube_url}")
                else:
                    log(f"No youtube_url in DB for song {song_id}. Will search YouTube using title.")
        log(f"Manual mode: song_id={song_id}, title='{title}', movie='{movie}'")
    else:
        # Auto: fetch today's song
        try:
            song = fetch_todays_song()
        except Exception as e:
            log(f"ERROR: Could not fetch today's song: {e}")
            log("TIP: Make sure the backend is running at http://localhost:3000")
            log("     Or use --song-id to specify a song manually.")
            sys.exit(1)
        song_id = song['id']
        title = song['title']
        movie = song.get('movie', '')
    
    if args.dry_run:
        log("DRY RUN mode - will process but NOT upload or update DB")

    # Run pipeline with optional local file
    work_dir = tempfile.mkdtemp(prefix="karaoke_")
    log(f"Working directory: {work_dir}")
    
    try:
        if args.local_file:
            # Use the provided local file directly — skip yt-dlp
            local_file = os.path.abspath(args.local_file)
            if not os.path.exists(local_file):
                log(f"ERROR: File not found: {local_file}")
                sys.exit(1)
            log(f"Using local file: {local_file}")
            audio_path = local_file
        else:
            # Download from YouTube
            if not title and not args.youtube_url:
                log("ERROR: Need --title, a running backend, or --youtube-url to auto-fetch the song.")
                sys.exit(1)
            audio_path = download_audio(title, movie, work_dir, args.youtube_url)
        
        # Run Demucs vocal separation
        karaoke_path = separate_vocals(audio_path, work_dir)
        
        if args.dry_run:
            log(f"DRY RUN complete. Karaoke track at: {karaoke_path}")
            return
            
        # Upload the original audio to S3 regardless of whether it's local or from youtube
        import boto3
        ext = audio_path.split('.')[-1]
        s3_key = f"source/{song_id}.{ext}"
        original_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        log(f"Uploading original file to s3://{S3_BUCKET}/{s3_key} ...")
        s3 = boto3.client('s3', region_name=S3_REGION)
        with open(audio_path, 'rb') as f:
            s3.upload_fileobj(
                f, S3_BUCKET, s3_key,
                ExtraArgs={'ContentType': f'audio/{ext}', 'CacheControl': 'max-age=86400'}
            )
        log(f"Uploaded Original! Public URL: {original_url}")
        
        # Upload to S3 (karaoke)
        karaoke_url = upload_to_s3(karaoke_path, song_id)
        
        # Update MongoDB
        update_mongodb(song_id, karaoke_url, original_url)
        
        log("=" * 60)
        log("✅ Pipeline completed successfully!")
        log(f"   Song ID  : {song_id}")
        log(f"   Title    : {title}")
        if original_url: log(f"   Original : {original_url}")
        log(f"   Karaoke  : {karaoke_url}")
        log("=" * 60)
        
    finally:
        log(f"Cleaning up temp directory: {work_dir}")
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == '__main__':
    main()
