const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/App.jsx');
const code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\n');
const start = 523; // parseLrc
console.log(lines.slice(start - 1, start + 25).join('\n'));
