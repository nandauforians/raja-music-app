import re
with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

pattern = r'(<audio\s+ref=\{audioRef\}\s+crossOrigin="anonymous"\s+src=\{.*?\}\s+controls\s+onTimeUpdate=\{handleAudioTimeUpdate\}\s+onSeeking=\{handleSeeking\}\s+onLoadedMetadata=\{handleLoadedMetadata\}\s+className="w-full rounded-xl custom-audio-player"\s+style=\{\{[\s\S]*?\}\}\s+/>)'

repl = r'\1\n                  <audio ref={hostAudioRef} crossOrigin="anonymous" src={selectedDuet ? selectedDuet.hostVocalUrl : ""} className="hidden" />'

new_content = re.sub(pattern, repl, content)
if new_content != content:
    with open('frontend/src/App.jsx', 'w') as f:
        f.write(new_content)
    print("Injected hostAudioRef successfully")
else:
    print("Regex failed to match audio tag")
