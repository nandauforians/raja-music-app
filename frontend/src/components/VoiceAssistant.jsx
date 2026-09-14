import React, { useState, useRef, useCallback, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Supported query examples shown in the UI
const EXAMPLES = [
  'Play Thenpaandi Seemaiyile',
  'List songs from Nayakan',
  'Songs with Kamal Haasan',
  'Play something from the 1980s',
  'Songs by SPB from 1986',
];

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  RESULTS: 'results',
};

export default function VoiceAssistant({ onPlaySong, onShowResults, currentSong }) {
  const [state, setState] = useState(STATES.IDLE);
  const [transcript, setTranscript] = useState('');
  const [speechResponse, setSpeechResponse] = useState('');
  const [results, setResults] = useState([]);
  const [isSupported, setIsSupported] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [thinkingMessage, setThinkingMessage] = useState('Thinking...');
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const panelRef = useRef(null);
  const thinkingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsSupported(false);
    }
    // Cycle example hints
    const timer = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLES.length), 3000);
    return () => clearInterval(timer);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (state !== STATES.LISTENING && state !== STATES.THINKING) {
          setShowPanel(false);
          setState(STATES.IDLE);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel, state]);

  // Handle thinking timeout
  useEffect(() => {
    if (state === STATES.THINKING) {
      setThinkingMessage('Thinking...');
      thinkingTimeoutRef.current = setTimeout(() => {
        setThinkingMessage('Identifying song...');
      }, 2500);
    } else {
      clearTimeout(thinkingTimeoutRef.current);
    }
    return () => clearTimeout(thinkingTimeoutRef.current);
  }, [state]);

  const speak = useCallback((text) => {
    synthRef.current?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-IN';
    utter.rate = 0.95;
    utter.pitch = 1.05;
    utter.onstart = () => setState(STATES.SPEAKING);
    utter.onend = () => setState(s => s === STATES.SPEAKING ? STATES.IDLE : s);
    synthRef.current?.speak(utter);
  }, []);

  const handleVoiceCommand = useCallback(async (text) => {
    setTranscript(text);
    setState(STATES.THINKING);
    setSpeechResponse('');

    try {
      const res = await fetch(`${API_BASE_URL}/voice-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, contextSongs: results }),
      });
      const data = await res.json();
      setSpeechResponse(data.speech_response || '');

      if (data.intent === 'PLAY_SONG' && data.song) {
        speak(data.speech_response);
        onPlaySong(data.song);
        setShowPanel(false);
        setState(STATES.IDLE);
      } else if (data.intent === 'LIST_SONGS' && data.songs?.length > 0) {
        setResults(data.songs);
        setState(STATES.RESULTS);
        speak(data.speech_response);
      } else {
        setState(STATES.IDLE);
        speak(data.speech_response || "Sorry, I couldn't find what you're looking for.");
      }
    } catch (e) {
      console.error('Voice command failed:', e);
      setState(STATES.IDLE);
      speak('Sorry, something went wrong. Please try again.');
    }
  }, [onPlaySong, speak]);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    synthRef.current?.cancel();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setState(STATES.LISTENING);
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      rec.stop();
      handleVoiceCommand(text);
    };
    rec.onerror = () => {
      setState(STATES.IDLE);
      setSpeechResponse('Microphone error. Please check permissions and try again.');
    };
    rec.onend = () => {
      if (state === STATES.LISTENING) setState(STATES.IDLE);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [isSupported, handleVoiceCommand, state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState(STATES.IDLE);
  }, []);

  const handleMicClick = () => {
    if (!showPanel) {
      setShowPanel(true);
      setTranscript('');
      setSpeechResponse('');
      setResults([]);
      return;
    }
    if (state === STATES.LISTENING) {
      stopListening();
    } else if (state === STATES.IDLE || state === STATES.RESULTS) {
      setResults([]);
      setTranscript('');
      setSpeechResponse('');
      startListening();
    }
  };

  const micColor = {
    [STATES.IDLE]: 'from-amber-500 to-orange-500',
    [STATES.LISTENING]: 'from-red-500 to-rose-600',
    [STATES.THINKING]: 'from-blue-500 to-indigo-600',
    [STATES.SPEAKING]: 'from-emerald-500 to-teal-600',
    [STATES.RESULTS]: 'from-amber-500 to-orange-500',
  }[state];

  const micLabel = {
    [STATES.IDLE]: 'Tap to speak',
    [STATES.LISTENING]: 'Listening...',
    [STATES.THINKING]: thinkingMessage,
    [STATES.SPEAKING]: 'Speaking...',
    [STATES.RESULTS]: 'Tap to speak again',
  }[state];

  if (!isSupported) return null;

  return (
    <>
      {/* Floating Mic Button */}
      <button
        id="voice-assistant-btn"
        onClick={handleMicClick}
        title="Voice Assistant — say a command"
        className={`relative w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br ${micColor} flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${state === STATES.LISTENING ? 'scale-110' : ''}`}
      >
        {/* Pulsing ring when listening */}
        {state === STATES.LISTENING && (
          <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
        )}
        {/* Mic SVG icon */}
        {state === STATES.THINKING ? (
          <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6.5 9.5a.5.5 0 0 1 1 0A7.5 7.5 0 0 1 12.5 18v2.5h2.5a.5.5 0 0 1 0 1h-6a.5.5 0 0 1 0-1H11.5V18A7.5 7.5 0 0 1 4.5 10.5a.5.5 0 0 1 1 0 6.5 6.5 0 0 0 13 0z"/>
          </svg>
        )}
      </button>

      {/* Voice Panel */}
      {showPanel && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-3 w-80 lg:w-96 bg-zinc-950/98 backdrop-blur-2xl border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.1)' }}
        >
          {/* Header */}
          <div className={`px-5 py-4 bg-gradient-to-r ${micColor} bg-opacity-10`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${micColor} ${state === STATES.LISTENING ? 'animate-pulse' : ''}`} />
                <span className="text-white text-sm font-semibold">Raja AI</span>
                <span className="text-zinc-400 text-xs">Voice Assistant</span>
              </div>
              <button
                onClick={() => { setShowPanel(false); stopListening(); synthRef.current?.cancel(); setState(STATES.IDLE); }}
                className="text-zinc-500 hover:text-white text-lg transition-colors"
              >×</button>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Mic button + label */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={state === STATES.LISTENING ? stopListening : startListening}
                disabled={state === STATES.THINKING || state === STATES.SPEAKING}
                className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${micColor} flex items-center justify-center shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed ${state === STATES.LISTENING ? 'scale-110' : 'hover:scale-105'}`}
                style={{ boxShadow: state === STATES.LISTENING ? '0 0 30px rgba(239,68,68,0.4)' : '0 0 20px rgba(251,191,36,0.2)' }}
              >
                {state === STATES.LISTENING && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
                {state === STATES.THINKING ? (
                  <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6.5 9.5a.5.5 0 0 1 1 0A7.5 7.5 0 0 1 12.5 18v2.5h2.5a.5.5 0 0 1 0 1h-6a.5.5 0 0 1 0-1H11.5V18A7.5 7.5 0 0 1 4.5 10.5a.5.5 0 0 1 1 0 6.5 6.5 0 0 0 13 0z"/>
                  </svg>
                )}
              </button>
              <p className="text-zinc-400 text-xs font-medium tracking-widest uppercase">{micLabel}</p>
            </div>

            {/* Transcript display */}
            {transcript ? (
              <div className="bg-zinc-900 rounded-xl px-4 py-3 border border-zinc-800">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">I heard</p>
                <p className="text-white text-sm font-medium">"{transcript}"</p>
              </div>
            ) : (
              <div className="bg-zinc-900/50 rounded-xl px-4 py-3 border border-zinc-800/50">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Try saying</p>
                <p className="text-zinc-400 text-sm italic transition-all duration-500">"{EXAMPLES[exampleIdx]}"</p>
              </div>
            )}

            {/* AI response */}
            {speechResponse && (
              <div className="flex gap-2.5 items-start">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-xs">R</span>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{speechResponse}</p>
              </div>
            )}

            {/* Song results list */}
            {results.length > 0 && state === STATES.RESULTS && (
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto scrollbar-hide">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{results.length} songs found</p>
                {results.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => { onPlaySong(song); setShowPanel(false); setState(STATES.IDLE); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 hover:border-amber-500/30 transition-all group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0 group-hover:from-amber-500/30">
                      <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v14l11-7-11-7z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{song.title}</p>
                      <p className="text-zinc-500 text-xs truncate">{song.movie} • {song.year}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Hint text */}
            <p className="text-zinc-700 text-[10px] text-center">
              Works in Chrome & Safari • English & Tamil
            </p>
          </div>
        </div>
      )}
    </>
  );
}
