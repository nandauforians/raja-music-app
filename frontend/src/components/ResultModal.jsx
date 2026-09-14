import React, { useState } from 'react';
import { Star, Music, Heart, Share2, Loader2, BarChart2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

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
  const [isConverting, setIsConverting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!challengeScore) return null;

  const handleDownload = async () => {
    if (!challengeScore.audioBase64) {
      toast.error('No audio found to convert.');
      return;
    }
    
    setIsConverting(true);
    const toastId = toast.loading('Converting to MP3 (this may take a few seconds)...');
    try {
      const res = await fetch(`${API_BASE_URL}/song/convert-to-mp3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: challengeScore.audioBase64 })
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        toast.success('Conversion successful!', { id: toastId });
        // Create an invisible anchor to trigger download
        const a = document.createElement('a');
        a.href = data.audioBase64;
        a.download = `${song.title.replace(/\s+/g, '_')}_Karaoke.mp3`;
        a.click();
      } else {
        toast.error('Conversion failed: ' + (data.error || 'Unknown error'), { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during conversion.', { id: toastId });
    } finally {
      setIsConverting(false);
    }
  };

  // Prepare chart data using evenly-spaced 100ms time buckets
  const chartData = [];
  if (challengeScore.userPitchData?.length > 0 || challengeScore.referencePitchData?.length > 0) {
    const refData = challengeScore.referencePitchData || [];
    const userData = challengeScore.userPitchData || [];
    const segEnd = refData.length > 0 ? refData[refData.length - 1].t : 
                   (userData.length > 0 ? userData[userData.length - 1].t : 0);
    const BUCKET = 0.1; // 100ms buckets for a clean uniform x-axis
    const numBuckets = Math.ceil(segEnd / BUCKET) + 1;

    for (let i = 0; i < numBuckets; i++) {
      const t = Number((i * BUCKET).toFixed(2));
      const entry = { time: t };

      // Find nearest reference pitch within one bucket
      const nearestRef = refData.reduce((best, rp) => {
        const d = Math.abs(rp.t - t);
        return (!best || d < Math.abs(best.t - t)) ? rp : best;
      }, null);
      if (nearestRef && Math.abs(nearestRef.t - t) <= BUCKET) {
        entry.reference = Math.round(69 + 12 * Math.log2(nearestRef.f / 440));
      }

      // Find nearest user pitch within one bucket
      const nearestUser = userData.reduce((best, up) => {
        const d = Math.abs(up.t - t);
        return (!best || d < Math.abs(best.t - t)) ? up : best;
      }, null);
      if (nearestUser && Math.abs(nearestUser.t - t) <= BUCKET) {
        let uMidi = Math.round(69 + 12 * Math.log2(nearestUser.f / 440));
        // Octave correction relative to reference
        if (entry.reference) {
          const diff = entry.reference - uMidi;
          if (Math.abs(diff) > 6) uMidi += Math.round(diff / 12) * 12;
        }
        entry.user = uMidi;
      }

      chartData.push(entry);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-6 md:p-8 max-w-2xl w-full text-center shadow-2xl shadow-purple-500/20 transform animate-in zoom-in-95 my-8">
        {challengeScore.score !== undefined ? (
          <>
            <h2 className="text-3xl font-bold text-white mb-2">You Scored</h2>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 mb-2 drop-shadow-xl">
              {challengeScore.score}<span className="text-2xl text-zinc-500">/100</span>
            </div>
            
            <p className="text-zinc-300 mb-6 leading-relaxed text-lg">
              "{challengeScore.brief_summary || challengeScore.feedback}"
            </p>

            {chartData.length > 0 && (
              <div className="w-full h-48 mb-6 bg-black/40 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span className="text-zinc-500">Pitch Graph</span>
                    <span className="text-zinc-600 mx-1">·</span>
                    <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" /><span className="text-blue-400">Original</span>
                    <span className="text-zinc-600 mx-1">·</span>
                    <span className="inline-block w-3 h-0.5 bg-orange-400 rounded" /><span className="text-orange-400">You</span>
                  </h3>
                  <span className={`text-lg font-black tabular-nums ${
                    (challengeScore.pitchAccuracy || 0) >= 70 ? 'text-emerald-400' :
                    (challengeScore.pitchAccuracy || 0) >= 40 ? 'text-yellow-400' : 'text-rose-400'
                  }`}>
                    {challengeScore.pitchAccuracy ?? '–'}% <span className="text-xs font-normal text-zinc-500">pitch</span>
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <XAxis 
                      dataKey="time" 
                      type="number"
                      domain={[0, 'dataMax']}
                      tickFormatter={(val) => `${Math.round(val)}s`}
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value, name) => [value, name === 'reference' ? 'Original' : 'You']}
                      labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="reference" stroke="#3b82f6" strokeWidth={2} strokeOpacity={0.5} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Line type="monotone" dataKey="user" stroke="#f97316" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {challengeScore.detailed_summary && !showDetails && (
              <button 
                onClick={() => setShowDetails(true)}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg mb-6 transition-colors"
              >
                Read Detailed Analysis
              </button>
            )}

            {showDetails && challengeScore.detailed_summary && (
              <div className="mb-6 text-left bg-zinc-950/50 p-4 rounded-xl border border-zinc-800 max-h-64 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-purple-400 font-bold">Detailed Report</h3>
                  <button onClick={() => setShowDetails(false)} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{challengeScore.detailed_summary}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-2">Recording Finished!</h2>
            <p className="text-zinc-400 mb-6 text-sm">Listen to your performance or get AI feedback.</p>

            {chartData.length > 0 && (
              <div className="w-full h-48 mb-6 bg-black/40 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span className="text-zinc-500">Pitch Graph</span>
                    <span className="text-zinc-600 mx-1">·</span>
                    <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" /><span className="text-blue-400">Original</span>
                    <span className="text-zinc-600 mx-1">·</span>
                    <span className="inline-block w-3 h-0.5 bg-orange-400 rounded" /><span className="text-orange-400">You</span>
                  </h3>
                  <span className={`text-lg font-black tabular-nums ${
                    (challengeScore.pitchAccuracy || 0) >= 70 ? 'text-emerald-400' :
                    (challengeScore.pitchAccuracy || 0) >= 40 ? 'text-yellow-400' : 'text-rose-400'
                  }`}>
                    {challengeScore.pitchAccuracy ?? '–'}% <span className="text-xs font-normal text-zinc-500">pitch</span>
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <XAxis 
                      dataKey="time" 
                      type="number"
                      domain={[0, 'dataMax']}
                      tickFormatter={(val) => `${Math.round(val)}s`}
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value, name) => [value, name === 'reference' ? 'Original' : 'You']}
                      labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="reference" stroke="#3b82f6" strokeWidth={2} strokeOpacity={0.5} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Line type="monotone" dataKey="user" stroke="#f97316" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

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
                      userPicture: user ? user.picture : null,
                      pitchAccuracy: challengeScore.pitchAccuracy
                    })
                  });
                  const data = await res.json();
                  if (data.success) {
                    setChallengeScore({ 
                      ...challengeScore, 
                      score: data.score, 
                      brief_summary: data.brief_summary,
                      feedback: data.brief_summary || data.feedback,
                      detailed_summary: data.detailed_summary
                    });
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
              <button 
                onClick={handleDownload}
                disabled={isConverting}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isConverting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Music className="w-5 h-5" />}
                {isConverting ? 'Converting...' : 'Download MP3'}
              </button>
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
