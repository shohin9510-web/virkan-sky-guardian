const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'web', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];

if (!inlineScripts.length) {
  throw new Error('No inline JavaScript blocks found in web/index.html');
}

let checked = 0;
for (const match of inlineScripts) {
  const code = match[1].trim();
  if (!code) continue;
  new Function(code);
  checked += 1;
}

if (!html.includes('VIRKAN: SKY GUARDIAN')) {
  throw new Error('Expected game title not found');
}

console.log(`OK: ${checked} inline JavaScript block(s) parsed successfully.`);
