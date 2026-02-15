import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readStaticIndexHtml(): string {
  const filePath = join(process.cwd(), 'app', 'static', 'index.html');
  return readFileSync(filePath, 'utf-8');
}
