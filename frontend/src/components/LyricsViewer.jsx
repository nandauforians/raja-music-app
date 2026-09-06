import React from 'react';

export default function LyricsViewer({ mode, lyrics, plainLyrics, activeLyricIndex, lyricsContainerRef }) {
  if (lyrics.length === 0 && !plainLyrics) return null;

  return (
    <div className={`p-5 lg:p-6 rounded-3xl border backdrop-blur-xl h-64 overflow-hidden relative flex flex-col transition-all duration-500 ${
      mode === 'karaoke'
        ? 'bg-purple-950/20 border-purple-800/30'
        : 'bg-zinc-900/30 border-zinc-800/50'
    }`}>
      <div className={`absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none bg-gradient-to-b ${
        mode === 'karaoke' ? 'from-purple-950/80' : 'from-zinc-900/80'
      } to-transparent`} />
      <div className={`absolute bottom-0 left-0 right-0 h-16 z-10 pointer-events-none bg-gradient-to-t ${
        mode === 'karaoke' ? 'from-purple-950/80' : 'from-zinc-900/80'
      } to-transparent`} />

      <h3 className={`text-[10px] lg:text-xs font-bold uppercase tracking-widest mb-4 z-20 text-center ${
        mode === 'karaoke' ? 'text-purple-400' : 'text-zinc-500'
      }`}>
        {mode === 'karaoke' ? '🎤 Sing Along' : 'Lyrics'}
      </h3>

      {lyrics.length > 0 ? (
        <div
          ref={lyricsContainerRef}
          className="flex-1 space-y-6 pb-24 overflow-y-auto scrollbar-hide text-center px-4 relative z-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {lyrics.map((line, i) => (
            <div
              key={i}
              className={`text-lg lg:text-xl font-medium transition-all duration-500 ease-out ${
                i === activeLyricIndex
                  ? line.gender === 'M' ? 'text-blue-400 scale-105 filter drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]'
                    : line.gender === 'F' ? 'text-pink-400 scale-105 filter drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]'
                    : mode === 'karaoke' ? 'text-purple-300 scale-105 filter drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]'
                    : 'text-amber-400 scale-105 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : line.gender === 'M' ? 'text-blue-600/70'
                    : line.gender === 'F' ? 'text-pink-600/70'
                    : 'text-zinc-600'
              }`}
            >
              {line.text}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto scrollbar-hide text-zinc-400 whitespace-pre-line text-sm text-center px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {plainLyrics}
        </div>
      )}
    </div>
  );
}
