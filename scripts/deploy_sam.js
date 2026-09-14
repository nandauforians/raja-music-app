const { spawnSync } = require('child_process');
const fs = require('fs');

// Simple parse for .env
const env = {};
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2];
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val;
  }
});

const privateKey = env.CLOUDFRONT_PRIVATE_KEY.replace(/\n/g, '\\n');

const tomlContent = `version = 0.1

[default]
[default.deploy]
[default.deploy.parameters]
stack_name = "ilayaraja-app"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
confirm_changeset = false
parameter_overrides = """
AdminApiKey=\\"dummy_key_123\\" \\
MongoDbUri=\\"${env.MONGODB_URI}\\" \\
GoogleClientId=\\"${env.GOOGLE_CLIENT_ID}\\" \\
SpotifyClientId=\\"${env.SPOTIFY_CLIENT_ID}\\" \\
SpotifyClientSecret=\\"${env.SPOTIFY_CLIENT_SECRET}\\" \\
GeminiApiKey=\\"${env.GEMINI_API_KEY}\\" \\
DomainName=\\"${env.DOMAIN_NAME}\\" \\
CloudFrontPrivateKey=\\"${privateKey}\\" \\
TwitterConsumerKey=\\"${env.TWITTER_CONSUMER_KEY}\\" \\
TwitterSecretKey=\\"${env.TWITTER_SECRET_KEY}\\" \\
TwitterAccessToken=\\"\\" \\
TwitterAccessTokenSecret=\\"\\"
"""
`;

fs.writeFileSync('samconfig.toml', tomlContent);

console.log('Deploying with samconfig.toml...');
const res = spawnSync('sam', ['deploy'], { stdio: 'inherit' });

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status);
