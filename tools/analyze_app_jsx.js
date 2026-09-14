const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/App.jsx');
const code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\n');
console.log("Functions in App.jsx:");
lines.forEach((line, i) => {
  if (line.match(/const [a-zA-Z0-9_]+ = \(.*?\) => {/)) {
     console.log(`${i+1}: ${line.trim()}`);
  }
  if (line.match(/function [a-zA-Z0-9_]+\(/)) {
     console.log(`${i+1}: ${line.trim()}`);
  }
});
