import { readStaticIndexHtml } from './lib/static-html';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

const PWA_FILES: Record<string, { file: string; type: string }> = {
  'manifest': { file: 'manifest.webmanifest', type: 'application/manifest+json; charset=utf-8' },
  'sw': { file: 'sw.js', type: 'application/javascript; charset=utf-8' },
  'install-js': { file: 'scripts/install-prompt.js', type: 'application/javascript; charset=utf-8' },
  'install-css': { file: 'styles/install-prompt.css', type: 'text/css; charset=utf-8' },
  'icon180': { file: 'icons/icon-180.png', type: 'image/png' },
  'icon192': { file: 'icons/icon-192.png', type: 'image/png' },
  'icon512': { file: 'icons/icon-512.png', type: 'image/png' },
};

export async function GET(request: Request) {
  const asset = new URL(request.url).searchParams.get('pwa');
  const pwaFile = asset ? PWA_FILES[asset] : undefined;

  if (pwaFile) {
    const body = readFileSync(join(process.cwd(), 'public', pwaFile.file));
    return new Response(body, {
      headers: {
        'Content-Type': pwaFile.type,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        ...(asset === 'sw' ? { 'Service-Worker-Allowed': '/' } : {}),
      },
    });
  }

  const html = readStaticIndexHtml();

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Evita servir HTML antigo em edge cache durante ajustes visuais.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
