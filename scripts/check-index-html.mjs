import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const canonicalRel = join('app', 'static', 'index.html');
const canonicalAbs = join(root, canonicalRel);
const ignoreDirs = new Set(['.git', '.next', 'node_modules']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(root, abs);

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
      out.push(rel);
    }
  }

  return out;
}

function hashFile(absPath) {
  const content = readFileSync(absPath);
  return createHash('sha256').update(content).digest('hex');
}

if (!statSync(canonicalAbs, { throwIfNoEntry: false })) {
  console.error(`ERRO: arquivo canônico não encontrado: ${canonicalRel}`);
  process.exit(1);
}

const allIndexHtml = walk(root).map((p) => p.split(sep).join('/')).sort();
const canonicalNormalized = canonicalRel.split(sep).join('/');

const duplicates = allIndexHtml.filter((p) => p !== canonicalNormalized);
if (duplicates.length === 0) {
  console.log('OK: apenas o index canônico existe.');
  process.exit(0);
}

const canonicalHash = hashFile(canonicalAbs);
const divergent = [];

for (const rel of duplicates) {
  const abs = join(root, rel);
  const currentHash = hashFile(abs);
  if (currentHash !== canonicalHash) {
    divergent.push(rel);
  }
}

if (divergent.length > 0) {
  console.error('ERRO: index.html divergente encontrado.');
  console.error(`Canônico: ${canonicalNormalized}`);
  console.error('Divergentes:');
  for (const rel of divergent) {
    console.error(`- ${rel}`);
  }
  process.exit(1);
}

console.log('OK: index.html extras existem, mas estão idênticos ao canônico.');
console.log(`Canônico: ${canonicalNormalized}`);
