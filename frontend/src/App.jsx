import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Music, Calendar, Share2, Heart, MessageCircle, Mic, Headphones, User, Users, LogOut, Award, Play, Star, ChevronRight, Info, Disc, Search, Trophy, Pause, FastForward, Loader2 } from 'lucide-react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import Admin from './Admin';
import UserDashboard from './UserDashboard';
import ResultModal from './components/ResultModal';
import Navbar from './components/Navbar';
import LyricsViewer from './components/LyricsViewer';
import SnippetEditorModal from './components/SnippetEditorModal';
import { parseLrc } from './utils/lyrics';
import { YIN } from 'pitchfinder';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '70a1295210854963b95b8b687eb68883';

// ============================================================================
// UFORIAN MUSIC APP - KARAOKE MODE
// ============================================================================

export default function IlayarajaApp() {
  const [song, setSong] = useState(null);
  const [todaySong, setTodaySong] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [error, setError] = useState(null);

  // Lyrics State
  const [lyrics, setLyrics] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [lyricsLanguage, setLyricsLanguage] = useState('tamil'); // 'tanglish' | 'tamil'
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lyricsContainerRef = useRef(null);
  const isCancelledRef = useRef(false);

  // Karaoke mode state
  const [mode, setMode] = useState('original'); // 'original' | 'karaoke'
  const [karaokeLoading, setKaraokeLoading] = useState(false);
  const [karaokeError, setKaraokeError] = useState(null);
  const audioRef = useRef(null);
  const [challengeStatus, setChallengeStatus] = useState('idle'); // idle | countdown | recording | result | previewing
  const [countdown, setCountdown] = useState(null);
  const [pendingSeekTime, setPendingSeekTime] = useState(null);
  const [challengeScore, setChallengeScore] = useState(null); // null, 3, 2, 1
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const spotifyControllerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const destNodeRef = useRef(null);
  const hostAudioRef = useRef(null); // reserved for future host audio element

  // Spotify Add-to-Playlist state
  const [spotifyToken, setSpotifyToken] = useState(() => localStorage.getItem('spotify_access_token'));
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(null); // playlistId being acted on

  // View State
  const [currentView, setCurrentView] = useState('today'); // 'today' | 'archive' | 'dashboard'
  const [archiveSongs, setArchiveSongs] = useState([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Play-D-List State
  const [isPlayDListActive, setIsPlayDListActive] = useState(false);
  const [playDListQueue, setPlayDListQueue] = useState([]);
  const [playDListIndex, setPlayDListIndex] = useState(0);

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const sortedArchiveSongs = useMemo(() => {
    return [...archiveSongs].sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  }, [archiveSongs]);

  const startPlayDList = async () => {
    setIsPlayDListActive(true);
    setCurrentView('today');
    setMode('original');
    
    let songsToUse = archiveSongs;
    
    if (songsToUse.length === 0) {
      setArchiveLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/song/archive`);
        const data = await res.json();
        if (data.success) {
          setArchiveSongs(data.archive);
          songsToUse = data.archive;
        }
      } catch (err) {
        console.error("Error fetching archive for Play-D-List:", err);
      } finally {
        setArchiveLoading(false);
      }
    }
    
    if (songsToUse.length > 0) {
      const shuffled = shuffleArray(songsToUse);
      setPlayDListQueue(shuffled);
      setPlayDListIndex(0);
      setSong(shuffled[0]);
    }
  };

  const playDListNext = () => {
    if (!playDListQueue.length) return;
    if (playDListIndex < playDListQueue.length - 1) {
      const nextIdx = playDListIndex + 1;
      setPlayDListIndex(nextIdx);
      setSong(playDListQueue[nextIdx]);
    } else {
      // Reshuffle for continuous random playback
      const shuffled = shuffleArray(archiveSongs);
      setPlayDListQueue(shuffled);
      setPlayDListIndex(0);
      setSong(shuffled[0]);
    }
  };

  const playDListPrev = () => {
    if (!playDListQueue.length) return;
    if (playDListIndex > 0) {
      const prevIdx = playDListIndex - 1;
      setPlayDListIndex(prevIdx);
      setSong(playDListQueue[prevIdx]);
    }
  };

  const handleSongEnded = () => {
    if (isPlayDListActive) {
      playDListNext();
    }
  };

  const restoreTodaySong = () => {
    setIsPlayDListActive(false);
    setVoiceAutoPlay(false);
    if (todaySong) {
      setSong(todaySong);
    }
    setCurrentView('today');
  };

  const [voiceAutoPlay, setVoiceAutoPlay] = useState(false);

  // Handle voice assistant song selection — fetches full song data by ID and plays it
  const handleVoicePlaySong = useCallback(async (voiceSong) => {
    try {
      const res = await fetch(`${API_BASE_URL}/song/today?songId=${voiceSong.id}`);
      const data = await res.json();
      if (data.success && data.song) {
        setIsPlayDListActive(false);
        setVoiceAutoPlay(true);
        setSong(data.song);
        setCurrentView('today');
      }
    } catch (e) {
      console.error('Voice play song failed:', e);
    }
  }, []);

  // Authentication & Gamification
  const [user, setUser] = useState(null);
  const [userStats, setUserStats] = useState(null);

  // Rating state
  const [songRating, setSongRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingStatus, setRatingStatus] = useState('');
  
  const [hasTrackedListen, setHasTrackedListen] = useState(false);
  const [singMode, setSingMode] = useState('default');
  const [customSnippet, setCustomSnippet] = useState(null);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestResults, setSuggestResults] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  
  // Track Activity Helper
  const trackActivity = async (action, overrideSongId = null) => {
    if (!user) return;
    try {
      await fetch(`${API_BASE_URL}/activity/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.sub, 
          action, 
          songId: overrideSongId || song?.id,
          userName: user.name,
          userPicture: user.picture
        })
      });
    } catch (e) { console.error('Track error', e); }
  };

  useEffect(() => {
    const cachedAuth = localStorage.getItem('userAuth');
    if (cachedAuth) {
      const parsed = JSON.parse(cachedAuth);
      if (parsed.expiry > Date.now()) {
        setUser(parsed.user);
      } else {
        localStorage.removeItem('userAuth');
      }
    }
  }, []);

  // Track daily login when user is set
  useEffect(() => {
    if (user) {
      trackActivity('login');
    }
  }, [user]);

  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    // 30 days expiry
    const authData = { user: decoded, expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) };
    localStorage.setItem('userAuth', JSON.stringify(authData));
    setUser(decoded);
  };

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('userAuth');
    setUser(null);
    setCurrentView('today');
  };

  const loadUserStats = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/stats?userId=${user.sub}`);
      const data = await res.json();
      if (data.success) {
        setUserStats(data.stats);
      }
    } catch (err) { console.error('Error loading stats', err); }
  };

  useEffect(() => {
    if (currentView === 'dashboard') {
      loadUserStats();
    }
  }, [currentView, user]);

  // Simple routing
  if (window.location.pathname === '/admin') {
    return <Admin />;
  }

  const handleShare = async () => {
    let customMsg = song?.whatsapp_share_text;
    if (!customMsg) {
      const singersStr = Array.isArray(song?.singers) ? song.singers.join(' & ') : '';
      customMsg = `🎶 Today's Maestro Teaser: A magical ${song?.movie || 'Ilaiyaraaja'} classic${singersStr ? ` sung by ${singersStr}` : ''}! Can you guess today's song? 🎧`;
    }
    // IMPORTANT: Combine text + url into a single 'text' field.
    // WhatsApp (and many mobile apps) ignores navigator.share()'s `url` field
    // and only uses `text`, so splitting them results in only the URL being shared.
    const fullShareText = `${customMsg}\n\n👉 Play now: ${window.location.href}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Uforian Music', text: fullShareText });
      } else {
        await navigator.clipboard.writeText(fullShareText);
        toast.success('Teaser copied to clipboard!');
      }
    } catch (err) { console.log('Error sharing:', err); }
  };

  const handleWhatsAppShare = async () => {
    let customMsg = song?.whatsapp_share_text;
    if (!customMsg) {
      const singersStr = Array.isArray(song?.singers) ? song.singers.join(' & ') : '';
      customMsg = `🎶 Today's Maestro Teaser: A magical ${song?.movie || 'Ilaiyaraaja'} classic${singersStr ? ` sung by ${singersStr}` : ''}! Can you guess today's song? 🎧`;
    }
    const fullText = `${customMsg}\n\n👉 Play now: ${window.location.href}`;

    // Primary: navigator.share() passes text DIRECTLY to WhatsApp with no
    // intermediary redirect — this is what makes the generic Share button work.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Uforian Music', text: fullText });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
      }
    }

    // Fallback: open wa.me link (works well on mobile)
    const encoded = encodeURIComponent(fullText);
    const opened = window.open(`https://wa.me/?text=${encoded}`, '_blank');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      await navigator.clipboard.writeText(fullText).catch(() => {});
      toast.success('Teaser copied to clipboard! Paste it into WhatsApp.');
    }
  };

  // --- Spotify OAuth — PKCE Authorization Code Flow ---
  // Step 1: On load, check if Spotify redirected back with ?code=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'spotify_auth') {
      // Exchange the code for an access token
      const verifier = sessionStorage.getItem('spotify_code_verifier');
      if (!verifier) return;

      const redirectUri = window.location.origin + '/';
      fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }).toString(),
      })
        .then(r => r.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('spotify_access_token', data.access_token);
            setSpotifyToken(data.access_token);
            sessionStorage.removeItem('spotify_code_verifier');
          }
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(err => console.error('Spotify token exchange failed:', err));
    }
  }, []);

  // PKCE helpers
  const generateCodeVerifier = () => {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const loginWithSpotify = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('spotify_code_verifier', verifier);

    const redirectUri = window.location.origin + '/';
    const scopes = 'playlist-modify-public playlist-modify-private';
    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id', SPOTIFY_CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', 'spotify_auth');
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    window.location.href = url.toString();
  };

  const fetchSpotifyPlaylists = async (token) => {
    setPlaylistLoading(true);
    try {
      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('spotify_access_token');
        setSpotifyToken(null);
        loginWithSpotify();
        return;
      }
      const data = await res.json();
      setSpotifyPlaylists(data.items || []);
    } catch (err) {
      console.error('Playlist fetch failed:', err);
    }
    setPlaylistLoading(false);
  };

  const handleOpenSpotifyModal = async () => {
    if (!song?.spotify_id) { toast.error('No Spotify ID for this song.'); return; }
    if (!spotifyToken) {
      await loginWithSpotify();
      return;
    }
    setShowPlaylistModal(true);
    await fetchSpotifyPlaylists(spotifyToken);
  };

  const handleAddToPlaylist = async (playlistId) => {
    setAddingToPlaylist(playlistId);
    try {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${spotifyToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${song.spotify_id}`] })
      });
      if (res.status === 401) {
        localStorage.removeItem('spotify_access_token');
        setSpotifyToken(null);
        setShowPlaylistModal(false);
        await loginWithSpotify();
        return;
      }
      if (res.ok) {
        setShowPlaylistModal(false);
        toast.success(`"${song.title}" added to your playlist!`);
        setShowPlaylistModal(false);
      } else {
        toast.error(`Failed: ${err.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
    setAddingToPlaylist(null);
  };

  const handleCreateAndAdd = async () => {
    setAddingToPlaylist('new');
    try {
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });
      const me = await meRes.json();

      const createRes = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${spotifyToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Uforian – Ilaiyaraaja Picks', description: 'Curated songs from the Uforian Music App', public: true })
      });
      const playlist = await createRes.json();
      await handleAddToPlaylist(playlist.id);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setAddingToPlaylist(null);
    }
  };

  const handleRateSong = async (rating) => {
    if (!user) return toast.error("Please login to rate the song!");
    setSongRating(rating);
    setRatingStatus('Submitting...');
    try {
      const res = await fetch(`${API_BASE_URL}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.sub },
        body: JSON.stringify({ songId: song.id, rating })
      });
      const data = await res.json();
      if (data.success) {
        setRatingStatus(data.pointsAwarded > 0 ? 'Thanks for rating!' : 'Rating updated!');
        if (data.pointsAwarded > 0) {
          toast.success(`You earned ${data.pointsAwarded} points for rating!`);
          loadUserStats();
        }
        setSong(s => ({ ...s, avgRating: data.avgRating, ratingCount: data.ratingCount }));
      } else {
        setRatingStatus('Failed to rate');
        toast.error(data.message || "Failed to submit rating");
      }
    } catch (err) {
      setRatingStatus('Error');
      toast.error("Network error submitting rating");
    }
  };



  // --- Fetch today's song ---
  useEffect(() => {
    const fetchSongOfDay = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const previewDate = urlParams.get('previewDate');
        const songId = urlParams.get('songId');
        
        let endpoint = `${API_BASE_URL}/song/today`;
        if (songId) {
          endpoint += `?songId=${songId}&_t=${Date.now()}`;
        } else if (previewDate) {
          endpoint += `?date=${previewDate}&_t=${Date.now()}`;
        } else {
          endpoint += `?_t=${Date.now()}`;
        }
          
        const fetchOptions = { headers: {} };
        const cachedAuth = localStorage.getItem('userAuth');
        if (cachedAuth) {
          const parsed = JSON.parse(cachedAuth);
          if (parsed.expiry > Date.now()) {
            fetchOptions.headers['x-user-id'] = parsed.user.sub;
          }
        }

        const response = await fetch(endpoint, fetchOptions);
        const data = await response.json();
        if (data.success && data.song) {
          setSong(data.song);
          setTodaySong(data.song);
          if (cachedAuth && JSON.parse(cachedAuth).user?.sub) {
            try {
              const prefRes = await fetch(`${API_BASE_URL}/user/preferences?userId=${JSON.parse(cachedAuth).user.sub}`);
              const prefData = await prefRes.json();
              if (prefData.success && prefData.preferences) {
                const pref = prefData.preferences.find(p => p.songId === data.song.id);
                if (pref && pref.karaoke_snippet_start != null && pref.karaoke_snippet_end != null) {
                  setCustomSnippet({ karaoke_snippet_start: pref.karaoke_snippet_start, karaoke_snippet_end: pref.karaoke_snippet_end });
                  setSingMode('custom');
                }
              }
            } catch (err) { console.error("Pref fetch error", err); }
          }
          if (data.userRating) {
            setSongRating(data.userRating);
            setRatingStatus('You already rated this song');
          }
        } else {
          setError("Could not load today's song.");
        }
      } catch (err) {
        console.error("Error fetching song of the day:", err);
        setError("Could not connect to the server.");
      } finally {
        setIsLoaded(true);
      }
    };
    fetchSongOfDay();
  }, []);

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
          spotifyId: spotifySong.spotify_id,
          title: spotifySong.title,
          movie: spotifySong.movie,
          year: spotifySong.year,
          previewUrl: spotifySong.preview_url,
          albumCoverUrl: spotifySong.image || spotifySong.album_cover_url
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

  const fetchArchive = useCallback(async () => {
    if (archiveSongs.length > 0) return; // Cache locally
    setArchiveLoading(true);
    try {
      const endpoint = `${API_BASE_URL}/song/archive`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        setArchiveSongs(data.archive);
      }
    } catch (err) {
      console.error("Error fetching archive:", err);
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveSongs.length]);

  useEffect(() => {
    if (currentView === 'archive') {
      fetchArchive();
    }
  }, [currentView, fetchArchive]);

  // Derived state for client-side search
  const filteredArchiveSongs = useMemo(() => {
    if (!archiveSearch.trim()) return archiveSongs;
    const lowerQ = archiveSearch.toLowerCase();
    return archiveSongs.filter(song => 
      song.title?.toLowerCase().includes(lowerQ) ||
      song.movie?.toLowerCase().includes(lowerQ) ||
      song.director?.toLowerCase().includes(lowerQ) ||
      song.year?.toString().includes(lowerQ)
    );
  }, [archiveSongs, archiveSearch]);

  const handleArchiveSearch = (e) => {
    e.preventDefault();
  };

  // --- LRC Parser ---

  // --- Fetch Lyrics (cascading search) ---
  useEffect(() => {
    if (!song) return;
    const fetchLyrics = async () => {
      try {
        let rawLrc = null;
        if (song.synced_lyrics_tamil && song.synced_lyrics_tanglish) {
          rawLrc = lyricsLanguage === 'tamil' ? song.synced_lyrics_tamil : song.synced_lyrics_tanglish;
        } else if (song.synced_lyrics_tanglish) {
          rawLrc = song.synced_lyrics_tanglish;
        } else if (song.synced_lyrics_tamil) {
          rawLrc = song.synced_lyrics_tamil;
        } else if (song.synced_lyrics) {
          rawLrc = song.synced_lyrics;
        }

        if (rawLrc) {
          console.log("Using AI-generated synced lyrics from database!");
          setLyrics(parseLrc(rawLrc));
          return;
        }

        // Also check if we have plain text lyrics stored in DB from the backfill
        let dbPlainLyrics = null;
        if (song.lyrics_tamil && song.lyrics) {
            dbPlainLyrics = lyricsLanguage === 'tamil' ? song.lyrics_tamil : song.lyrics;
        } else if (song.lyrics) {
            dbPlainLyrics = song.lyrics;
        } else if (song.lyrics_tamil) {
            dbPlainLyrics = song.lyrics_tamil;
        }

        const queries = [
          `${song.title} ${song.singers?.[0] || ''}`.trim(),
          `${song.title} ${song.movie || ''}`.trim(),
          `${song.title} ${song.director || 'Ilaiyaraaja'}`.trim(),
          song.title
        ];

        let data = [];
        let successfulQuery = '';

        for (const query of queries) {
          if (!query) continue;
          const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
          const result = await res.json();
          if (result && result.length > 0) {
            data = result;
            successfulQuery = query;
            break;
          }
        }

        console.log("LRCLIB Result for query:", successfulQuery, data?.[0]);
        if (data && data.length > 0) {
          const track = data[0];
          if (track.syncedLyrics) {
            console.log("Found synced lyrics!");
            setLyrics(parseLrc(track.syncedLyrics));
          } else if (track.plainLyrics) {
            console.log("Only plain lyrics found");
            setPlainLyrics(track.plainLyrics);
          }
        } else if (dbPlainLyrics) {
          console.log("Using DB fallback plain lyrics");
          setPlainLyrics(dbPlainLyrics);
        }
      } catch (err) {
        console.error("Lyrics fetch error:", err);
      }
    };
    fetchLyrics();
  }, [song, lyricsLanguage]);

  // --- Karaoke mode: HTML5 audio time tracking ---
  const maxPlayedTimeRef = useRef(0);
  const lastTrackedTimeRef = useRef(0);
  const accumulatedSecondsRef = useRef(0);
  const sessionPlaySecondsRef = useRef(0);
  const hasTrackedListenRef = useRef(false);

  // Reset max played time when song changes
  useEffect(() => {
    maxPlayedTimeRef.current = 0;
    setHasTrackedListen(false);
    hasTrackedListenRef.current = false;
    lastTrackedTimeRef.current = 0;
    accumulatedSecondsRef.current = 0;
    sessionPlaySecondsRef.current = 0;
  }, [song]);

  const handleSeeking = () => {
    // Only restrict seeking forward past the max played time, but allow programmatic seeks
    if (audioRef.current && audioRef.current.currentTime > maxPlayedTimeRef.current + 1) {
      audioRef.current.currentTime = maxPlayedTimeRef.current;
    }
  };

  const handleLoadedMetadata = () => {
    if (pendingSeekTime !== null && audioRef.current) {
      const seekTime = pendingSeekTime;
      setPendingSeekTime(null);
      maxPlayedTimeRef.current = Math.max(maxPlayedTimeRef.current, seekTime);
      audioRef.current.currentTime = seekTime;
      audioRef.current.play().catch(e => console.error("Playback error:", e));
            if (hostAudioRef.current && hostAudioRef.current.src) {
              hostAudioRef.current.currentTime = startTime;
              hostAudioRef.current.play().catch(e => console.error("Host playback error:", e));
            }
    }
  };

  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const ms = audioRef.current.currentTime * 1000;
      const totalDurationMs = audioRef.current.duration * 1000;
      setCurrentTimeMs(ms);

      // Prevent seeking ahead by tracking max played time
      if (audioRef.current.currentTime > maxPlayedTimeRef.current) {
        maxPlayedTimeRef.current = audioRef.current.currentTime;
      }

      // Track playback time globally
      const now = Date.now();
      if (lastTrackedTimeRef.current === 0) lastTrackedTimeRef.current = now;
      const delta = (now - lastTrackedTimeRef.current) / 1000;
      
      if (delta > 0 && delta < 2 && !audioRef.current.paused) {
        accumulatedSecondsRef.current += delta;
        sessionPlaySecondsRef.current += delta;
      }
      lastTrackedTimeRef.current = now;

      const isFull = totalDurationMs > 0 && sessionPlaySecondsRef.current > (totalDurationMs / 1000) * 0.8;

      if (accumulatedSecondsRef.current >= 15 || (isFull && !hasTrackedListenRef.current)) {
        const secondsToTrack = Math.round(accumulatedSecondsRef.current);
        const trackingFull = isFull && !hasTrackedListenRef.current;
        
        if (trackingFull) {
          setHasTrackedListen(true);
          hasTrackedListenRef.current = true;
          trackActivity('listen_full');
        }

        if (song?.id && (secondsToTrack > 0 || trackingFull)) {
          fetch(`${API_BASE_URL}/song/track-playback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              songId: song.id, 
              secondsPlayed: secondsToTrack,
              isFullListen: trackingFull
            })
          }).catch(() => {});
        }
        
        accumulatedSecondsRef.current = 0;
      }

      if ((challengeStatus === 'recording' || challengeStatus === 'previewing') && song) {
        let endMs = null;
        if (singMode === 'custom' && customSnippet) {
          endMs = customSnippet.karaoke_snippet_end;
        } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
          endMs = song.karaoke_snippet_end;
        }
        
        if (endMs && ms >= endMs) {
          // Auto stop challenge or preview
          if (challengeStatus === 'recording' && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            if (hostAudioRef.current) {
              hostAudioRef.current.pause();
              hostAudioRef.current.currentTime = 0;
            }
          }
          if (challengeStatus === 'previewing') {
            setChallengeStatus('idle');
          }
          audioRef.current.pause();
        }
      }
    }
  }, [challengeStatus, song, singMode, customSnippet]);
  // Fetch user rating when song changes
  useEffect(() => {
    setSongRating(0);
    setRatingStatus('');
    
    if (song && user) {
      const fetchRating = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/song/rating?songId=${song.id}`, {
            headers: { 'x-user-id': user.sub }
          });
          const data = await res.json();
          if (data.rating) {
            setSongRating(data.rating);
            setRatingStatus('You already rated this song');
          }
        } catch (err) {
          console.error("Error fetching song rating", err);
        }
      };
      fetchRating();
    }
  }, [song?.id, user]);


  // --- Mode toggle (Seamless S3 Audio Swap) ---
  const switchMode = (newMode) => {
    if (newMode === mode) return;
    
    // Save current playback state before switching
    const wasPlaying = !audioRef.current?.paused;
    const currentTime = audioRef.current?.currentTime || 0;
    
    setMode(newMode);
    
    if (newMode === 'karaoke') {
      if (!song.karaoke_url) {
        setKaraokeError("Karaoke track is not available for this song yet.");
      } else {
        setKaraokeError(null);
      }
    }
    
    if (newMode === 'original') {
      if (!song.original_url) {
        setKaraokeError("Original high-res track is not available yet.");
      } else {
        setKaraokeError(null);
      }
    }

    // Resume playback at exact same time if possible
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = currentTime;
        if (wasPlaying) {
          audioRef.current.play().catch(e => console.error("Playback swap error:", e));
        }
      }
    }, 50);
  };

  // --- Karaoke Challenge Logic ---
  const startChallenge = async () => {
    try {
      // 1. Request mic access first to avoid delay later
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Start Countdown
      setCountdown(3);
      let count = 3;
      
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(countdownInterval);
          setCountdown(null);          
          
          // 3. Start Recording & Playback (Mixed Audio)
          isCancelledRef.current = false;
          
          // Initialize AudioContext
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioContextRef.current = audioCtx;
          
          // Setup Microphone Source
          const micSource = audioCtx.createMediaStreamSource(stream);
          
          // Setup Audio Element Source (singleton pattern to avoid InvalidStateError)
          if (!audioSourceNodeRef.current && audioRef.current) {
            audioSourceNodeRef.current = audioCtx.createMediaElementSource(audioRef.current);
          }
          const audioSource = audioSourceNodeRef.current;
          
          // Create Mixed Destination (mic + karaoke, for the shareable recording)
          const dest = audioCtx.createMediaStreamDestination();
          destNodeRef.current = dest;
          micSource.connect(dest);
          if (audioSource) {
            audioSource.connect(dest);
            audioSource.connect(audioCtx.destination);
          }

          // Create Mic-Only Destination (pure mic, for pitch detection)
          const micOnlyDest = audioCtx.createMediaStreamDestination();
          micSource.connect(micOnlyDest);

          const mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          // Mic-only recorder for pitch extraction
          const micOnlyRecorder = new MediaRecorder(micOnlyDest.stream, { mimeType: 'audio/webm' });
          const micOnlyChunks = [];
          micOnlyRecorder.ondataavailable = (e) => { if (e.data.size > 0) micOnlyChunks.push(e.data); };

          // Calculate startTime/endTime to align pitch with the segment
          let startTime = 0;
          let endTime = null;
          if (singMode === 'custom' && customSnippet) {
            startTime = customSnippet.karaoke_snippet_start / 1000;
            endTime = customSnippet.karaoke_snippet_end / 1000;
          } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
            startTime = song.karaoke_snippet_start / 1000;
            endTime = song.karaoke_snippet_end / 1000;
          }

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            // Stop mic-only recorder too
            if (micOnlyRecorder.state !== 'inactive') micOnlyRecorder.stop();
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const micOnlyBlob = new Blob(micOnlyChunks, { type: 'audio/webm' });
            // Stop all tracks to release mic
            stream.getTracks().forEach(track => track.stop());
            
            // Clean up AudioContext to prevent memory leaks
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close().catch(e => console.error("AudioContext close error:", e));
            }
            
            if (isCancelledRef.current) {
              setChallengeStatus('idle');
              return;
            }
            
            setChallengeStatus('result'); // show loading state if pitch takes time
            
            // Yield to browser to render the "Processing" state before blocking thread
            await new Promise(r => setTimeout(r, 100));

            // 1. Extract User Pitch from MIC-ONLY audio (not the mixed recording)
            let userPitchData = [];
            try {
              // Wait for mic-only recorder to flush its last chunk
              await new Promise(resolve => {
                if (micOnlyRecorder.state === 'inactive') {
                  resolve();
                } else {
                  micOnlyRecorder.addEventListener('stop', resolve, { once: true });
                }
              });
              const micOnlyFinalBlob = new Blob(micOnlyChunks, { type: 'audio/webm' });
              const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
              const arrayBuffer = await micOnlyFinalBlob.arrayBuffer();
              const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
              
              // Use a proper 8192-sample window with 50% hop for accurate YIN pitch detection
              const WINDOW_SIZE = 8192;
              const HOP_SIZE = 4096; // 50% overlap
              const detectPitch = YIN({ sampleRate: audioBuffer.sampleRate, threshold: 0.1 });
              const channelData = audioBuffer.getChannelData(0);
              
              for (let i = 0; i + WINDOW_SIZE <= channelData.length; i += HOP_SIZE) {
                const chunk = channelData.slice(i, i + WINDOW_SIZE);
                const pitch = detectPitch(chunk);
                if (pitch && pitch > 80 && pitch < 1200) { // human voice range
                  const tSec = Number((i / audioBuffer.sampleRate).toFixed(2));
                  userPitchData.push({ t: tSec, f: Number(pitch.toFixed(2)) });
                }
              }
              decodeCtx.close();
              console.log(`[Pitch] Extracted ${userPitchData.length} user pitch points from mic-only audio`);
            } catch(e) {
              console.error("Pitch extraction failed:", e);
            }

            // 2. Fetch Reference Pitch via backend proxy (avoids CloudFront CORS)
            let referencePitchData = [];
            if (song && song.pitch_data_url) {
              try {
                const resp = await fetch(`${API_BASE_URL}/song/pitch-proxy?songId=${song.id}`);
                if (resp.ok) referencePitchData = await resp.json();
              } catch(e) { console.error('Failed to fetch ref pitch:', e); }
            }

            // 3. Extract reference pitch for the segment window, normalized to 0-based time.
            // The pitch JSON has timestamps from 0 (start of vocals.mp3 = start of original song).
            // The karaoke segment starts at startTime seconds into the song.
            // We filter to [startTime, endTime] and subtract startTime so both user and
            // reference share the same 0-based time axis.
            const segmentDuration = (endTime || 9999) - startTime;
            const segmentRefPitch = referencePitchData
              .filter(rp => rp.t >= startTime && (endTime == null || rp.t <= endTime))
              .map(rp => ({ t: Number((rp.t - startTime).toFixed(2)), f: rp.f }));

            // 4. Calculate Accuracy (both arrays now share 0-based time)
            let pitchAccuracy = 0;
            if (userPitchData.length > 0 && segmentRefPitch.length > 0) {
              let totalDeviation = 0;
              let count = 0;
              userPitchData.forEach(up => {
                 // find nearest ref pitch within 0.25s (generous window for mic latency)
                 const ref = segmentRefPitch.reduce((best, rp) => {
                   const d = Math.abs(rp.t - up.t);
                   return (!best || d < Math.abs(best.t - up.t)) ? rp : best;
                 }, null);
                 if (ref && Math.abs(ref.t - up.t) <= 0.25) {
                     const refMidi = 69 + 12 * Math.log2(ref.f / 440);
                     const userMidi = 69 + 12 * Math.log2(up.f / 440);
                     let centsDiff = Math.abs(refMidi - userMidi) * 100;
                     // allow octave errors (e.g. female singing male song)
                     centsDiff = centsDiff % 1200; 
                     if (centsDiff > 600) centsDiff = 1200 - centsDiff; 
                     
                     totalDeviation += centsDiff;
                     count++;
                 }
              });
              
              if (count > 0) {
                  const avgCents = totalDeviation / count;
                  // Musical scoring curve:
                  // 0 cents deviation   → 100%  (perfect)
                  // 50 cents deviation  → ~80%  (very good)
                  // 100 cents (1 note)  → ~61%  (decent)
                  // 200 cents (2 notes) → ~37%  (off-key)
                  // 300+ cents          → ~10%  (poor)
                  // Uses exponential decay so partial credit is always given
                  pitchAccuracy = Math.round(100 * Math.exp(-avgCents / 200));
                  pitchAccuracy = Math.max(1, Math.min(100, pitchAccuracy));
              }
              console.log(`[Pitch] Matched ${count}/${userPitchData.length} user points. Avg deviation: ${count > 0 ? Math.round(totalDeviation/count) : 0} cents. Accuracy: ${pitchAccuracy}%`);
            }

            // Don't auto-score. Just store the base64 and show the result screen.
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64data = reader.result.split(',')[1];
              const audioUrl = URL.createObjectURL(audioBlob);
              console.log(`[Pitch] Segment ref: ${segmentRefPitch.length} points. User: ${userPitchData.length} points. Accuracy: ${pitchAccuracy}%`);
              setChallengeScore({ 
                audioBase64: base64data, 
                audioUrl, 
                userPitchData, 
                referencePitchData: segmentRefPitch, 
                pitchAccuracy 
              });
            };
          };

          mediaRecorder.start();
          micOnlyRecorder.start(); // capture mic-only stream for pitch analysis
          setChallengeStatus('recording');
          
          // Seek and Play audio (if src hasn't changed, do it immediately)
          if (audioRef.current) {
            maxPlayedTimeRef.current = Math.max(maxPlayedTimeRef.current, startTime);
            audioRef.current.currentTime = startTime;
            audioRef.current.play().catch(e => console.error("Playback error:", e));
          }
        }
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Microphone access is required for the challenge!");
      setChallengeStatus('idle');
      setCountdown(null);
    }
  };

  const stopChallenge = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const cancelChallenge = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
            if (hostAudioRef.current) {
              hostAudioRef.current.pause();
              hostAudioRef.current.currentTime = 0;
            }
    }
    setChallengeStatus('idle');
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleSaveRecording = async () => {
    if (!user || !challengeScore?.audioBase64) return;
    try {
      const res = await fetch(`${API_BASE_URL}/song/recording/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.sub, songId: song.id, audioBase64: challengeScore.audioBase64, score: challengeScore.score || 0 })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Recording saved to your profile!');
        trackActivity('karaoke_record'); // Reward points only on save
      } else {
        toast.error('Failed to save recording: ' + data.error);
      }
    } catch (err) { console.error('Save error', err); }
  };

  const previewKaraokeSegment = () => {
    let startTime = 0;
    if (singMode === 'custom' && customSnippet) {
      startTime = customSnippet.karaoke_snippet_start / 1000;
    } else if (singMode === 'default' && song.karaoke_snippet_start != null) {
      startTime = song.karaoke_snippet_start / 1000;
    }
    setChallengeStatus('previewing');
    
    // Check if the source is going to change from karaoke_url to original_url
    // previewing ALWAYS uses original_url
    const targetSrc = song.original_url;
    const currentSrc = audioRef.current ? audioRef.current.src : '';
    const isSrcChanging = !currentSrc.includes(targetSrc);

    if (!isSrcChanging && audioRef.current && audioRef.current.readyState >= 1) {
      // Audio is already loaded and src isn't changing, seek and play immediately
      maxPlayedTimeRef.current = Math.max(maxPlayedTimeRef.current, startTime);
      audioRef.current.currentTime = startTime;
      audioRef.current.play().catch(e => console.error("Playback error:", e));
      if (hostAudioRef.current && hostAudioRef.current.src) {
        hostAudioRef.current.currentTime = startTime;
        hostAudioRef.current.play().catch(e => console.error("Host playback error:", e));
      }
    } else {
      // Wait for metadata to load on the new source
      setPendingSeekTime(startTime);
    }
  };

  // --- Auto-Scrolling Logic ---
  const LYRIC_OFFSET_MS = 500; // highlight lyrics half a second early for better readability
  const activeLyricIndex = lyrics.reduce((acc, curr, index) => {
    const customOffset = song?.lyrics_offset_ms ? Number(song.lyrics_offset_ms) : 0;
    return (currentTimeMs + LYRIC_OFFSET_MS - customOffset) >= curr.timeMs ? index : acc;
  }, -1);

  useEffect(() => {
    if (activeLyricIndex !== -1 && lyricsContainerRef.current) {
      // Small timeout allows DOM layout to recalculate if lyrics wrap differently
      const timer = setTimeout(() => {
        if (lyricsContainerRef.current) {
          const activeEl = lyricsContainerRef.current.children[activeLyricIndex];
          if (activeEl) {
            const container = lyricsContainerRef.current;
            const scrollPos = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
            container.scrollTo({ top: scrollPos, behavior: 'smooth' });
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeLyricIndex, lyricsLanguage]);

  if (error) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 font-medium tracking-widest uppercase text-sm">{error}</div>
      </div>
    );
  }

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
    <div className="relative min-h-screen w-full bg-black overflow-x-hidden font-sans text-white pb-24 lg:pb-0">
      <Toaster 
        position="bottom-center"
        toastOptions={{
          style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' }
        }} 
      />
      {new URLSearchParams(window.location.search).get('previewDate') && (
        <div className="relative z-50 w-full bg-amber-500 text-black text-center py-1.5 font-bold text-sm tracking-widest uppercase shadow-lg shadow-amber-500/20">
          Admin Preview Mode: {new URLSearchParams(window.location.search).get('previewDate')}
        </div>
      )}

      {/* --- BACKGROUND EFFECTS --- */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-15"
        style={{ backgroundImage: "url('/raja-background-image.jpg')", backgroundAttachment: "fixed" }}
      />
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[120vw] h-[120vw] lg:w-[70vw] lg:h-[70vw] rounded-full blur-[100px] lg:blur-[120px] transition-colors duration-700 ${mode === 'karaoke' ? 'bg-purple-900/25' : 'bg-amber-900/20'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[100vw] h-[100vw] lg:w-[60vw] lg:h-[60vw] rounded-full blur-[120px] lg:blur-[150px] transition-colors duration-700 ${mode === 'karaoke' ? 'bg-pink-900/15' : 'bg-orange-900/10'}`} />
        <div className="absolute top-[30%] left-[20%] w-[80vw] h-[80vw] lg:w-[40vw] lg:h-[40vw] rounded-full bg-zinc-800/30 blur-[80px] mix-blend-screen" />
      </div>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none z-0" />

      {/* --- NAVBAR --- */}
      <Navbar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        handleLogout={handleLogout}
        handleLoginSuccess={handleLoginSuccess}
        setShowSuggestModal={setShowSuggestModal}
        startPlayDList={startPlayDList}
        isPlayDListActive={isPlayDListActive}
        restoreTodaySong={restoreTodaySong}
        onVoicePlaySong={handleVoicePlaySong}
      /> 

      {/* --- MAIN CONTENT --- */}
      {currentView === 'today' ? (
        <main className="relative z-10 w-full min-h-[calc(100vh-88px)] flex flex-col lg:flex-row items-center justify-center px-6 lg:px-24 py-6 lg:py-0 gap-10 lg:gap-24">

        {/* LEFT: Typography & Info */}
        <div className={`w-full lg:flex-1 flex flex-col justify-center max-w-2xl transition-all duration-1000 delay-300 transform ${
          isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
        }`}>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 mb-6 lg:mb-8 backdrop-blur-md w-max">
            <span className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full animate-pulse ${mode === 'karaoke' ? 'bg-purple-400' : 'bg-amber-500'}`} />
            <span className="text-[10px] lg:text-xs font-semibold uppercase tracking-widest text-zinc-300">
              {mode === 'karaoke' ? '🎤 Karaoke Mode' : 'Song of the Day'}
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-tight break-words">
            {song.title}
          </h2>

          <div className="flex flex-row flex-wrap gap-4 lg:gap-6 mb-8 lg:mb-12 text-zinc-400">
            <div className="flex items-center gap-3">
              <div className="p-1.5 lg:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <Music className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] lg:text-xs uppercase tracking-wider font-semibold text-zinc-500">Film</p>
                <p className="text-sm lg:text-lg font-medium text-zinc-200">
                  {song.movie} {song.raga && song.raga !== 'Unknown' && song.raga !== 'Western/Folk' ? `| Raga: ${song.raga}` : ''}
                </p>
              </div>
            </div>
            <div className="w-px h-10 lg:h-12 bg-zinc-800" />
            <div className="flex items-center gap-3">
              <div className="p-1.5 lg:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <Music className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] lg:text-xs uppercase tracking-wider font-semibold text-zinc-500">Director</p>
                <p className="text-sm lg:text-lg font-medium text-zinc-200">{song.director || 'Unknown'}</p>
              </div>
            </div>
            <div className="w-px h-10 lg:h-12 bg-zinc-800" />
            <div className="flex items-center gap-3">
              <div className="p-1.5 lg:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] lg:text-xs uppercase tracking-wider font-semibold text-zinc-500">Released</p>
                <p className="text-sm lg:text-lg font-medium text-zinc-200">{song.year}</p>
              </div>
            </div>
          </div>

          {/* Song Rating Component */}
          <div className="mb-8 lg:mb-12 w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 lg:p-6 backdrop-blur-md shadow-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-sm lg:text-base font-bold text-zinc-200 uppercase tracking-wider">Rate this Song</h3>
              {song.avgRating ? (
                <div className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-inner">
                  <Star className="w-3.5 h-3.5 fill-amber-500" /> {song.avgRating} <span className="text-amber-500/70 ml-0.5">({song.ratingCount})</span>
                </div>
              ) : (
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">No ratings yet</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-0.5 lg:gap-1 w-full relative z-10" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRateSong(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  disabled={ratingStatus === 'Submitting...'}
                  className="p-1 hover:scale-125 transition-all duration-300 disabled:opacity-50"
                  title={`Rate ${star} stars`}
                >
                  <Star 
                    className={`w-5 h-5 lg:w-7 lg:h-7 transition-colors duration-300 ${
                      (hoverRating || songRating) >= star 
                        ? 'fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                        : 'text-zinc-700 hover:text-zinc-500'
                    }`} 
                  />
                </button>
              ))}
            </div>
            {ratingStatus && (
              <p className={`text-xs mt-4 font-semibold text-center animate-in fade-in slide-in-from-bottom-1 ${ratingStatus.includes('Thanks') || ratingStatus.includes('Submitting') ? 'text-amber-400' : 'text-red-400'}`}>
                {ratingStatus}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 lg:gap-4 flex-wrap w-full">
            <button
              onClick={() => setIsFavorited(!isFavorited)}
              className="flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-zinc-900/80 border border-zinc-700 hover:bg-zinc-800 transition-colors group"
            >
              <Heart className={`w-5 h-5 lg:w-6 lg:h-6 transition-all ${isFavorited ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-400 group-hover:text-white'}`} />
            </button>
            <button onClick={handleShare} className="flex-1 lg:flex-none flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-8 py-3.5 lg:py-4 rounded-full bg-zinc-100 hover:bg-white text-black font-semibold transition-all active:scale-95 text-sm lg:text-base">
              <Share2 className="w-4 h-4 lg:w-5 lg:h-5" />
              Share
            </button>
            <button onClick={handleWhatsAppShare} className="flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-green-500 hover:bg-green-400 transition-colors group" title="Share to WhatsApp">
              <MessageCircle className="w-5 h-5 lg:w-6 lg:h-6 text-white group-hover:scale-110 transition-transform" />
            </button>
            {/* Spotify Save button */}
            {song.spotify_id && (
              <button
                onClick={handleOpenSpotifyModal}
                title="Save to Spotify Playlist"
                className="flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] transition-colors group active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 lg:w-6 lg:h-6 fill-black group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.949-.583-.1-.422.16-.851.583-.949 4.911-1.12 9.127-.638 12.509 1.43.38.25.49.721.28 1.098zm1.47-3.27c-.301.47-.94.621-1.41.321-3.46-2.129-8.729-2.748-12.818-1.503-.53.161-1.09-.139-1.25-.67-.16-.531.139-1.09.67-1.25 4.67-1.419 10.479-.73 14.449 1.71.47.301.621.939.359 1.392zm.129-3.403c-4.149-2.468-10.999-2.695-14.958-1.49-.638.194-1.31-.17-1.503-.807-.193-.638.17-1.31.807-1.503 4.55-1.381 12.12-1.11 16.9 1.721.573.34.76 1.08.42 1.65-.34.573-1.08.76-1.65.42z"/>
                </svg>
              </button>
            )}
          </div>


          {song.gemini_trivia && (
            <div className="mt-8 lg:mt-10 p-5 lg:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl">
              <h3 className="text-amber-500 text-[10px] lg:text-sm font-bold uppercase tracking-widest mb-2 lg:mb-3">Behind the Music</h3>
              <p className="text-zinc-300 text-sm lg:text-base leading-relaxed opacity-90 font-light">
                {song.gemini_trivia}
              </p>
            </div>
          )}

        </div>

        {/* RIGHT: Player + Lyrics */}
        <div className={`w-full lg:flex-1 max-w-md lg:max-w-lg transition-all duration-1000 delay-500 transform flex flex-col gap-6 ${
          isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
        }`}>

          {/* MODE TOGGLE: Original / Karaoke */}
          <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-2xl p-1 gap-1">
            <button
              onClick={() => switchMode('original')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                mode === 'original'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Headphones className="w-4 h-4" />
              Original
            </button>
            {song.karaoke_enabled !== false && (
              <button
                onClick={() => switchMode('karaoke')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                  mode === 'karaoke'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Mic className="w-4 h-4" />
                Karaoke
              </button>
            )}
          </div>

          {/* PLAYER */}
          <div className="relative p-1.5 lg:p-2 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden group flex-shrink-0">
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br ${
              mode === 'karaoke' ? 'from-purple-500/10 to-pink-500/5' : 'from-amber-500/10 to-orange-500/5'
            }`} />

            {/* Unified Audio Player */}
            <div className="rounded-2xl overflow-hidden relative z-10 bg-zinc-950 min-h-[200px] flex flex-col items-center justify-center p-8 gap-6">
              {karaokeError ? (
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    mode === 'karaoke' ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-amber-900/30 border border-amber-700/50'
                  }`}>
                    <Mic className={`w-8 h-8 animate-pulse ${
                      mode === 'karaoke' ? 'text-purple-400' : 'text-amber-400'
                    }`} />
                  </div>
                  <p className="text-zinc-400 text-sm text-center leading-relaxed max-w-xs">{karaokeError}</p>
                  <p className="text-zinc-600 text-xs mt-2">Run the pipeline via Admin to generate the S3 audio tracks.</p>
                </div>
              ) : (mode === 'original' && !song.original_url) || (mode === 'karaoke' && !song.karaoke_url) ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-900/30 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4">
                    <Music className="w-8 h-8 text-zinc-500" />
                  </div>
                  <p className="text-zinc-400 text-sm">Audio track not available.</p>
                </div>
              ) : (
                <div className="w-full relative">
                  <div className="flex items-center gap-4 mb-6 px-2">
                    <div className={`w-14 h-14 rounded-lg shadow-xl shadow-black/50 flex items-center justify-center border border-white/10 ${mode === 'karaoke' ? 'bg-gradient-to-br from-purple-600 to-indigo-900' : 'bg-gradient-to-br from-amber-500 to-orange-800'}`}>
                      <Music className="w-7 h-7 text-white/80" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-base">{song.title}</p>
                      <p className={`text-xs mt-0.5 ${mode === 'karaoke' ? 'text-purple-400' : 'text-amber-500'}`}>
                        {mode === 'karaoke' ? 'Instrumental • AI Vocal Separated' : 'Original Mix • High-Res S3'}
                      </p>
                    </div>
                  </div>
                  
                  {isPlayDListActive && (
                    <div className="mb-4 bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Play-D-List • Random Sequence
                        <span className="text-emerald-400/60 font-normal ml-1">
                          ({playDListIndex + 1} of {playDListQueue.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={playDListPrev}
                          disabled={playDListIndex === 0}
                          className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-emerald-100 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Previous
                        </button>
                        <button 
                          onClick={playDListNext}
                          className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-emerald-100 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          Next Song <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button 
                          onClick={restoreTodaySong}
                          className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-white transition-colors"
                          title="Stop Play-D-List"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    src={(mode === 'karaoke' && challengeStatus !== 'previewing') ? song.karaoke_url : song.original_url}
                    controls
                    autoPlay={mode === 'original'}
                    onEnded={handleSongEnded}
                    onTimeUpdate={handleAudioTimeUpdate}
                    onSeeking={handleSeeking}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full rounded-xl custom-audio-player"
                    style={{
                      filter: mode === 'karaoke' 
                        ? 'hue-rotate(270deg) brightness(0.9) contrast(1.2)' 
                        : 'sepia(0.5) hue-rotate(-30deg) brightness(0.95)',
                      borderRadius: '12px',
                    }}
                  />
                  {mode === 'karaoke' ? (
                    <div className="mt-4 flex flex-col items-center">
                      {countdown !== null && (
                        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
                          <span className="text-6xl font-black text-purple-500 animate-pulse">{countdown}</span>
                          <span className="text-white mt-4 font-bold tracking-widest uppercase">Get Ready!</span>
                        </div>
                      )}
                      
                      {challengeStatus === 'idle' && (
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
                      )}

                      {challengeStatus === 'previewing' && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                            <Headphones className="w-4 h-4" /> Previewing Segment...
                          </div>
                          <button onClick={() => { setChallengeStatus('idle'); audioRef.current?.pause(); }} className="text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 rounded-full transition-colors border border-zinc-700">
                            Stop Preview
                          </button>
                        </div>
                      )}
                      {challengeStatus === 'recording' && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-2 text-red-500 font-bold animate-pulse">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span> Recording Challenge...
                          </div>
                          <div className="flex gap-4">
                            <button onClick={stopChallenge} className="text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 rounded-full transition-colors border border-zinc-700">Finish & Score</button>
                            <button onClick={cancelChallenge} className="text-sm font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-1.5 rounded-full transition-colors border border-red-500/20">Cancel</button>
                          </div>
                        </div>
                      )}
                      {challengeStatus === 'result' && !challengeScore && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                            <Loader2 className="w-5 h-5 animate-spin" /> Processing your vocals...
                          </div>
                        </div>
                      )}
                      {challengeStatus === 'scoring' && (
                        <div className="flex items-center gap-2 text-purple-400 font-medium animate-pulse">
                          <Star className="w-4 h-4" /> AI Judge is analyzing your performance...
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-xs mt-4 font-medium tracking-wider uppercase text-amber-500/70">
                      🎤 Sing along with the lyrics below
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* LYRICS CONTAINER */}
          <LyricsViewer 
            mode={mode} 
            lyrics={lyrics} 
            plainLyrics={plainLyrics}
            activeLyricIndex={activeLyricIndex}
            lyricsContainerRef={lyricsContainerRef}
            hasDualLyrics={!!(song?.synced_lyrics_tamil && song?.synced_lyrics_tanglish)}
            lyricsLanguage={lyricsLanguage}
            setLyricsLanguage={setLyricsLanguage}
          />
        </div>
        </main>
      ) : currentView === 'dashboard' ? (
        <main className="relative z-10 w-full min-h-[calc(100vh-88px)] px-6 lg:px-24 py-8 overflow-y-auto custom-scrollbar">
          <UserDashboard user={user} stats={userStats} />
        </main>
      ) : currentView === 'archive' ? (
        <main className="relative z-10 w-full min-h-[calc(100vh-88px)] px-6 lg:px-24 py-8 overflow-y-auto custom-scrollbar">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-zinc-800 pb-4 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-amber-500" /> Archive
          </h2>
          <div className="w-full max-w-4xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
              <h2 className="text-3xl font-bold text-white tracking-tight">Archive</h2>
              <form onSubmit={handleArchiveSearch} className="w-full sm:w-auto flex items-center bg-zinc-900/80 border border-zinc-700/50 rounded-full px-4 py-2">
                <input
                  type="text"
                  placeholder="Search movie, year, title..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full sm:w-64"
                />
                <button type="submit" className="ml-2 text-zinc-400 hover:text-amber-500">
                  Search
                </button>
              </form>
            </div>
            
            {archiveLoading ? (
              <div className="text-center text-zinc-500 mt-20 animate-pulse">Loading archive...</div>
            ) : filteredArchiveSongs.length === 0 ? (
              <div className="text-center text-zinc-500 mt-20">No songs found in the archive.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArchiveSongs.map((archivedSong, idx) => (
                  <div key={idx} onClick={() => { setVoiceAutoPlay(false); setSong(archivedSong); setCurrentView('today'); setMode('original'); }} className="group bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:bg-zinc-800/80 hover:border-zinc-600 transition-all shadow-xl">
                    <div className="p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        <span>{new Date(archivedSong.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-colors">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-100 group-hover:text-amber-400 transition-colors leading-tight line-clamp-2">
                        {archivedSong.title}
                      </h3>
                      <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {archivedSong.movie} ({archivedSong.year}) {archivedSong.raga && archivedSong.raga !== 'Unknown' && archivedSong.raga !== 'Western/Folk' ? `| Raga: ${archivedSong.raga}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : null}      {/* RESULT MODAL */}
      {challengeStatus === 'result' && (
        <ResultModal 
          challengeScore={challengeScore}
          song={song}
          user={user}
          setChallengeStatus={setChallengeStatus}
          setChallengeScore={setChallengeScore}
          handleSaveRecording={handleSaveRecording}
        />
      )}

      {/* Custom Snippet Modal */}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                <div key={s.spotify_id} className="flex items-center gap-4 bg-neutral-800 p-3 rounded-xl border border-neutral-700 hover:border-neutral-500 transition-colors">
                  <img src={s.album_cover_url || s.image} className="w-12 h-12 rounded bg-neutral-900" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{s.title}</h4>
                    <p className="text-xs text-neutral-400 truncate">{s.movie} ({s.year})</p>
                  </div>
                  {s.isDuplicate ? (
                    <span className="px-3 py-1 bg-neutral-800 text-neutral-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-neutral-700">Already Added</span>
                  ) : (
                    <button onClick={() => handleSuggestSubmit(s)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors">
                      Suggest
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SPOTIFY PLAYLIST PICKER MODAL */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.949-.583-.1-.422.16-.851.583-.949 4.911-1.12 9.127-.638 12.509 1.43.38.25.49.721.28 1.098zm1.47-3.27c-.301.47-.94.621-1.41.321-3.46-2.129-8.729-2.748-12.818-1.503-.53.161-1.09-.139-1.25-.67-.16-.531.139-1.09.67-1.25 4.67-1.419 10.479-.73 14.449 1.71.47.301.621.939.359 1.392zm.129-3.403c-4.149-2.468-10.999-2.695-14.958-1.49-.638.194-1.31-.17-1.503-.807-.193-.638.17-1.31.807-1.503 4.55-1.381 12.12-1.11 16.9 1.721.573.34.76 1.08.42 1.65-.34.573-1.08.76-1.65.42z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">Save to Spotify</h2>
                  <p className="text-xs text-zinc-500 truncate max-w-[240px]">
                    {song?.title} — {song?.movie} {song?.raga ? `(Raga: ${song.raga})` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPlaylistModal(false)} className="text-zinc-500 hover:text-white text-2xl leading-none transition-colors">&times;</button>
            </div>

            {/* Playlist List */}
            <div className="overflow-y-auto flex-1">
              {playlistLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 text-sm">Loading your playlists...</p>
                  </div>
                </div>
              ) : spotifyPlaylists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <p className="text-zinc-400 text-sm mb-2">No playlists found.</p>
                  <p className="text-zinc-600 text-xs">Create one below to get started!</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {spotifyPlaylists.map(playlist => (
                    <button
                      key={playlist.id}
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      disabled={!!addingToPlaylist}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-900 transition-colors text-left group disabled:opacity-50"
                    >
                      {/* Playlist cover art */}
                      <div className="w-11 h-11 rounded-md flex-shrink-0 overflow-hidden bg-zinc-800">
                        {playlist.images?.[0]?.url ? (
                          <img src={playlist.images[0].url} alt={playlist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-zinc-600"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate group-hover:text-[#1DB954] transition-colors">{playlist.name}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{playlist.tracks?.total ?? 0} songs</p>
                      </div>
                      {addingToPlaylist === playlist.id ? (
                        <div className="w-4 h-4 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <span className="text-zinc-700 group-hover:text-[#1DB954] transition-colors text-lg flex-shrink-0">+</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: Create New Playlist */}
            <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950">
              <button
                onClick={handleCreateAndAdd}
                disabled={!!addingToPlaylist}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-bold rounded-xl transition-colors text-sm"
              >
                {addingToPlaylist === 'new' ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-lg">+</span>
                    Create "Uforian – Ilaiyaraaja Picks" & Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
