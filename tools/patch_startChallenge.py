import re
with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

pattern = r'(// Route Audio Player -> Destination AND Speakers\s+if \(audioSource\) \{\s+audioSource\.connect\(dest\);\s+audioSource\.connect\(audioCtx\.destination\);\s+\})'

repl = r'''\1
          
          // Setup Host Audio Element Source for Duets
          if (!hostAudioSourceNodeRef.current && hostAudioRef.current && hostAudioRef.current.src) {
            hostAudioSourceNodeRef.current = audioCtx.createMediaElementSource(hostAudioRef.current);
          }
          const hostAudioSource = hostAudioSourceNodeRef.current;
          
          // Route Host Audio -> Destination AND Speakers
          if (hostAudioSource) {
            hostAudioSource.connect(dest);
            hostAudioSource.connect(audioCtx.destination);
          }'''

new_content = re.sub(pattern, repl, content)

# Also need to make sure hostAudio starts playing!
play_pattern = r'(audioRef\.current\.play\(\)\.catch\(e => console\.error\("Playback error:", e\)\);)'
play_repl = r'''\1
            if (hostAudioRef.current && hostAudioRef.current.src) {
              hostAudioRef.current.currentTime = startTime;
              hostAudioRef.current.play().catch(e => console.error("Host playback error:", e));
            }'''
new_content = re.sub(play_pattern, play_repl, new_content)

# And stop hostAudio on stop
stop_pattern = r'(mediaRecorderRef\.current\.stop\(\);)'
stop_repl = r'''\1
            if (hostAudioRef.current) {
              hostAudioRef.current.pause();
              hostAudioRef.current.currentTime = 0;
            }'''
new_content = re.sub(stop_pattern, stop_repl, new_content)


if new_content != content:
    with open('frontend/src/App.jsx', 'w') as f:
        f.write(new_content)
    print("Injected host routing successfully")
else:
    print("Regex failed")
