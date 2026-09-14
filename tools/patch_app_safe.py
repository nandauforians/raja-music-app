import sys

with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

# 1. State Variables
state_vars_orig = "  const [challengeStatus, setChallengeStatus] = useState('idle'); // idle | countdown | recording | result | previewing"
state_vars_new = """  const [challengeStatus, setChallengeStatus] = useState('idle'); // idle | countdown | recording | result | previewing
  const [duetMode, setDuetMode] = useState(null); // null | 'host_A' | 'host_B' | 'guest'
  const [openDuets, setOpenDuets] = useState([]);
  const [selectedDuet, setSelectedDuet] = useState(null);
  const hostAudioRef = useRef(null);
  const hostAudioSourceNodeRef = useRef(null);"""

if state_vars_orig in content:
    content = content.replace(state_vars_orig, state_vars_new)
else:
    print("Failed to find state_vars_orig")

# 2. hostAudioRef
audio_orig = """                  <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    src={(mode === 'karaoke' && challengeStatus !== 'previewing') ? song.karaoke_url : song.original_url}
                    controls
                    onTimeUpdate={handleAudioTimeUpdate}
                    onSeeking={handleSeeking}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full rounded-xl custom-audio-player"
                    style={{
                      filter: mode === 'karaoke' 
                        ? 'hue-rotate(270deg) brightness(0.9) contrast(1.2)' 
                        : 'hue-rotate(0deg) brightness(1) contrast(1)',
                    }}
                  />"""
audio_new = """                  <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    src={(mode === 'karaoke' && challengeStatus !== 'previewing') ? song.karaoke_url : song.original_url}
                    controls
                    onTimeUpdate={handleAudioTimeUpdate}
                    onSeeking={handleSeeking}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full rounded-xl custom-audio-player"
                    style={{
                      filter: mode === 'karaoke' 
                        ? 'hue-rotate(270deg) brightness(0.9) contrast(1.2)' 
                        : 'hue-rotate(0deg) brightness(1) contrast(1)',
                    }}
                  />
                  <audio
                    ref={hostAudioRef}
                    crossOrigin="anonymous"
                    src={selectedDuet ? selectedDuet.hostVocalUrl : ''}
                    className="hidden"
                  />"""

if audio_orig in content:
    content = content.replace(audio_orig, audio_new)
else:
    print("Failed to find audio_orig")
    
# 3. parseLrc
parse_lrc_orig = """  const parseLrc = (lrcString) => {
    const lines = lrcString.split('\\n');
    const parsed = [];
    const regex = /\\[(\\d{2}):(\\d{2}\\.\\d{2,3})\\](.*)/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const m = parseInt(match[1]);
        const s = parseFloat(match[2]);
        let text = match[3].trim();
        let gender = null;
        
        if (text.startsWith('M:') || text.startsWith('M :')) {
          gender = 'M';
          text = text.replace(/^M\\s*:\\s*/i, '').trim();
        } else if (text.startsWith('F:') || text.startsWith('F :')) {
          gender = 'F';
          text = text.replace(/^F\\s*:\\s*/i, '').trim();
        }

        if (text) {
          parsed.push({ timeMs: (m * 60 + s) * 1000, text, gender });
        }
      }
    }
    return parsed;
  };"""

parse_lrc_new = """  const parseLrc = (lrcString) => {
    const lines = lrcString.split('\\n');
    const parsed = [];
    const regex = /\\[(\\d{2}):(\\d{2}\\.\\d{2,3})\\](.*)/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const m = parseInt(match[1]);
        const s = parseFloat(match[2]);
        let text = match[3].trim();
        let gender = null;
        let part = null;
        
        if (text.startsWith('A:') || text.startsWith('A :')) {
          part = 'A';
          text = text.replace(/^A\\s*:\\s*/i, '').trim();
        } else if (text.startsWith('B:') || text.startsWith('B :')) {
          part = 'B';
          text = text.replace(/^B\\s*:\\s*/i, '').trim();
        } else if (text.startsWith('BOTH:') || text.startsWith('BOTH :')) {
          part = 'BOTH';
          text = text.replace(/^BOTH\\s*:\\s*/i, '').trim();
        } else if (text.startsWith('M:') || text.startsWith('M :')) {
          gender = 'M';
          text = text.replace(/^M\\s*:\\s*/i, '').trim();
        } else if (text.startsWith('F:') || text.startsWith('F :')) {
          gender = 'F';
          text = text.replace(/^F\\s*:\\s*/i, '').trim();
        }

        if (text) {
          parsed.push({ timeMs: (m * 60 + s) * 1000, text, gender, part });
        }
      }
    }
    return parsed;
  };"""

if parse_lrc_orig in content:
    content = content.replace(parse_lrc_orig, parse_lrc_new)
else:
    print("Failed to find parse_lrc_orig")

with open('frontend/src/App.jsx', 'w') as f:
    f.write(content)
print("Safe patch completed")
