const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '../src/skills/presets');
const dest = path.join(__dirname, '../dist/skills/presets');
fs.cpSync(src, dest, { recursive: true });
