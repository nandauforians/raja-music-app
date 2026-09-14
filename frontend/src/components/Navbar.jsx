import React from 'react';
import { LogOut, User } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import VoiceAssistant from './VoiceAssistant';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  user, 
  handleLogout, 
  handleLoginSuccess,
  setShowSuggestModal,
  startPlayDList,
  isPlayDListActive,
  restoreTodaySong,
  onVoicePlaySong,
}) {
  return (
    <nav className="relative z-20 w-full flex flex-wrap items-center justify-between px-4 lg:px-12 py-4 lg:py-6 bg-transparent border-b border-zinc-800/50 gap-y-4">
      
      {/* 1. Left (Mic + Logo) - Order 1 */}
      <div className="flex items-center gap-3 lg:gap-4 order-1">
        <div className="relative z-50">
          <VoiceAssistant onPlaySong={onVoicePlaySong} />
        </div>
        <div className="text-xl lg:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 cursor-pointer" onClick={() => restoreTodaySong ? restoreTodaySong() : setCurrentView('today')}>
          Ilayaraja<span className="text-white">.daily</span>
        </div>
      </div>

      {/* 2. Right (Date, Profile, Admin) - Order 2 on mobile, Order 3 on desktop */}
      <div className="flex items-center gap-3 order-2 lg:order-3">
        <div className="hidden lg:block text-zinc-500 text-xs tracking-widest uppercase font-medium mr-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 shrink-0">
              {user.picture ? <img src={user.picture} alt="Profile" /> : <User className="w-4 h-4 text-zinc-400" />}
            </div>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative group flex items-center">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => console.error('Login Failed')}
              type="icon"
              theme="filled_black"
              shape="circle"
            />
            {/* Login Benefits Tooltip */}
            <div className="absolute right-0 top-full mt-4 w-72 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-5 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 transform translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 right-4 w-4 h-4 bg-zinc-900/95 border-t border-l border-zinc-700/50 transform rotate-45"></div>
              <h4 className="text-white font-bold mb-2">Unlock Rewards!</h4>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">Log in to earn points and track your progress on the leaderboard.</p>
              <ul className="text-xs text-zinc-300 space-y-3">
                <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> <div><b className="text-emerald-400">50 pts</b> Daily Login</div></li>
                <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-blue-500"></span> <div><b className="text-blue-400">250 pts</b> Listen Full Song</div></li>
                <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-green-500"></span> <div><b className="text-green-400">250 pts</b> Add to Spotify</div></li>
                <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-purple-500"></span> <div><b className="text-purple-400">500 pts</b> Record Karaoke</div></li>
              </ul>
            </div>
          </div>
        )}

        <a href="/admin" className="w-7 h-7 lg:w-8 lg:h-8 shrink-0 rounded-full bg-zinc-800/50 flex items-center justify-center text-[10px] lg:text-xs text-zinc-600 hover:text-white transition-colors" title="Admin">A</a>
      </div>

      {/* 3. Navigation Links - Bottom row on mobile (w-full), Middle on desktop (w-auto) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide order-3 lg:order-2 w-full lg:w-auto pb-1 lg:pb-0">
        <button 
          onClick={() => setCurrentView('archive')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-colors ${currentView === 'archive' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>
          Archive
        </button>

        <button 
          onClick={startPlayDList}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold flex items-center gap-1.5 transition-all ${
            isPlayDListActive 
              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-black shadow-[0_0_15px_rgba(52,211,153,0.5)] scale-105' 
              : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
          }`}>
          <span>▶</span> Play-D-List
        </button>
        
        {user && (
          <>
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>
              Dashboard
            </button>
            <button 
              onClick={() => setShowSuggestModal(true)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-colors text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 flex items-center gap-1">
              💡 Suggest
            </button>
          </>
        )}
      </div>

    </nav>
  );
}
