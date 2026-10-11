import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Film, Check, X, ChevronDown, Mic } from 'lucide-react';

export default function SongSchedulePicker({
  dateStr,
  selectedSongId,
  songs = [],
  onSelectSong,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedSong = useMemo(() => {
    return songs.find(s => s.id === selectedSongId) || null;
  }, [songs, selectedSongId]);

  // Synchronize query display when selectedSong changes and dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      if (selectedSong) {
        setQuery(`${selectedSong.title} (${selectedSong.movie})`);
      } else {
        setQuery('');
      }
    }
  }, [selectedSong, isOpen]);

  // Intelligent filter: movie like '%abc%' OR song title like '%abc%'
  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // If query is empty, prioritize current song + first 30 songs
      return songs.slice(0, 30);
    }
    return songs.filter(s => {
      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const movieMatch = (s.movie || '').toLowerCase().includes(q);
      return titleMatch || movieMatch;
    }).slice(0, 50); // Top 50 results for instant rendering
  }, [songs, query]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && listRef.current.children[highlightedIndex]) {
      listRef.current.children[highlightedIndex].scrollIntoView({
        block: 'nearest'
      });
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        if (selectedSong) {
          setQuery(`${selectedSong.title} (${selectedSong.movie})`);
        } else {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedSong]);

  const handleSelect = (song) => {
    onSelectSong(song.id);
    setQuery(`${song.title} (${song.movie})`);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setQuery('');
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredSongs.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredSongs.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSongs.length > 0 && filteredSongs[highlightedIndex]) {
        handleSelect(filteredSongs[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedSong) {
        setQuery(`${selectedSong.title} (${selectedSong.movie})`);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          placeholder="🔍 Type song or movie name (e.g. Kanmani, Nayakan)..."
          onFocus={() => {
            setIsOpen(true);
            if (inputRef.current) inputRef.current.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-neutral-900 border rounded-lg pl-10 pr-16 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all ${
            isOpen 
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10' 
              : selectedSong 
                ? 'border-neutral-600 hover:border-neutral-500 font-medium' 
                : 'border-neutral-700 hover:border-neutral-600'
          }`}
        />
        
        <div className="absolute right-2.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 bg-neutral-950/60 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
            <span>
              {query.trim() 
                ? `Matching Songs (${filteredSongs.length})` 
                : `Showing Songs (Type to filter)`}
            </span>
            <span className="text-[10px] text-neutral-500 lowercase">↑↓ navigate · enter select · esc close</span>
          </div>

          <div ref={listRef} className="max-h-72 overflow-y-auto divide-y divide-neutral-800/40">
            {filteredSongs.length === 0 ? (
              <div className="p-5 text-center text-sm text-neutral-400">
                <p>No songs found matching "<span className="text-amber-400 font-semibold">{query}</span>"</p>
                <p className="text-xs text-neutral-500 mt-1">Try searching by partial movie name or song title</p>
              </div>
            ) : (
              filteredSongs.map((s, index) => {
                const isSelected = selectedSong?.id === s.id;
                const isHighlighted = highlightedIndex === index;

                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur
                      handleSelect(s);
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                      isHighlighted 
                        ? 'bg-amber-500/20 text-white' 
                        : isSelected 
                          ? 'bg-neutral-800/80 text-white' 
                          : 'text-neutral-300 hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {s.title}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 truncate">
                        <span className="flex items-center gap-1 text-neutral-300">
                          <Film className="w-3 h-3 text-amber-400/80" />
                          {s.movie || 'Unknown Movie'}
                        </span>
                        {s.year && <span>• {s.year}</span>}
                        {s.singers && (
                          <span className="text-neutral-500 truncate">• {Array.isArray(s.singers) ? s.singers.join(', ') : s.singers}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.karaoke_url ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Mic className="w-2.5 h-2.5" /> Karaoke
                        </span>
                      ) : (
                        <span className="text-[10px] bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full font-medium">
                          No Karaoke
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded">
                        #{s.id}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
