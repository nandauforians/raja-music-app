const http = require('http');

http.get('http://localhost:3000/song/today', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
