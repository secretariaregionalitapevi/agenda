import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  // Fonte única do HTML servido no "/"
  const filePath = join(process.cwd(), 'app', 'static', 'index.html');
  const html = readFileSync(filePath, 'utf-8');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Evita servir HTML antigo em edge cache durante ajustes visuais.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
