import json
import sys

with open('/tmp/cf-dist-config.json', 'r') as f:
    d = json.load(f)

config = d['DistributionConfig']

# Find source/* and change to /source/*
for cb in config['CacheBehaviors']['Items']:
    if cb['PathPattern'] == 'source/*':
        cb['PathPattern'] = '/source/*'

# Add /*.wav behavior by copying *.mp3 behavior
mp3_cb = next((cb for cb in config['CacheBehaviors']['Items'] if cb['PathPattern'] == '*.mp3'), None)
if mp3_cb:
    wav_cb = json.loads(json.dumps(mp3_cb))
    wav_cb['PathPattern'] = '*.wav'
    config['CacheBehaviors']['Items'].append(wav_cb)
    config['CacheBehaviors']['Quantity'] = len(config['CacheBehaviors']['Items'])

with open('/tmp/cf-dist-config-updated.json', 'w') as f:
    json.dump(config, f)

print(d['ETag'])
