import React, { useState } from 'react';
import { Star, Music, Heart, Share2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function ResultModal({ 
  challengeScore, 
  song, 
  user, 
  setChallengeStatus, 
  setChallengeScore, 
  handleSaveRecording 
}) {
  const [isScoring, setIsScoring] = useState(false);

  if (!challengeScore) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl shadow-purple-500/20 transform animate-in zoom-in-95">
        {challengeScore.score !== undefined ? (
          <>
            <h2 className="text-3xl font-bold text-white mb-2">You Scored</h2>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 mb-6 drop-shadow-xl">
              {challengeScore.score}<span className="text-2xl text-zinc-500">/100</span>
            </div>
            <p className="text-zinc-300 mb-8 leading-relaxed">
              "{challengeScore.feedback}"
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-2">Recording Finished!</h2>
            <p className="text-zinc-400 mb-6 text-sm">Listen to your performance or get AI feedback.</p>
            {challengeScore.audioUrl && (
              <audio src={challengeScore.audioUrl} controls className="w-full mb-6 custom-audio-player h-10" />
            )}
            <button 
              onClick={async () => {
                setIsScoring(true);
                // We no longer change challengeStatus to 'scoring' to keep the modal open
                try {
                  const res = await fetch(`${API_BASE_URL}/song/score`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      songId: song.id,
                      audioBase64: challengeScore.audioBase64,
                      userId: user ? user.sub : null,
                      userName: user ? user.name : null,
                      userPicture: user ? user.picture : null
                    })
                  });
                  const data = await res.json();
                  if (data.success) {
                    setChallengeScore({ ...challengeScore, score: data.score, feedback: data.feedback });
                  } else {
                    toast.error('Error scoring: ' + data.error);
                  }
                } catch (err) {
                  console.error("Score error:", err);
                  toast.error("Network error scoring the audio");
                } finally {
                  setIsScoring(false);
                }
              }}
              disabled={isScoring}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 mb-6"
            >
              {isScoring ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> AI is Analyzing...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5 text-yellow-300" /> Get AI Evaluation
                </>
              )}
            </button>
          </>
        )}
        
        <div className="flex flex-col gap-3">
          {challengeScore.audioUrl && (
            <div className="flex gap-2">
              <a 
                href={challengeScore.audioUrl} 
                download={`${song.title.replace(/\s+/g, '_')}_Karaoke.webm`}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Music className="w-5 h-5" /> Download
              </a>
              {user && (
                <button 
                  onClick={handleSaveRecording}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Heart className="w-5 h-5" /> Save to Profile
                </button>
              )}
            </div>
          )}
          <a 
            href={`whatsapp://send?text=I just scored ${challengeScore.score || 'awesome'}/100 singing ${encodeURIComponent(song.title)} on Uforian Music App! Try it yourself at ${encodeURIComponent(window.location.href)}`}
            className="w-full py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            target="_blank"
            rel="noreferrer"
          >
            <Share2 className="w-5 h-5" /> Share to WhatsApp
          </a>
          <button 
            onClick={() => { setChallengeStatus('idle'); setChallengeScore(null); }}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors mt-2"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
