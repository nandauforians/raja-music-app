import React from 'react';

export default function LyricsViewer({ 
  mode, 
  lyrics, 
  plainLyrics, 
  activeLyricIndex, 
  lyricsContainerRef,
  hasDualLyrics,
  lyricsLanguage,
  setLyricsLanguage 
}) {
  if (lyrics.length === 0 && !plainLyrics) return null;

  const getLineColor = (line, isActive) => {
    if (isActive) {
      if (line.gender === 'M') return 'text-blue-400 scale-105 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]';
      if (line.gender === 'F') return 'text-pink-400 scale-105 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]';
      if (mode === 'karaoke') return 'text-purple-300 scale-105 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]';
      return 'text-amber-400 scale-105 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]';
    } else {
      if (line.gender === 'M') return 'text-blue-600/70';
      if (line.gender === 'F') return 'text-pink-600/70';
      return 'text-zinc-600';
    }
  };

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

      <div className="flex justify-between items-center mb-4 z-20 px-2">
        <h3 className={`text-[10px] lg:text-xs font-bold uppercase tracking-widest ${
          mode === 'karaoke' ? 'text-purple-400' : 'text-zinc-500'
        }`}>
          {mode === 'karaoke' ? '🎤 Sing Along' : 'Lyrics'}
        </h3>
        
        {hasDualLyrics && (
          <div className="flex items-center gap-2 bg-black/40 rounded-full p-1 border border-white/5">
            <button 
              onClick={() => setLyricsLanguage('tanglish')}
              className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${
                lyricsLanguage === 'tanglish' 
                  ? 'bg-white/10 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              A
            </button>
            <button 
              onClick={() => setLyricsLanguage('tamil')}
              className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${
                lyricsLanguage === 'tamil' 
                  ? 'bg-white/10 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              அ
            </button>
          </div>
        )}
      </div>

      {lyrics.length > 0 ? (
        <div
          ref={lyricsContainerRef}
          className="flex-1 space-y-6 pb-24 overflow-y-auto scrollbar-hide text-center px-4 relative z-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {lyrics.map((line, i) => (
            <div
              key={i}
              className={`text-lg lg:text-xl font-medium transition-all duration-500 ease-out filter ${getLineColor(line, i === activeLyricIndex)}`}
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
