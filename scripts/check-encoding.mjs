import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoreDirs = new Set(['.git', '.next', 'node_modules']);
const textExts = new Set([
  '.html',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.md',
  '.yml',
  '.yaml',
  '.txt',
]);

function hasTextExtension(path) {
  const idx = path.lastIndexOf('.');
  if (idx < 0) return false;
  return textExts.has(path.slice(idx).toLowerCase());
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    if (entry.isFile()) {
      const rel = relative(root, abs).replace(/\\/g, '/');
      if (hasTextExtension(rel) || rel === '.env.local' || rel === '.env.example') {
        out.push(rel);
      }
    }
  }
  return out;
}

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function hasInvalidControlChars(text) {
  // Allow tab/newline/carriage return.
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text);
}

function hasMojibake(text) {
  // Common mojibake signatures from UTF-8 mis-decoding.
  return /(Ã¡|Ã¢|Ã£|Ã§|Ã©|Ãª|Ã­|Ã³|Ãº|Ã|Ã‡|Ã•|Â |â€”|â€¢|â€œ|â€|â€|ï¿½|�)/.test(text);
}

const files = walk(root);
const errors = [];

for (const rel of files) {
  const abs = join(root, rel);
  const buf = readFileSync(abs);
  if (hasBom(buf)) {
    errors.push(`${rel}: UTF-8 BOM detectado (use UTF-8 sem BOM).`);
  }

  const text = buf.toString('utf8');
  if (hasInvalidControlChars(text)) {
    errors.push(`${rel}: caractere de controle inválido detectado.`);
  }

  if (rel === 'app/static/index.html' && hasMojibake(text)) {
    errors.push(`${rel}: possível mojibake detectado (ex.: Ã, Â, â).`);
  }
}

if (errors.length > 0) {
  console.error('ERRO de encoding:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('OK: encoding UTF-8 sem BOM validado.');
