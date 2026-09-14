import re

with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

# 1. Add states
state_insertion = """  const [singMode, setSingMode] = useState('default');
  const [customSnippet, setCustomSnippet] = useState(null);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestResults, setSuggestResults] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
"""
content = re.sub(r'(const \[hasTrackedListen, setHasTrackedListen\] = useState\(false\);)', r'\1\n' + state_insertion, content)

# 2. Update fetchSongOfDay
fetch_insertion = """          if (data.song && parsed.user?.sub) {
            try {
              const prefRes = await fetch(`${API_BASE_URL}/user/preferences?userId=${parsed.user.sub}`);
              const prefData = await prefRes.json();
              if (prefData.success && prefData.preferences) {
                const pref = prefData.preferences.find(p => p.songId === data.song.id);
                if (pref && pref.karaoke_snippet_start != null && pref.karaoke_snippet_end != null) {
                  setCustomSnippet({ karaoke_snippet_start: pref.karaoke_snippet_start, karaoke_snippet_end: pref.karaoke_snippet_end });
                  setSingMode('custom');
                }
              }
            } catch (err) { console.error("Pref fetch error", err); }
          }"""
content = re.sub(r'(setSong\(data\.song\);)', r'\1\n' + fetch_insertion, content)

# 3. Update previewKaraokeSegment
preview_func = """  const previewKaraokeSegment = () => {
    let startTime = 0;
    if (singMode === 'custom' && customSnippet) {
      startTime = customSnippet.karaoke_snippet_start / 1000;
    } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
      startTime = song.karaoke_snippet_start / 1000;
    }
    setChallengeStatus('previewing');
    setPendingSeekTime(startTime); // The src change will trigger onLoadedMetadata
  };"""
content = re.sub(r'const previewKaraokeSegment = \(\) => \{[\s\S]*?setPendingSeekTime\(startTime\);.*?\n  \};', preview_func, content)

# 4. Update startChallenge
start_func_part1 = """          // Seek and Play audio (if src hasn't changed, do it immediately)
          if (audioRef.current) {
            let startTime = 0;
            if (singMode === 'custom' && customSnippet) {
              startTime = customSnippet.karaoke_snippet_start / 1000;
            } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
              startTime = song.karaoke_snippet_start / 1000;
            }
            maxPlayedTimeRef.current = Math.max(maxPlayedTimeRef.current, startTime);
            audioRef.current.currentTime = startTime;"""
content = re.sub(r'          // Seek and Play audio.*?audioRef\.current\.currentTime = startTime;', start_func_part1, content, flags=re.DOTALL)

# 5. Handle stopping playback at end of snippet
# Find onTimeUpdate logic
on_time_update = """  const handleTimeUpdate = (e) => {
    if (!e.target) return;
    const time = e.target.currentTime;
    setCurrentTimeMs(Math.floor(time * 1000));
    
    // Auto-stop preview or recording if we hit snippet end
    if (challengeStatus === 'previewing' || challengeStatus === 'recording') {
      let endTime = null;
      if (singMode === 'custom' && customSnippet) {
        endTime = customSnippet.karaoke_snippet_end / 1000;
      } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
        endTime = song.karaoke_snippet_end / 1000;
      }
      
      if (endTime && time >= endTime) {
        if (challengeStatus === 'previewing') {
          setChallengeStatus('idle');
          e.target.pause();
        } else if (challengeStatus === 'recording') {
          stopChallenge();
        }
      }
    }
  };"""
content = re.sub(r'const handleTimeUpdate = \(e\) => \{[\s\S]*?setCurrentTimeMs\(Math\.floor\(time \* 1000\)\);\n  \};', on_time_update, content)

# 6. Insert new UI functions (handleSnippetSave, searchSuggest, submitSuggest)
ui_funcs = """
  const handleSaveCustomSnippet = async (start, end) => {
    if (!user) return toast.error("Please log in to save preferences");
    try {
      const res = await fetch(`${API_BASE_URL}/user/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.sub, songId: song.id, karaoke_snippet_start: start, karaoke_snippet_end: end })
      });
      const data = await res.json();
      if (data.success) {
        setCustomSnippet({ karaoke_snippet_start: start, karaoke_snippet_end: end });
        setSingMode('custom');
        setShowSnippetModal(false);
        toast.success("Custom segment saved!");
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch(err) {
      toast.error("Error saving segment");
    }
  };

  const handleSuggestSearch = async (e) => {
    e.preventDefault();
    if (!suggestQuery) return;
    setSuggestLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/search?q=${encodeURIComponent(suggestQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSuggestResults(data.results || []);
      }
    } catch (err) {
      toast.error("Search failed");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSuggestSubmit = async (spotifySong) => {
    if (!user) return toast.error("Log in to suggest");
    try {
      const res = await fetch(`${API_BASE_URL}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.sub,
          userName: user.name,
          spotifyId: spotifySong.id,
          title: spotifySong.title,
          movie: spotifySong.movie,
          year: spotifySong.year,
          previewUrl: spotifySong.preview_url,
          albumCoverUrl: spotifySong.album_cover_url
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Song suggested successfully! Pending admin approval.");
        setShowSuggestModal(false);
      } else {
        toast.error(data.error || "Failed to suggest");
      }
    } catch(err) {
      toast.error("Error suggesting song");
    }
  };
"""
content = re.sub(r'(const fetchArchive = useCallback\(async \(\) => \{)', ui_funcs + r'\n  \1', content)

