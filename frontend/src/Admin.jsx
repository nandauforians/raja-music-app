import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin, useGoogleLogin, googleLogout } from '@react-oauth/google';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [songs, setSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState('database');
  const [schedule, setSchedule] = useState([]);
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState('');
  
  const [incentives, setIncentives] = useState([]);
  const [incentivesLoading, setIncentivesLoading] = useState(false);
  const [incentiveModalReq, setIncentiveModalReq] = useState(null);

  // Karaoke Snippet Picker state
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const [snippetSong, setSnippetSong] = useState(null);
  const [snippetStart, setSnippetStart] = useState(null);
  const [snippetEnd, setSnippetEnd] = useState(null);
  const [snippetCurrentTime, setSnippetCurrentTime] = useState(0);
  const [snippetDuration, setSnippetDuration] = useState(0);
  const [snippetPlaying, setSnippetPlaying] = useState(false);
  const [snippetSaving, setSnippetSaving] = useState(false);
  const snippetAudioRef = useRef(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', movie: '', year: '', spotify_id: '', director: '', karaoke_url: '', youtube_url: '' });
  
  // Edit form state
  const [editingSong, setEditingSong] = useState(null);

  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);
  const [spotifyResults, setSpotifyResults] = useState([]);
  
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [youtubeResults, setYoutubeResults] = useState([]);

  const handleSpotifySearch = async (e) => {
    e?.preventDefault();
    if (!spotifyQuery) return;
    setIsSearchingSpotify(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/search?q=${encodeURIComponent(spotifyQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSpotifyResults(data.results);
      }
    } catch (err) {
      console.error(err);
    }
    setIsSearchingSpotify(false);
  };

  const selectSpotifyResult = (track) => {
    setNewSong({ ...newSong, title: track.title, movie: track.movie, year: track.year, spotify_id: track.spotify_id });
    setSpotifyResults([]);
    setSpotifyQuery('');
  };

  const handleYoutubeSearch = async (title, movie) => {
    if (!title || !movie) {
      alert("Please enter both Title and Movie before searching YouTube.");
      return;
    }
    setIsSearchingYoutube(true);
    setYoutubeResults([]);
    try {
      const q = encodeURIComponent(`${title} ${movie} original audio`);
      const res = await fetch(`${API_BASE_URL}/admin/youtube-search?q=${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        setYoutubeResults(data.videos || []);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
    setIsSearchingYoutube(false);
  };

  const selectYoutubeResultForNewSong = (video) => {
    setNewSong({ ...newSong, youtube_url: video.url });
    setYoutubeResults([]);
  };

  const selectYoutubeResultForEditSong = (video) => {
    setEditingSong({ ...editingSong, youtube_url: video.url });
    setYoutubeResults([]);
  };

  const [commandPopup, setCommandPopup] = useState(null);
  const [processingSongs, setProcessingSongs] = useState(new Set());

  const triggerLocalPipeline = (songId) => {
    const cwd = window.location.pathname.includes('/raja-music-app') 
      ? window.location.pathname.split('/raja-music-app')[0] + '/raja-music-app'
      : '/Users/nanda/code/raja-music-app';
    const cmd = `cd ${cwd} && python3 scripts/generate_karaoke.py --song-id ${songId}`;
    setCommandPopup(cmd);
  };

  const executeCopy = async (cmd) => {
    try {
      await navigator.clipboard.writeText(cmd);
      // Brief visual feedback on the button itself could be added, but the user just wants an elegant popup.
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // ── RENDERERS ─────────────────────────────────────────────────────────────Gamification Tab state
  const [leaderboard, setLeaderboard] = useState([]);
  const [gamificationLoading, setGamificationLoading] = useState(false);
  const [payoutModalUser, setPayoutModalUser] = useState(null);
  const [isPayingOut, setIsPayingOut] = useState(false);

  const handleMarkAsPaid = async () => {
    if (!payoutModalUser) return;
    setIsPayingOut(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: payoutModalUser.userId, amount: payoutModalUser.totalPoints })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(leaderboard.map(u => u.userId === payoutModalUser.userId ? { ...u, totalPoints: data.newTotal } : u));
        setPayoutModalUser(null);
      } else {
        setError(data.error || 'Failed to process payout');
      }
    } catch (e) {
      setError(e.message);
    }
    setIsPayingOut(false);
  };

  useEffect(() => {
    if (token) {
      fetchSongs();
      fetchSchedule();
      fetchGamification();
      fetchIncentives();
    }
  }, [token]);

  const fetchGamification = async () => {
    setGamificationLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/gamification`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) { console.error(err); }
    setGamificationLoading(false);
  };

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/schedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/songs/list?pageSize=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        setSongs(data.songs);
      } else {
        throw new Error(data.error || data.message || 'Error fetching songs');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleUpdateSong = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/songs/${editingSong.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(editingSong)
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        setEditingSong(null);
        fetchSongs(); // Refresh list
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddSong = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!newSong.title || !newSong.movie || !newSong.spotify_id) {
      alert("Title, Movie, and Spotify ID are required.");
      return;
    }
    try {
      const payload = { ...newSong };
      if (force) payload.force = true;

      const res = await fetch(`${API_BASE_URL}/admin/songs`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      
      if (res.status === 409) {
        if (window.confirm(data.error + "\n\nDo you want to add this song anyway?")) {
          return handleAddSong(null, true);
        }
        return;
      }

      if (data.success) {
        setShowAddForm(false);
        setNewSong({ title: '', movie: '', year: '', spotify_id: '', director: '', karaoke_url: '', youtube_url: '' });
        fetchSongs(); // Refresh list
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/songs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        fetchSongs();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKaraokeUpload = async (songId, file) => {
    const contentTypeMap = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mp4a': 'audio/mp4',
      'aac': 'audio/aac',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
    };

    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const contentType = contentTypeMap[ext] || 'audio/mpeg';

      // 1. Get a presigned S3 upload URL from our backend
      const urlRes = await fetch(`${API_BASE_URL}/admin/karaoke-upload-url?songId=${songId}&ext=${ext}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const urlData = await urlRes.json();
      if (!urlData.success) throw new Error(urlData.error);

      // 2. Upload the file to S3 — content type MUST match what the presigned URL was signed with
      const uploadRes = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`S3 upload failed (${uploadRes.status}): ${errText.substring(0, 200)}`);
      }

      // 3. For non-mp3 files: source is uploaded, now run Demucs locally to strip vocals
      if (ext !== 'mp3') {
        await fetch(`${API_BASE_URL}/admin/songs/${songId}/karaoke`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ original_url: urlData.publicUrl })
        });
        alert(`✅ Source file uploaded to S3!\n\nNow run the vocal separation pipeline in your terminal:\n\n  cd /Users/nanda/code/raja-music-app\n  python3 scripts/generate_karaoke.py --song-id "${songId}" --local-file "${file.name}"\n\nDemucs will strip the vocals and automatically update the karaoke track in the database.`);
        return;
      }

      // 4. For mp3, it's already instrumental — save directly to MongoDB
      const patchRes = await fetch(`${API_BASE_URL}/admin/songs/${songId}/karaoke`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ karaoke_url: urlData.publicUrl, original_url: urlData.publicUrl })
      });
      const patchData = await patchRes.json();
      if (!patchData.success) throw new Error(patchData.error);

      alert(`✅ Karaoke track ready!\n${urlData.publicUrl}`);
      fetchSongs();
    } catch (err) {
      alert(`❌ Upload failed: ${err.message}`);
    }
  };

  const handleUpdateSongSnippet = async (songId, startStr, endStr) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/songs/${songId}/karaoke`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          karaoke_snippet_start: startStr ? parseInt(startStr, 10) : null, 
          karaoke_snippet_end: endStr ? parseInt(endStr, 10) : null 
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      alert('✅ Snippet updated!');
      fetchSongs();
    } catch (err) {
      alert(`❌ Failed to update snippet: ${err.message}`);
    }
  };

  // ── Snippet Picker Modal Logic ──────────────────────────────────────────
  const openSnippetPicker = (song) => {
    setSnippetSong(song);
    setSnippetStart(song.karaoke_snippet_start ?? null);
    setSnippetEnd(song.karaoke_snippet_end ?? null);
    setSnippetCurrentTime(0);
    setSnippetDuration(0);
    setSnippetPlaying(false);
    setShowSnippetPicker(true);
  };

  const closeSnippetPicker = () => {
    if (snippetAudioRef.current) {
      snippetAudioRef.current.pause();
      snippetAudioRef.current.src = '';
    }
    setShowSnippetPicker(false);
    setSnippetSong(null);
    setSnippetPlaying(false);
  };

  const handleSnippetTimeUpdate = () => {
    if (snippetAudioRef.current) {
      setSnippetCurrentTime(snippetAudioRef.current.currentTime * 1000);
    }
  };

  const handleSnippetLoadedMetadata = () => {
    if (snippetAudioRef.current) {
      setSnippetDuration(snippetAudioRef.current.duration * 1000);
    }
  };

  const toggleSnippetPlay = () => {
    if (!snippetAudioRef.current) return;
    if (snippetPlaying) {
      snippetAudioRef.current.pause();
    } else {
      snippetAudioRef.current.play();
    }
    setSnippetPlaying(!snippetPlaying);
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

  const handleSaveSnippet = async () => {
    if (snippetStart === null || snippetEnd === null) { alert('Please set both a Start and End time.'); return; }
    setSnippetSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/songs/${snippetSong.id}/karaoke`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ karaoke_snippet_start: snippetStart, karaoke_snippet_end: snippetEnd })
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchSongs();
      closeSnippetPicker();
    } catch (err) {
      alert(`❌ Failed to save snippet: ${err.message}`);
      setSnippetSaving(false);
    }
  };

  const fmtTime = (ms) => {
    if (ms === null || ms === undefined) return '--:--';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleScheduleSong = async (dateISO8601, song_id, karaoke_enabled) => {

    if (!song_id) return;
    const song = songs.find(s => s.id === song_id);
    if (!song) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/schedule`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dateISO8601, 
          song_id, 
          title: song.title, 
          movie: song.movie, 
          year: song.year,
          karaoke_enabled
        })
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.success) {
        fetchSchedule(); // refresh
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRandomizeSong = async (dateISO8601) => {
    const scheduledIds = schedule.map(s => s.song_id).filter(Boolean);
    const availableSongs = songs.filter(s => !scheduledIds.includes(s.id));
    
    if (availableSongs.length === 0) {
      alert('No more unscheduled songs available!');
      return;
    }
    
    const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
    await handleScheduleSong(dateISO8601, randomSong.id, true);
  };

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl text-center max-w-sm w-full">
          <h2 className="text-2xl font-bold text-white mb-6">Admin Login</h2>
          <p className="text-gray-400 mb-6 text-sm">Please sign in with your authorized Google account to manage the music catalog.</p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={credentialResponse => {
                const jwt = credentialResponse.credential;
                localStorage.setItem('adminToken', jwt);
                setToken(jwt);
              }}
              onError={() => {
                console.log('Login Failed');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const filteredSongs = songs.filter(song => 
    song.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    song.movie?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.director?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderDatabaseTab = () => {
    return (
      <>
        <div className="flex justify-between items-center bg-neutral-800 p-4 rounded-xl border border-neutral-700">
          <div className="flex items-center gap-4 flex-1">
            <input 
              type="text" 
              placeholder="Search by title, movie or director..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
            <span className="text-sm font-medium text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full">
              {songs.length} Total Songs
            </span>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition"
          >
            {showAddForm ? 'Cancel' : '+ Add New Song'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add a Masterpiece</h2>
            </div>
            
            <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Auto-fill from Spotify</label>
              <form onSubmit={handleSpotifySearch} className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  placeholder="Search track name..." 
                  value={spotifyQuery}
                  onChange={e => setSpotifyQuery(e.target.value)}
                  className="flex-1 px-4 py-2 bg-black border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
                <button type="submit" disabled={isSearchingSpotify} className="px-4 bg-zinc-700 hover:bg-zinc-600 transition-colors rounded-lg text-sm font-semibold disabled:opacity-50">
                  {isSearchingSpotify ? '...' : 'Search'}
                </button>
              </form>
              
              {spotifyResults.length > 0 && (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto mt-2">
                  {spotifyResults.map(r => (
                    <div key={r.spotify_id} onClick={() => selectSpotifyResult(r)} className="p-2 hover:bg-zinc-800 cursor-pointer rounded text-sm flex gap-3 items-center">
                      {r.image && <img src={r.image} className="w-10 h-10 rounded object-cover" />}
                      <div>
                        <div className="font-bold text-white">{r.title}</div>
                        <div className="text-xs text-zinc-400">{r.movie} • {r.year}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddSong} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" id="newSongTitle" placeholder="Song Title *" required value={newSong.title} onChange={e => setNewSong({...newSong, title: e.target.value})} className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg" />
              <input type="text" id="newSongMovie" placeholder="Movie *" required value={newSong.movie} onChange={e => setNewSong({...newSong, movie: e.target.value})} className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg" />
              <input type="text" id="newSongDirector" placeholder="Music Director" value={newSong.director} onChange={e => setNewSong({...newSong, director: e.target.value})} className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg" />
              <input type="text" id="newSongYear" placeholder="Year (e.g. 1986)" value={newSong.year} onChange={e => setNewSong({...newSong, year: e.target.value})} className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg" />
              <input type="text" id="newSongSpotifyId" placeholder="Spotify Track ID *" required value={newSong.spotify_id} onChange={e => setNewSong({...newSong, spotify_id: e.target.value})} className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg md:col-span-2" />
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1.5">🎤 Karaoke Track URL (optional)</label>
                <input
                  type="url"
                  id="newSongKaraokeUrl"
                  placeholder="https://... (paste a public MP3 URL for the instrumental version)"
                  value={newSong.karaoke_url}
                  onChange={e => setNewSong({...newSong, karaoke_url: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-900 border border-purple-900/50 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
                <p className="text-xs text-neutral-500 mt-1">Leave blank — the automated pipeline will fill this in daily. Or paste a link to a manually prepared instrumental MP3.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>▶️ YouTube URL (optional)</span>
                  <button 
                    type="button" 
                    onClick={() => handleYoutubeSearch(newSong.title, newSong.movie)}
                    disabled={isSearchingYoutube}
                    className="text-xs bg-red-900/50 hover:bg-red-800 text-white px-2 py-1 rounded"
                  >
                    {isSearchingYoutube ? 'Searching...' : '🔍 Search YouTube'}
                  </button>
                </label>
                <input
                  type="url"
                  id="newSongYoutubeUrl"
                  placeholder="https://youtube.com/watch?v=..."
                  value={newSong.youtube_url || ''}
                  onChange={e => setNewSong({...newSong, youtube_url: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-900 border border-red-900/50 rounded-lg text-sm focus:outline-none focus:border-red-500 transition-colors"
                />
                
                {youtubeResults.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                    {youtubeResults.map(v => (
                      <div key={v.videoId} onClick={() => selectYoutubeResultForNewSong(v)} className="flex gap-2 p-2 hover:bg-neutral-800 rounded cursor-pointer">
                        <img src={v.thumbnail} className="w-24 h-16 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{v.title}</p>
                          <p className="text-xs text-neutral-400">{v.channel} • {v.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-neutral-500 mt-1">Provide a YouTube link for the automated pipeline to download the audio directly instead of searching.</p>
              </div>
              <div className="md:col-span-2 flex justify-end mt-2">
                <button type="submit" className="px-6 py-2 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition">Save Song</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-700/50">
              <tr>
                <th className="px-6 py-4 font-medium text-neutral-300 w-16">ID</th>
                <th className="px-6 py-4 font-medium text-neutral-300">Title</th>
                <th className="px-6 py-4 font-medium text-neutral-300">Movie</th>
                <th className="px-6 py-4 font-medium text-neutral-300">Director</th>
                <th className="px-6 py-4 font-medium text-neutral-300">Year</th>
                <th className="px-6 py-4 font-medium text-neutral-300">🎤 Karaoke</th>
                <th className="px-6 py-4 font-medium text-neutral-300">Snippet (ms)</th>
                <th className="px-6 py-4 font-medium text-neutral-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-neutral-400">Loading songs...</td></tr>
              ) : filteredSongs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-neutral-400">No songs found.</td></tr>
              ) : (
                filteredSongs.map(song => {
                  const needsPipeline = !song.youtube_url && !song.karaoke_url;
                  return (
                  <tr key={song.id || song._id} className={`transition-colors ${needsPipeline ? 'bg-red-900/10 hover:bg-red-900/20 border-l-2 border-red-500' : 'hover:bg-neutral-700/20'}`}>
                    <td className="px-6 py-4 font-mono text-xs text-neutral-400">{song.id}</td>
                    <td className="px-6 py-4 font-medium">
                      {song.title}
                      {needsPipeline && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 text-[10px] uppercase font-bold tracking-wider" title="Missing YouTube URL for pipeline">No YT</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">{song.movie}</td>
                    <td className="px-6 py-4 text-neutral-400">{song.director || 'Ilaiyaraaja'}</td>
                    <td className="px-6 py-4 text-neutral-400">{song.year}</td>
                    <td className="px-6 py-4">
                      {song.karaoke_url ? (
                        <span className="text-xs text-purple-400 font-medium flex items-center gap-2">✅ Ready</span>
                      ) : (
                        <div className="flex flex-col gap-2 items-start">
                          {song.youtube_url && (
                            <button
                              onClick={() => triggerLocalPipeline(song.id)}
                              className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors border bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-amber-500/30`}
                              title="Show local pipeline command"
                            >
                              ⚡ Run Pipeline
                            </button>
                          )}
                          <label className="cursor-pointer text-xs text-zinc-500 hover:text-purple-400 transition-colors">
                            📤 Upload MP3
                            <input
                              type="file"
                              accept="audio/*,.mp3,.m4a,.mp4a,.aac,.wav,.ogg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) handleKaraokeUpload(song.id, file);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => song.karaoke_url ? openSnippetPicker(song) : alert('Upload a karaoke track first to set the snippet.')}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                          song.karaoke_snippet_start !== undefined && song.karaoke_snippet_end !== undefined
                            ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-800/50 border border-purple-700/40'
                            : 'bg-neutral-800 text-neutral-500 hover:text-purple-400 border border-neutral-700'
                        }`}
                      >
                        🎯
                        {song.karaoke_snippet_start !== undefined && song.karaoke_snippet_end !== undefined
                          ? `${fmtTime(song.karaoke_snippet_start)} → ${fmtTime(song.karaoke_snippet_end)}`
                          : 'Set Snippet'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        <button onClick={() => setEditingSong(song)} className="text-blue-400 hover:text-blue-300 text-xs font-semibold">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(song.id)} className="text-red-400 hover:text-red-300 text-xs">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderScheduleTab = () => {
    // Generate next 10 days
    const scheduleDays = Array.from({ length: 10 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    return (
      <div className="flex flex-col gap-4">
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 mb-4">
          <h2 className="text-xl font-bold text-amber-500 mb-2">10-Day Predictability 📅</h2>
          <p className="text-sm text-neutral-400">
            Set up the song rotation for the upcoming days. For complex songs that aren't good for singing, disable Karaoke to bypass vocal separation. 
            Once scheduled, run <code className="bg-black px-2 py-0.5 rounded text-amber-400">python3 scripts/daily_karaoke.py --date YYYY-MM-DD</code> locally to generate the S3 assets!
          </p>
        </div>
        
        <div className="mb-2">
          <input 
            type="text" 
            placeholder="Search to filter dropdowns (by title or movie)..." 
            value={scheduleSearchTerm}
            onChange={(e) => setScheduleSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="grid gap-4">
          {scheduleDays.map(dateStr => {
            const scheduledForDay = schedule.find(s => s.dateISO8601 === dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            
            const filteredScheduleSongs = songs.filter(s => 
              !scheduleSearchTerm || 
              s.title.toLowerCase().includes(scheduleSearchTerm.toLowerCase()) || 
              s.movie.toLowerCase().includes(scheduleSearchTerm.toLowerCase()) ||
              (scheduledForDay && s.id === scheduledForDay.song_id) // Always include currently selected song
            );
            
            return (
              <div key={dateStr} className={`bg-neutral-800 p-5 rounded-xl border flex items-center justify-between ${isToday ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-neutral-700'}`}>
                <div className="w-48">
                  <p className="font-bold text-lg">{new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  {isToday && <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">TODAY</span>}
                </div>
                
                <div className="flex-1 px-6">
                  <div className="flex items-center gap-2 mb-1">
                    <select 
                      value={scheduledForDay?.song_id || ''} 
                      onChange={(e) => handleScheduleSong(dateStr, e.target.value, scheduledForDay?.karaoke_enabled !== false)}
                      className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="" disabled>Select a song to schedule...</option>
                      {filteredScheduleSongs.map(s => (
                        <option key={s.id} value={s.id}>{s.title} ({s.movie})</option>
                      ))}
                    </select>
                  </div>
                  {scheduledForDay && (
                    <div className="flex items-center gap-3 text-xs pl-1">
                      <span className="text-neutral-500 font-mono">ID: {scheduledForDay.song_id}</span>
                      {(() => {
                        const sObj = songs.find(s => s.id === scheduledForDay.song_id);
                        if (!sObj) return null;
                        const hasSnippet = sObj.karaoke_snippet_start != null && sObj.karaoke_snippet_end != null;
                        return (
                          <>
                            {sObj.karaoke_url ? (
                              <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">Karaoke Ready</span>
                            ) : (
                              <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">No Karaoke</span>
                            )}
                            {hasSnippet ? (
                              <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">Snippet Set</span>
                            ) : (
                              <button 
                                onClick={() => openSnippetPicker(sObj)}
                                className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium hover:bg-amber-500/20 transition-colors"
                                title="Click to set the 60-second karaoke snippet"
                              >
                                Set Snippet ✂️
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 min-w-max justify-end">
                  <button
                    onClick={() => handleRandomizeSong(dateStr)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-sm font-medium rounded-lg transition-colors border border-neutral-600"
                    title="Select a random unused song"
                  >
                    🎲 Random
                  </button>
                  {scheduledForDay && (
                    <>
                      <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={scheduledForDay.karaoke_enabled !== false} 
                          onChange={(e) => handleScheduleSong(dateStr, scheduledForDay.song_id, e.target.checked)}
                          className="w-4 h-4 rounded border-neutral-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-neutral-800"
                        />
                        Karaoke
                      </label>
                      <button
                        onClick={() => window.open(`/?previewDate=${dateStr}`, '_blank')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-sm font-medium rounded-lg transition-colors border border-neutral-600"
                        title="Preview this song in the main app"
                      >
                        👁️ Preview
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGamificationTab = () => {
    return (
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Gamification Leaderboard</h2>
        {gamificationLoading ? (
          <div className="text-center py-12 text-neutral-400">Loading leaderboard...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-700 text-neutral-400 text-sm">
                  <th className="pb-3 px-4">User</th>
                  <th className="pb-3 px-4">Mobile Number</th>
                  <th className="pb-3 px-4">Total Points</th>
                  <th className="pb-3 px-4">Listens (250)</th>
                  <th className="pb-3 px-4">Spotify Adds (250)</th>
                  <th className="pb-3 px-4">Karaoke (500)</th>
                  <th className="pb-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700/50">
                {leaderboard.map(u => (
                  <tr key={u.userId} className="hover:bg-neutral-700/20 transition">
                    <td className="py-4 px-4 font-medium text-white">{u.name}</td>
                    <td className="py-4 px-4 text-neutral-300">{u.mobileNumber || 'N/A'}</td>
                    <td className="py-4 px-4 text-amber-500 font-bold">{u.totalPoints.toLocaleString()}</td>
                    <td className="py-4 px-4 text-neutral-300">{u.listens}</td>
                    <td className="py-4 px-4 text-neutral-300">{u.spotifyAdds}</td>
                    <td className="py-4 px-4 text-neutral-300">{u.karaokes}</td>
                    <td className="py-4 px-4 text-right">
                      {u.mobileNumber && u.totalPoints > 0 ? (
                        <button
                          onClick={() => setPayoutModalUser(u)}
                          className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-sm font-medium transition-colors"
                        >
                          Pay with GPay
                        </button>
                      ) : (
                        <span className="text-neutral-500 text-sm">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const fetchIncentives = async () => {
    setIncentivesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/incentives`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setIncentives(data.requests || []);
    } catch (err) { console.error(err); }
    setIncentivesLoading(false);
  };

  const handleApproveIncentive = (req) => {
    // Show QR Modal for Desktop/Admin without closing transaction yet
    setIncentiveModalReq(req);
  };

  const handleMarkIncentiveAsPaid = async (reqId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/incentives/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId: reqId })
      });
      if (res.ok) {
        // Remove from local state and close modal
        setIncentives(prev => prev.filter(r => r._id !== reqId));
        setIncentiveModalReq(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleRejectIncentive = async (reqId) => {
    if (!window.confirm('Are you sure you want to reject this request? The points will be refunded.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/incentives/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId: reqId })
      });
      if (res.ok) {
        setIncentives(prev => prev.filter(r => r._id !== reqId));
      }
    } catch (e) { console.error(e); }
  };

  const renderIncentivesTab = () => {
    return (
      <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
        <h2 className="text-xl font-bold mb-6 text-amber-500">Incentive Requests (Pending)</h2>
        {incentivesLoading ? (
          <div className="text-neutral-400">Loading requests...</div>
        ) : incentives.length === 0 ? (
          <div className="text-neutral-400">No pending incentive requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-700 text-neutral-400 text-sm">
                  <th className="py-3 font-medium">User</th>
                  <th className="py-3 font-medium">Amount (pts/₹)</th>
                  <th className="py-3 font-medium">Mobile/UPI</th>
                  <th className="py-3 font-medium">Requested At</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incentives.map((req, idx) => (
                  <tr key={idx} className="border-b border-neutral-700/50 hover:bg-neutral-700/20">
                    <td className="py-3 font-medium">{req.userName}</td>
                    <td className="py-3 text-amber-400 font-bold">{req.amount}</td>
                    <td className="py-3">{req.mobileNumber}</td>
                    <td className="py-3 text-sm text-neutral-500">{new Date(req.requestedAt).toLocaleString()}</td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => handleApproveIncentive(req)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-sm transition">Approve & Pay</button>
                      <button onClick={() => handleRejectIncentive(req._id)} className="bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded text-sm transition border border-red-700">Reject/Refund</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold">Admin Portal</h1>
            <a href="/" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition underline underline-offset-4">
              ← Go to App
            </a>
            <div className="flex bg-neutral-800 rounded-lg p-1">
              <button 
                onClick={() => setActiveTab('database')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'database' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                Song Master List
              </button>
              <button 
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'schedule' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                10-Day Schedule
              </button>
              <button 
                onClick={() => setActiveTab('incentives')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'incentives' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                Incentives
              </button>
              <button 
                onClick={() => setActiveTab('gamification')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'gamification' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                Gamification
              </button>
            </div>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition">
            Sign Out
          </button>
        </div>

        {error && <div className="p-4 bg-red-900/50 text-red-200 rounded-lg border border-red-800">{error}</div>}

        {activeTab === 'database' ? renderDatabaseTab() : activeTab === 'schedule' ? renderScheduleTab() : activeTab === 'incentives' ? renderIncentivesTab() : renderGamificationTab()}
      </div>

      {/* ── EDIT SONG MODAL ──────────────────────────────── */}
      {editingSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col p-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
              <h2 className="text-xl font-bold text-white">Edit Song</h2>
              <button onClick={() => setEditingSong(null)} className="text-neutral-500 hover:text-white transition text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleUpdateSong} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Song Title *" required value={editingSong.title} onChange={e => setEditingSong({...editingSong, title: e.target.value})} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white" />
              <input type="text" placeholder="Movie *" required value={editingSong.movie} onChange={e => setEditingSong({...editingSong, movie: e.target.value})} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white" />
              <input type="text" placeholder="Music Director" value={editingSong.director || ''} onChange={e => setEditingSong({...editingSong, director: e.target.value})} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white" />
              <input type="text" placeholder="Year (e.g. 1986)" value={editingSong.year || ''} onChange={e => setEditingSong({...editingSong, year: e.target.value})} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white" />
              <input type="text" placeholder="Spotify Track ID *" required value={editingSong.spotify_id} onChange={e => setEditingSong({...editingSong, spotify_id: e.target.value})} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white md:col-span-2" />
              
              <div className="md:col-span-2 mt-2">
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1.5">🎤 Karaoke Track URL (optional)</label>
                <input type="url" placeholder="https://..." value={editingSong.karaoke_url || ''} onChange={e => setEditingSong({...editingSong, karaoke_url: e.target.value})} className="w-full px-4 py-2 bg-neutral-800 border border-purple-900/50 rounded-lg text-white focus:border-purple-500 transition-colors" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>▶️ YouTube URL (optional)</span>
                  <button 
                    type="button" 
                    onClick={() => handleYoutubeSearch(editingSong.title, editingSong.movie)}
                    disabled={isSearchingYoutube}
                    className="text-xs bg-red-900/50 hover:bg-red-800 text-white px-2 py-1 rounded"
                  >
                    {isSearchingYoutube ? 'Searching...' : '🔍 Search YouTube'}
                  </button>
                </label>
                <input type="url" placeholder="https://youtube.com/watch?v=..." value={editingSong.youtube_url || ''} onChange={e => setEditingSong({...editingSong, youtube_url: e.target.value})} className="w-full px-4 py-2 bg-neutral-800 border border-red-900/50 rounded-lg text-white focus:border-red-500 transition-colors" />
                
                {youtubeResults.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto bg-neutral-900 p-2 rounded-lg border border-neutral-700">
                    {youtubeResults.map(v => (
                      <div key={v.videoId} onClick={() => selectYoutubeResultForEditSong(v)} className="flex gap-2 p-2 hover:bg-neutral-800 rounded cursor-pointer">
                        <img src={v.thumbnail} className="w-24 h-16 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{v.title}</p>
                          <p className="text-xs text-neutral-400">{v.channel} • {v.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-neutral-500 mt-1">Provide a YouTube link for the automated pipeline to download the audio directly.</p>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setEditingSong(null)} className="px-6 py-2 bg-neutral-800 text-white font-semibold rounded-lg hover:bg-neutral-700 transition">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── KARAOKE SNIPPET PICKER MODAL ──────────────────────────────── */}
      {showSnippetPicker && snippetSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-0 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-neutral-800 border-b border-neutral-700">
              <div>
                <h2 className="text-lg font-bold text-white">🎯 Karaoke Snippet Picker</h2>
                <p className="text-sm text-neutral-400 mt-0.5">{snippetSong.title} <span className="text-neutral-600">•</span> {snippetSong.movie}</p>
              </div>
              <button onClick={closeSnippetPicker} className="text-neutral-500 hover:text-white text-2xl leading-none transition-colors">&times;</button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Instructions */}
              <p className="text-sm text-neutral-400 bg-neutral-800/50 rounded-lg px-4 py-3 border border-neutral-700/50">
                🎧 Play the track below. When you reach the desired start of the challenge, click <strong className="text-purple-400">Set Start</strong>. When you reach the end, click <strong className="text-purple-400">Set End</strong>. Maximum <strong className="text-white">60 seconds</strong> allowed.
              </p>

              {/* Hidden audio element */}
              <audio
                ref={snippetAudioRef}
                src={snippetSong.original_url || snippetSong.karaoke_url}
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
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={toggleSnippetPlay}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
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
                  className="px-4 py-2.5 text-neutral-500 hover:text-neutral-300 border border-neutral-700 rounded-xl transition-colors text-sm"
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
                  onClick={closeSnippetPicker}
                  className="flex-1 py-3 text-neutral-400 border border-neutral-700 rounded-xl hover:bg-neutral-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSnippet}
                  disabled={snippetStart === null || snippetEnd === null || snippetSaving}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                >
                  {snippetSaving ? 'Saving...' : '✅ Save Snippet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────── */}

      {/* ── PAYOUT MODAL ──────────────────────────────── */}
      {payoutModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col p-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
              <h2 className="text-xl font-bold text-white">GPay Payout</h2>
              <button onClick={() => setPayoutModalUser(null)} className="text-neutral-500 hover:text-white transition text-2xl leading-none">&times;</button>
            </div>
            
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-neutral-400 text-sm mb-1">Paying user: <strong className="text-white">{payoutModalUser.name}</strong></p>
                <p className="text-amber-500 text-3xl font-black">₹{payoutModalUser.totalPoints.toLocaleString()}</p>
                <p className="text-neutral-500 text-xs mt-1">GPay: {payoutModalUser.mobileNumber}</p>
              </div>

              {/* QR Code for Desktop Admins */}
              <div className="bg-white p-4 rounded-xl shadow-lg hidden md:block">
                <QRCodeSVG 
                  value={`upi://pay?pa=${payoutModalUser.mobileNumber}@okbizaxis&pn=${encodeURIComponent(payoutModalUser.name)}&am=${payoutModalUser.totalPoints}&cu=INR`}
                  size={200}
                />
              </div>
              <p className="text-xs text-neutral-500 hidden md:block">Scan with GPay app to pay</p>

              {/* Deep Link for Mobile Admins */}
              <a 
                href={`upi://pay?pa=${payoutModalUser.mobileNumber}@okbizaxis&pn=${encodeURIComponent(payoutModalUser.name)}&am=${payoutModalUser.totalPoints}&cu=INR`}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center transition-colors md:hidden"
              >
                Open GPay App
              </a>

              <button
                onClick={handleMarkAsPaid}
                disabled={isPayingOut}
                className="w-full py-3 mt-2 border border-emerald-600 text-emerald-500 hover:bg-emerald-900/30 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isPayingOut ? 'Processing...' : '✅ Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── COMMAND POPUP MODAL ──────────────────────────────── */}
      {commandPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Run Karaoke Pipeline</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Copy the command below and paste it into your Mac's terminal to process this song.
            </p>
            
            <div className="bg-black border border-neutral-800 rounded-xl p-4 mb-6 relative group">
              <code className="text-amber-400 font-mono text-sm break-all">
                {commandPopup}
              </code>
              <button 
                onClick={async (e) => {
                  await executeCopy(commandPopup);
                  const btn = e.currentTarget;
                  const originalText = btn.innerText;
                  btn.innerText = 'Copied!';
                  btn.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-600/30');
                  setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-600/30');
                  }, 2000);
                }}
                className="absolute top-3 right-3 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition-all border border-neutral-700"
              >
                Copy Command
              </button>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setCommandPopup(null)}
                className="px-6 py-2 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCENTIVE PAYOUT MODAL */}
      {incentiveModalReq && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-2xl max-w-sm w-full text-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Payout Approved</h3>
              <button onClick={() => setIncentiveModalReq(null)} className="text-neutral-500 hover:text-white transition text-2xl leading-none">&times;</button>
            </div>
            
            <div className="bg-white p-4 rounded-xl inline-block mb-6 relative">
              <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 -z-10 rounded-full"></div>
              <QRCodeSVG 
                value={`upi://pay?pa=${incentiveModalReq.mobileNumber.includes('@') ? incentiveModalReq.mobileNumber : `${incentiveModalReq.mobileNumber}@okicici`}&pn=${encodeURIComponent(incentiveModalReq.userName)}&am=${incentiveModalReq.amount}&cu=INR`}
                size={200}
                level="M"
              />
            </div>
            
            <div className="text-left bg-neutral-800 p-4 rounded-lg">
              <p className="text-neutral-400 text-sm mb-1">Paying user: <strong className="text-white">{incentiveModalReq.userName}</strong></p>
              <p className="text-amber-500 text-3xl font-black">₹{incentiveModalReq.amount}</p>
              <p className="text-neutral-500 text-xs mt-1">UPI: {incentiveModalReq.mobileNumber.includes('@') ? incentiveModalReq.mobileNumber : `${incentiveModalReq.mobileNumber}@okicici`}</p>
            </div>
            
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-xs text-neutral-400">Scan QR with GPay/PhonePe/Paytm on your phone to complete the transfer.</p>
              <a 
                href={`upi://pay?pa=${incentiveModalReq.mobileNumber.includes('@') ? incentiveModalReq.mobileNumber : `${incentiveModalReq.mobileNumber}@okicici`}&pn=${encodeURIComponent(incentiveModalReq.userName)}&am=${incentiveModalReq.amount}&cu=INR`}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg transition text-center"
              >
                Pay via App (Mobile)
              </a>
              <button 
                onClick={() => handleMarkIncentiveAsPaid(incentiveModalReq._id)} 
                className="w-full border border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-bold py-3 rounded-lg transition text-center"
              >
                ✅ Mark as Paid
              </button>
              <button onClick={() => setIncentiveModalReq(null)} className="text-neutral-400 hover:text-white text-sm py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
