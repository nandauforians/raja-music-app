import re

with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

# 1. Add new state and ref variables
state_vars = """
  const [challengeStatus, setChallengeStatus] = useState('idle'); // idle | countdown | recording | result | previewing
  const [duetMode, setDuetMode] = useState(null); // null | 'host_A' | 'host_B' | 'guest'
  const [openDuets, setOpenDuets] = useState([]);
  const [selectedDuet, setSelectedDuet] = useState(null);
  const hostAudioRef = useRef(null);
  const hostAudioSourceNodeRef = useRef(null);
"""
content = re.sub(r'const \[challengeStatus, setChallengeStatus\] = useState\(\'idle\'\);.*?$', state_vars, content, flags=re.MULTILINE)

# 2. Update parseLrc
parse_lrc_new = """
  const parseLrc = (lrcString) => {
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
  };
"""
content = re.sub(r'const parseLrc = \(lrcString\) => \{.*?\n  \};\n', parse_lrc_new.strip() + '\n', content, flags=re.DOTALL)

# 3. Add hidden audio tag to return statement
audio_tag_injection = """
        onTimeUpdate={handleTimeUpdate}
      />
      <audio
        ref={hostAudioRef}
        crossOrigin="anonymous"
        src={selectedDuet ? selectedDuet.hostVocalUrl : ''}
      />
"""
content = re.sub(r'onTimeUpdate={handleTimeUpdate}\n\s*/>', audio_tag_injection.strip(), content)


with open('frontend/src/App.jsx', 'w') as f:
    f.write(content)
print("Patched basic states")
