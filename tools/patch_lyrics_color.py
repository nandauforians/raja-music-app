import re
with open('frontend/src/App.jsx', 'r') as f:
    content = f.read()

pattern = r'\{activeLines\.map\(\(line, index\) => \(\s*<p key=\{index\} className=\{`text-center font-bold text-2xl transition-all duration-300 \$\{activeLineIndex === index \? \'text-amber-400 scale-110 drop-shadow-\[0_0_15px_rgba\(251,191,36,0\.5\)\]\' : \'text-zinc-600\'\}`\}>\s*\{line\.text\}\s*</p>\s*\)\)\}'

repl = r'''{activeLines.map((line, index) => {
                          const isActive = activeLineIndex === index;
                          let colorClass = isActive ? 'text-amber-400 scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'text-zinc-600';
                          
                          if (duetMode) {
                            const isHostA = duetMode === 'host_A';
                            const isHostB = duetMode === 'host_B';
                            const isGuest = duetMode === 'guest';
                            const guestPart = selectedDuet?.hostPart === 'A' ? 'B' : 'A';
                            
                            const userPart = isHostA ? 'A' : (isHostB ? 'B' : guestPart);
                            
                            if (line.part === 'BOTH') {
                              colorClass = isActive ? 'text-orange-400 scale-110 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]' : 'text-orange-900/50';
                            } else if (line.part === userPart) {
                              colorClass = isActive ? 'text-blue-400 scale-110 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-blue-900/50';
                            } else if (line.part) {
                              // Other user's part
                              colorClass = isActive ? 'text-zinc-500 scale-100' : 'text-zinc-800';
                            }
                          }
                          
                          return (
                            <p key={index} className={`text-center font-bold text-2xl transition-all duration-300 ${colorClass}`}>
                              {line.text}
                            </p>
                          );
                        })}'''

new_content = re.sub(pattern, repl, content)
if new_content != content:
    with open('frontend/src/App.jsx', 'w') as f:
        f.write(new_content)
    print("Injected duet lyrics colors successfully")
else:
    print("Regex failed to match lyrics mapping")