# 7. Update Buttons in App.jsx rendering
buttons_ui = """                      {challengeStatus === 'idle' && (
                        <div className="flex flex-col gap-3 w-full max-w-xs">
                          <div className="flex bg-neutral-800 rounded-full p-1 mb-2 text-xs font-bold shadow-inner">
                            <button onClick={() => setSingMode('default')} className={`flex-1 py-1.5 rounded-full transition-all ${singMode === 'default' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>Default</button>
                            {customSnippet && <button onClick={() => setSingMode('custom')} className={`flex-1 py-1.5 rounded-full transition-all ${singMode === 'custom' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>My Snippet</button>}
                            <button onClick={() => setSingMode('full')} className={`flex-1 py-1.5 rounded-full transition-all ${singMode === 'full' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}>Full Song</button>
                          </div>
                          <button onClick={startChallenge} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full transition-colors shadow-lg shadow-purple-500/50 flex items-center justify-center gap-2">
                            <Mic className="w-4 h-4" /> Start Singing Challenge
                          </button>
                          {(singMode !== 'full' && (song.karaoke_snippet_start != null || customSnippet != null)) && (
                            <button onClick={previewKaraokeSegment} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-full transition-colors border border-zinc-700 flex items-center justify-center gap-2 text-sm">
                              <Headphones className="w-4 h-4" /> Preview Segment
                            </button>
                          )}
                          {user && (
                            <button onClick={() => setShowSnippetModal(true)} className="w-full py-2 bg-zinc-900/50 hover:bg-zinc-800 text-amber-400 font-semibold rounded-full transition-colors border border-amber-500/30 flex items-center justify-center gap-2 text-sm mt-2">
                              ✂️ Customize Snippet (Max 120s)
                            </button>
                          )}
                        </div>
                      )}"""
content = re.sub(r'\{challengeStatus === \'idle\' && \([\s\S]*?\}\)', buttons_ui, content, count=1)

# 8. Modals UI
modals_ui = """      {/* Custom Snippet Modal */}
      {showSnippetModal && song && (
        <SnippetEditorModal
          song={song}
          initialStart={customSnippet?.karaoke_snippet_start || song.karaoke_snippet_start || 0}
          initialEnd={customSnippet?.karaoke_snippet_end || song.karaoke_snippet_end || 60000}
          onClose={() => setShowSnippetModal(false)}
          onSave={handleSaveCustomSnippet}
        />
      )}

      {/* Suggest Song Modal */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Suggest a Song</h3>
              <button onClick={() => setShowSuggestModal(false)} className="text-neutral-500 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-neutral-400 mb-4">Search Spotify for an Ilayaraja song. Once suggested, admins can review and add it to the app.</p>
            <form onSubmit={handleSuggestSearch} className="flex gap-2 mb-6">
              <input type="text" value={suggestQuery} onChange={e => setSuggestQuery(e.target.value)} placeholder="Search song name..." className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500" />
              <button type="submit" disabled={suggestLoading} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-xl text-white font-bold transition-colors">
                {suggestLoading ? '...' : 'Search'}
              </button>
            </form>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {suggestResults.map(s => (
                <div key={s.id} className="flex items-center gap-4 bg-neutral-800 p-3 rounded-xl border border-neutral-700 hover:border-neutral-500 transition-colors">
                  <img src={s.album_cover_url} className="w-12 h-12 rounded bg-neutral-900" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{s.title}</h4>
                    <p className="text-xs text-neutral-400 truncate">{s.movie} ({s.year})</p>
                  </div>
                  <button onClick={() => handleSuggestSubmit(s)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors">
                    Suggest
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
"""
content = re.sub(r'(\{showPlaylistModal && \()', modals_ui + r'\n      \1', content)

# 9. Navbar suggest button
navbar_change = """<button onClick={() => setCurrentView('archive')} className={`font-semibold transition-colors px-3 py-1.5 rounded-full ${currentView === 'archive' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>Archive</button>
            {user && (
              <button onClick={() => setShowSuggestModal(true)} className="font-semibold transition-colors px-3 py-1.5 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-dashed border-zinc-600">
                💡 Suggest Song
              </button>
            )}"""
content = re.sub(r'<button onClick=\{.*?archive.*?</button>', navbar_change, content)

with open('frontend/src/App.jsx', 'w') as f:
    f.write(content)

