import React, { useState, useEffect } from 'react';
import { Trophy, Star, TrendingUp, Music, Play, Calendar, Smartphone, Check, Users, Mic2, User } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function UserDashboard({ user, stats }) {
  const [mobileNumber, setMobileNumber] = useState(stats?.mobileNumber || '');
  const [isSavingMobile, setIsSavingMobile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [activeTab, setActiveTab] = useState('personal'); // personal, overall, karaoke, recordings, topRated
  const [leaderboards, setLeaderboards] = useState({ overall: [], karaoke: [], topSongs: [] });
  const [myRecordings, setMyRecordings] = useState([]);
  const [topRatedSongs, setTopRatedSongs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [incentiveAmount, setIncentiveAmount] = useState('');
  const [incentiveStatus, setIncentiveStatus] = useState(null);

  useEffect(() => {
    if (activeTab === 'overall' || activeTab === 'karaoke' || activeTab === 'topSongs') {
      const fetchLeaderboards = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/users/rankings`);
          const data = await res.json();
          if (data.success) {
            setLeaderboards({ overall: data.overall, karaoke: data.karaoke, topSongs: data.topSongs || [] });
          }
        } catch (e) {
          console.error('Failed to load leaderboards', e);
        }
        setLoading(false);
      };
      fetchLeaderboards();
    } else if (activeTab === 'recordings') {
      const fetchRecordings = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/user/recordings?userId=${user.sub}`);
          const data = await res.json();
          if (data.success) {
            setMyRecordings(data.recordings || []);
          }
        } catch (e) {
          console.error('Failed to load recordings', e);
        }
        setLoading(false);
      };
      fetchRecordings();
    } else if (activeTab === 'topRated') {
      const fetchTopRated = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/songs/top-rated`);
          const data = await res.json();
          if (data.success) {
            setTopRatedSongs(data.songs || []);
          }
        } catch (e) {
          console.error('Failed to load top rated songs', e);
        }
        setLoading(false);
      };
      fetchTopRated();
    }
  }, [activeTab, user.sub]);

  const handleRequestIncentive = async (e) => {
    e.preventDefault();
    setIncentiveStatus({ loading: true, error: null, success: false });
    
    try {
      const res = await fetch(`${API_BASE_URL}/incentive/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.sub },
        body: JSON.stringify({ amount: incentiveAmount, mobileNumber: mobileNumber })
      });
      const data = await res.json();
      
      if (data.success) {
        setIncentiveStatus({ loading: false, error: null, success: true });
        setIncentiveAmount('');
      } else {
        setIncentiveStatus({ loading: false, error: data.message, success: false });
      }
    } catch (err) {
      setIncentiveStatus({ loading: false, error: 'Network error', success: false });
    }
  };

  const handleSaveMobile = async () => {
    setIsSavingMobile(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.sub },
        body: JSON.stringify({ mobileNumber })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setIsSavingMobile(false);
  };  if (!user) return null;

  const points = stats?.total || 0;
  
  // Calculate Level
  let level = 1;
  let nextLevelPoints = 500;
  let rankName = 'Novice Singer';
  
  if (points >= 500) { level = 2; nextLevelPoints = 1500; rankName = 'Rising Star'; }
  if (points >= 1500) { level = 3; nextLevelPoints = 5000; rankName = 'Melody Master'; }
  if (points >= 5000) { level = 4; nextLevelPoints = 15000; rankName = 'Vocal Virtuoso'; }
  if (points >= 15000) { level = 5; nextLevelPoints = 50000; rankName = 'Music Legend'; }

  const progress = Math.min(100, (points / nextLevelPoints) * 100);

  const renderPersonalTab = () => (
    <div className="animate-in fade-in duration-500">
      {/* PROGRESS BAR */}
      <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-6 mb-8">
        <div className="flex justify-between text-sm text-zinc-400 font-medium mb-3">
          <span>{points.toLocaleString()} pts</span>
          <span>{nextLevelPoints.toLocaleString()} pts</span>
        </div>
        <div className="w-full h-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-500 mt-4 tracking-wide">
          {nextLevelPoints - points} points to next level
        </p>
      </div>

      {/* INCENTIVE REQUEST SECTION */}
      <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-500" />
          Redeem Points
        </h3>
        <p className="text-sm text-zinc-400 mb-4">You can request up to 50% of your total points as a GPay payout. (1 pt = ₹1)</p>
        
        <form onSubmit={handleRequestIncentive} className="flex flex-col md:flex-row items-start md:items-end gap-4">
          <div className="flex-1 w-full">
            <label className="flex justify-between items-center text-xs font-medium text-zinc-500 mb-1">
              <span>GPay Mobile Number / UPI ID</span>
              <button type="button" onClick={handleSaveMobile} disabled={isSavingMobile} className="text-amber-500 hover:text-amber-400 font-bold transition-colors">
                {isSavingMobile ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Profile'}
              </button>
            </label>
            <input 
              type="text" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="e.g. 9876543210 or user@okicici"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Points to Redeem</label>
            <input 
              type="number" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              value={incentiveAmount}
              onChange={(e) => setIncentiveAmount(e.target.value)}
              placeholder="Max 50%"
              min="1"
              max={Math.floor(points / 2)}
              required
            />
          </div>
          <button 
            type="submit"
            disabled={incentiveStatus?.loading}
            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
          >
            {incentiveStatus?.loading ? 'Requesting...' : 'Request Payout'}
          </button>
        </form>
        
        {incentiveStatus?.error && (
          <div className="mt-3 text-sm text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
            {incentiveStatus.error}
          </div>
        )}
        {incentiveStatus?.success && (
          <div className="mt-3 text-sm text-green-400 bg-green-400/10 p-2 rounded border border-green-400/20 flex items-center gap-2">
            <Check className="w-4 h-4" /> Request submitted! Admin will review soon.
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-center hover:bg-zinc-800/60 transition-colors group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="text-xl md:text-3xl font-bold text-white mb-1">{stats?.daily || 0}</div>
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-500 font-medium">Today</div>
        </div>
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-center hover:bg-zinc-800/60 transition-colors group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="text-xl md:text-3xl font-bold text-white mb-1">{stats?.weekly || 0}</div>
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-500 font-medium">This Week</div>
        </div>
        <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-center hover:bg-zinc-800/60 transition-colors group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Star className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="text-xl md:text-3xl font-bold text-white mb-1">{stats?.monthly || 0}</div>
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-500 font-medium">This Month</div>
        </div>
      </div>

    </div>
  );

  const renderOverallTab = () => (
    <div className="animate-in fade-in duration-500">
      {loading ? (
        <div className="text-center p-8 text-zinc-500">Loading leaderboard...</div>
      ) : leaderboards.overall.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-zinc-700/50 rounded-xl text-zinc-500 text-sm">
          No users on the leaderboard yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {leaderboards.overall.map((u, idx) => (
            <div key={idx} className={`bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex items-center gap-4 ${user.sub === u.userId ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-zinc-300 text-black' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {idx + 1}
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                {u.picture ? <img src={u.picture} alt={u.name} /> : <User className="w-full h-full p-2 text-zinc-500" />}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-white font-semibold truncate text-sm md:text-base">{u.name || 'Anonymous'}</div>
                {user.sub === u.userId && <div className="text-[10px] text-amber-500 uppercase tracking-widest">You</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  {u.totalPoints?.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Pts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderKaraokeTab = () => (
    <div className="animate-in fade-in duration-500">
      {loading ? (
        <div className="text-center p-8 text-zinc-500">Loading karaoke rankings...</div>
      ) : leaderboards.karaoke.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-zinc-700/50 rounded-xl text-zinc-500 text-sm">
          No karaoke recordings submitted yet. Be the first to sing!
        </div>
      ) : (
        <div className="grid gap-3">
          {leaderboards.karaoke.map((u, idx) => {
            const avg = u.karaokeCount > 0 ? Math.round(u.totalKaraokeRating / u.karaokeCount) : 0;
            return (
              <div key={idx} className={`bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex items-center gap-4 ${user.sub === u.userId ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${idx === 0 ? 'bg-pink-500 text-white' : idx === 1 ? 'bg-pink-400 text-white' : idx === 2 ? 'bg-pink-300 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                  {idx + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                  {u.picture ? <img src={u.picture} alt={u.name} /> : <User className="w-full h-full p-2 text-zinc-500" />}
                </div>
                <div className="flex-1 overflow-hidden flex flex-col justify-center">
                  <div className="text-white font-semibold truncate text-sm md:text-base">{u.name || 'Anonymous'}</div>
                  <div className="text-xs text-zinc-400 mt-1">Avg Score: <span className="text-pink-400 font-bold">{avg}</span></div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg md:text-xl font-black text-pink-500">
                    {u.totalKaraokeRating?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Cumul. Pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRecordingsTab = () => (
    <div className="animate-in fade-in duration-500">
      {loading ? (
        <div className="text-center p-8 text-zinc-500">Loading your recordings...</div>
      ) : myRecordings.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-zinc-700/50 rounded-xl text-zinc-500 text-sm">
          You haven't saved any recordings yet!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myRecordings.map((r, idx) => {
            const dateStr = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <div key={idx} className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-5 flex flex-col justify-between hover:bg-zinc-800/60 transition-colors shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 overflow-hidden pr-4">
                    <h4 className="text-white font-bold text-lg truncate">{r.songTitle}</h4>
                    <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> {dateStr}
                    </div>
                  </div>
                  {r.score && (
                    <div className="flex flex-col items-end shrink-0">
                      <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-500">
                        {r.score}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">AI Score</div>
                    </div>
                  )}
                </div>
                <div className="w-full bg-zinc-900/50 rounded-xl p-2 border border-zinc-700">
                  <audio controls src={r.url} className="w-full h-8 custom-audio-player" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTopSongsTab = () => (
    <div className="animate-in fade-in duration-500">
      {loading ? (
        <div className="text-center p-8 text-zinc-500">Loading top songs...</div>
      ) : (!leaderboards.topSongs || leaderboards.topSongs.length === 0) ? (
        <div className="text-center p-8 border border-dashed border-zinc-700/50 rounded-xl text-zinc-500 text-sm">
          No songs have been played yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {leaderboards.topSongs.map((song, idx) => (
            <div key={song.id} className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 ${idx === 0 ? 'bg-cyan-500 text-black' : idx === 1 ? 'bg-zinc-300 text-black' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  #{idx + 1}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-white font-bold text-base md:text-lg truncate flex items-center gap-2">
                    {song.title}
                    {idx === 0 && <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] uppercase tracking-wider hidden md:inline-block">Most Played</span>}
                    {song.fullListens > 0 && <span title={`${song.fullListens} full listens`} className="text-orange-500"><TrendingUp className="w-3 h-3 inline-block" /></span>}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">{song.movie}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold bg-cyan-500/10 px-3 py-1 rounded-full">
                  <Music className="w-4 h-4" />
                  {Math.round(song.totalPlaySeconds / 60)} min
                </div>
                <div className="text-[10px] text-zinc-500 font-medium">
                  {song.fullListens || 0} full plays
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTopRatedTab = () => (
    <div className="animate-in fade-in duration-500">
      {loading ? (
        <div className="text-center p-8 text-zinc-500">Loading top rated songs...</div>
      ) : topRatedSongs.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-zinc-700/50 rounded-xl text-zinc-500 text-sm">
          No songs have been rated yet!
        </div>
      ) : (
        <div className="grid gap-4">
          {topRatedSongs.map((song, idx) => (
            <div key={song.id} className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 ${idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-zinc-300 text-black' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  #{idx + 1}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-white font-bold text-base truncate">{song.title}</h4>
                  <p className="text-xs text-zinc-400 truncate">{song.movie} ({song.year})</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold bg-amber-500/10 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 fill-amber-500" />
                  {song.avgRating}
                </div>
                <div className="text-[10px] text-zinc-500 font-medium">
                  {song.ratingCount} ratings
                </div>
              </div>
              <a 
                href={`/?songId=${song.id}`}
                target="_blank"
                rel="noreferrer"
                className="ml-4 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700 hover:bg-amber-500 hover:text-black transition-colors shrink-0"
              >
                <Play className="w-4 h-4 ml-1" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto pb-12 animate-in slide-in-from-bottom-8 duration-700">
      
      {/* HEADER SECTION */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 mb-6 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <img src={user.picture} alt={user.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-amber-500/30 object-cover z-10" />
        
        <div className="flex-1 text-center md:text-left z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{user.name}</h2>
          <div className="flex items-center justify-center md:justify-start gap-2 text-amber-500 font-semibold tracking-wide text-sm md:text-base">
            <Trophy className="w-4 h-4 md:w-5 md:h-5" />
            Level {level} - {rankName}
          </div>
        </div>

        <div className="text-center md:text-right z-10 mt-2 md:mt-0">
          <div className="text-[10px] md:text-sm tracking-widest text-zinc-400 uppercase mb-1">Total Points</div>
          <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-orange-600">
            {points.toLocaleString()}
          </div>
        </div>
      </div>

      {/* MINI TABS */}
      <div className="flex items-center justify-start md:justify-center gap-2 mb-8 bg-zinc-800/40 p-1.5 rounded-full border border-zinc-700/50 overflow-x-auto hide-scrollbar w-full">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'personal' ? 'bg-amber-500 text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <User className="w-4 h-4" /> Personal
        </button>
        <button 
          onClick={() => setActiveTab('recordings')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'recordings' ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <Music className="w-4 h-4" /> My Recordings
        </button>
        <button 
          onClick={() => setActiveTab('overall')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'overall' ? 'bg-amber-500 text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <Users className="w-4 h-4" /> Global Top
        </button>
        <button 
          onClick={() => setActiveTab('karaoke')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'karaoke' ? 'bg-pink-500 text-white shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <Mic2 className="w-4 h-4" /> Karaoke Stars
        </button>
        <button 
          onClick={() => setActiveTab('topRated')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'topRated' ? 'bg-amber-500 text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <Star className="w-4 h-4" /> Top Rated
        </button>
        <button 
          onClick={() => setActiveTab('topSongs')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-all whitespace-nowrap ${activeTab === 'topSongs' ? 'bg-cyan-500 text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
        >
          <TrendingUp className="w-4 h-4" /> Global Songs
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'personal' && renderPersonalTab()}
      {activeTab === 'recordings' && renderRecordingsTab()}
      {activeTab === 'overall' && renderOverallTab()}
      {activeTab === 'karaoke' && renderKaraokeTab()}
      {activeTab === 'topRated' && renderTopRatedTab()}
      {activeTab === 'topSongs' && renderTopSongsTab()}

    </div>
  );
}
