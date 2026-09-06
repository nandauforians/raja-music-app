import React, { useState, useEffect } from 'react';
import { Music, Calendar, Share2, Heart } from 'lucide-react';

// Import the real database
import db from './ilayaraja_songs_database.json';

// ============================================================================
// ILAYARAJA DAILY MUSIC APP - APPLE-INSPIRED REDESIGN
// ============================================================================

export default function IlayarajaApp() {
  const [song, setSong] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    // Calculate song of the day
    const songs = db.songs.filter(s => s.spotify_id); // Only use songs with Spotify IDs
    if (songs.length > 0) {
      const today = new Date();
      const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
      const index = dayOfYear % songs.length;
      setSong(songs[index]);
    }
    
    // Trigger entry animation after a tiny delay for smooth rendering
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!song) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Music className="w-12 h-12 text-zinc-600 mb-4" />
          <p className="text-zinc-500 font-medium tracking-widest uppercase text-sm">Loading Masterpiece</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      
      {/* --- BACKGROUND EFFECTS --- */}
      {/* 
        Instead of a static image, we use an extremely premium, dynamic, CSS-based radial gradient.
        It simulates a dark, moody spotlight effect over a deep charcoal background, 
        inspired by Apple's dark mode product pages.
      */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-amber-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-orange-900/10 blur-[150px]" />
        <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-zinc-800/40 blur-[100px] mix-blend-screen" />
      </div>

      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none" />

      {/* --- NAVBAR --- */}
      <nav className={`relative z-10 w-full px-8 py-6 flex items-center justify-between transition-all duration-1000 transform ${
        isLoaded ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
      }`}>
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-semibold tracking-wide text-zinc-100">Ilayaraja Daily</h1>
        </div>
        <div className="text-zinc-500 text-sm tracking-widest uppercase font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="relative z-10 w-full h-[calc(100vh-88px)] flex flex-col lg:flex-row items-center justify-center px-8 lg:px-24 gap-12 lg:gap-24">
        
        {/* LEFT: Typography & Info */}
        <div className={`flex-1 flex flex-col justify-center max-w-2xl transition-all duration-1000 delay-300 transform ${
          isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
        }`}>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 mb-8 backdrop-blur-md w-max">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-300">Song of the Day</span>
          </div>

          <h2 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
            {song.title}
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-6 mb-12 text-zinc-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <Music className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Film</p>
                <p className="text-lg font-medium text-zinc-200">{song.movie}</p>
              </div>
            </div>
            
            <div className="hidden sm:block w-px h-12 bg-zinc-800" />

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Released</p>
                <p className="text-lg font-medium text-zinc-200">{song.year}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsFavorited(!isFavorited)}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-zinc-900/80 border border-zinc-700 hover:bg-zinc-800 transition-colors group"
              >
                <Heart className={`w-6 h-6 transition-all ${isFavorited ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-400 group-hover:text-white'}`} />
             </button>
             <button className="flex items-center gap-3 px-8 py-4 rounded-full bg-zinc-100 hover:bg-white text-black font-semibold transition-all hover:scale-105 active:scale-95">
                <Share2 className="w-5 h-5" />
                Share Masterpiece
             </button>
          </div>

        </div>

        {/* RIGHT: Spotify Player */}
        <div className={`flex-1 w-full max-w-md transition-all duration-1000 delay-500 transform ${
          isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
        }`}>
          {/* Glassmorphism Player Container */}
          <div className="relative p-2 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden group">
            
            {/* Subtle glow effect behind the iframe */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* The Spotify iframe is 352px height by default. */}
            <div className="rounded-2xl overflow-hidden relative z-10 bg-black">
              <iframe
                src={`https://open.spotify.com/embed/track/${song.spotify_id}?utm_source=generator&theme=0`}
                width="100%"
                height="352"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="block"
              />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
