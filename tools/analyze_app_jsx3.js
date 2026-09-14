const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/App.jsx');
const code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\n');
const start = 788; // startChallenge function
console.log(lines.slice(start - 1, start + 75).join('\n'));
