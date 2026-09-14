import os

new_code = """import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SnippetEditorModal({ song, initialStart, initialEnd, onClose, onSave }) {
  const [snippetStart, setSnippetStart] = useState(initialStart !== undefined ? initialStart : null);
  const [snippetEnd, setSnippetEnd] = useState(initialEnd !== undefined ? initialEnd : null);
  const [snippetCurrentTime, setSnippetCurrentTime] = useState(0);
  const [snippetDuration, setSnippetDuration] = useState(0);
  const [snippetPlaying, setSnippetPlaying] = useState(false);
  
  const snippetAudioRef = useRef(null);

  const toggleSnippetPlay = () => {
    if (!snippetAudioRef.current) return;
    if (snippetPlaying) {
      snippetAudioRef.current.pause();
    } else {
      snippetAudioRef.current.play().catch(e => console.error(e));
    }
    setSnippetPlaying(!snippetPlaying);
  };

  const handleSnippetTimeUpdate = (e) => {
    const ms = e.target.currentTime * 1000;
    setSnippetCurrentTime(ms);
    if (snippetEnd !== null && ms >= snippetEnd) {
       snippetAudioRef.current.pause();
       setSnippetPlaying(false);
       snippetAudioRef.current.currentTime = (snippetStart || 0) / 1000;
    }
  };

  const handleSnippetLoadedMetadata = (e) => {
    setSnippetDuration(e.target.duration * 1000);
  };

  const handleSetStart = () => {
    const nowMs = Math.round(snippetCurrentTime);
    if (snippetEnd !== null && snippetEnd <= nowMs) {
      alert('⚠️ Start time must be before end time.');
      return;
    }
    setSnippetStart(nowMs);
    if (snippetEnd !== null && snippetEnd <= nowMs) setSnippetEnd(null);
  };

  const handleSetEnd = () => {
    const nowMs = Math.round(snippetCurrentTime);
    if (snippetStart === null) { alert('⚠️ Please set a Start time first.'); return; }
    if (nowMs <= snippetStart) { alert('⚠️ End time must be after the start time.'); return; }
    
    if (nowMs - snippetStart > 120000) {
      alert('⚠️ Snippet cannot exceed 120 seconds!');
      return;
    }
    
    setSnippetEnd(nowMs);
  };

  const handleSeekOnBar = (e) => {
    if (!snippetAudioRef.current || !snippetDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekMs = ratio * snippetDuration;
    snippetAudioRef.current.currentTime = seekMs / 1000;
    setSnippetCurrentTime(seekMs);
  };

  const save = () => {
    if (snippetStart === null || snippetEnd === null) {
      alert("Please set both a Start and End time.");
      return;
    }
    if (snippetEnd - snippetStart > 120000) {
      alert("Snippet cannot exceed 120 seconds!");
      return;
    }
    onSave(snippetStart, snippetEnd);
  };

  const fmtTime = (ms) => {
    if (ms === null || ms === undefined) return '--:--';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-0 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-800 border-b border-neutral-700">
          <div>
            <h2 className="text-lg font-bold text-white">🎯 Customize Karaoke Snippet</h2>
            <p className="text-sm text-neutral-400 mt-0.5">{song.title}</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition-colors">&times;</button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Instructions */}
          <p className="text-sm text-neutral-400 bg-neutral-800/50 rounded-lg px-4 py-3 border border-neutral-700/50">
            🎧 Play the track below. When you reach the desired start of the challenge, click <strong className="text-purple-400">Set Start</strong>. When you reach the end, click <strong className="text-purple-400">Set End</strong>. Maximum <strong className="text-white">120 seconds</strong> allowed.
          </p>

          {/* Hidden audio element */}
          <audio
            ref={snippetAudioRef}
            src={song.original_url || song.karaoke_url || song.previewUrl}
            onTimeUpdate={handleSnippetTimeUpdate}
            onLoadedMetadata={handleSnippetLoadedMetadata}
            onEnded={() => setSnippetPlaying(false)}
            className="hidden"
          />

          {/* Current Time Display */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-white text-xl font-bold">{fmtTime(snippetCurrentTime)}</span>
            <span className="text-neutral-500 font-mono">{fmtTime(snippetDuration)}</span>
          </div>

          {/* Progress Bar with selection region */}
          <div
            className="relative h-14 bg-neutral-800 rounded-xl cursor-pointer overflow-hidden group border border-neutral-700"
            onClick={handleSeekOnBar}
            title="Click to seek"
          >
            {/* Selection highlight */}
            {snippetStart !== null && snippetDuration > 0 && (
              <div
                className="absolute top-0 h-full bg-purple-500/25 border-x-2 border-purple-500/70 transition-all"
                style={{
                  left: `${(snippetStart / snippetDuration) * 100}%`,
                  width: snippetEnd !== null
                    ? `${((snippetEnd - snippetStart) / snippetDuration) * 100}%`
                    : '2px'
                }}
              />
            )}

            {/* Playhead */}
            {snippetDuration > 0 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-white shadow-lg shadow-white/30 transition-none"
                style={{ left: `${(snippetCurrentTime / snippetDuration) * 100}%` }}
              />
            )}

            {/* Start marker */}
            {snippetStart !== null && snippetDuration > 0 && (
              <div
                className="absolute top-0 h-full flex flex-col justify-end pb-1 pointer-events-none"
                style={{ left: `${(snippetStart / snippetDuration) * 100}%` }}
              >
                <span className="text-xs bg-purple-600 text-white px-1 rounded font-mono ml-1">{fmtTime(snippetStart)}</span>
              </div>
            )}

            {/* End marker */}
            {snippetEnd !== null && snippetDuration > 0 && (
              <div
                className="absolute top-0 h-full flex flex-col justify-start pt-1 pointer-events-none"
                style={{ left: `${(snippetEnd / snippetDuration) * 100}%` }}
              >
                <span className="text-xs bg-pink-600 text-white px-1 rounded font-mono ml-1">{fmtTime(snippetEnd)}</span>
              </div>
            )}

            {/* Progress fill */}
            <div
              className="h-full bg-neutral-700/50 transition-none"
              style={{ width: snippetDuration > 0 ? `${(snippetCurrentTime / snippetDuration) * 100}%` : '0%' }}
            />
            <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-600 group-hover:text-neutral-500 transition-colors pointer-events-none select-none">
              {snippetDuration === 0 ? 'Loading audio...' : 'Click anywhere to seek'}
            </p>
          </div>

          {/* Playback + Set buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={toggleSnippetPlay}
              className="flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
            >
              {snippetPlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            {/* Set Start */}
            <button
              onClick={handleSetStart}
              className="flex-1 py-2.5 bg-purple-800/50 hover:bg-purple-700/60 border border-purple-600/50 text-purple-300 font-semibold rounded-xl transition-colors text-sm"
            >
              🟣 Set Start {snippetStart !== null ? `(${fmtTime(snippetStart)})` : ''}
            </button>

            {/* Set End */}
            <button
              onClick={handleSetEnd}
              className="flex-1 py-2.5 bg-pink-900/40 hover:bg-pink-800/50 border border-pink-600/50 text-pink-300 font-semibold rounded-xl transition-colors text-sm"
            >
              🔴 Set End {snippetEnd !== null ? `(${fmtTime(snippetEnd)})` : ''}
            </button>

            {/* Clear */}
            <button
              onClick={() => { setSnippetStart(null); setSnippetEnd(null); }}
              className="px-4 py-2.5 w-full sm:w-auto text-neutral-500 hover:text-neutral-300 border border-neutral-700 rounded-xl transition-colors text-sm"
            >
              Clear
            </button>
          </div>

          {/* Snippet Summary */}
          {snippetStart !== null && snippetEnd !== null && (
            <div className="flex items-center gap-3 px-4 py-3 bg-purple-950/40 border border-purple-700/40 rounded-xl">
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {Math.round((snippetEnd - snippetStart) / 1000)}s
              </div>
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2 border-t border-neutral-800">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-neutral-400 border border-neutral-700 rounded-xl hover:bg-neutral-800 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={snippetStart === null || snippetEnd === null}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              ✅ Save Segment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"""

with open('frontend/src/components/SnippetEditorModal.jsx', 'w') as f:
    f.write(new_code)
