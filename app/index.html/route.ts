import { readStaticIndexHtml } from '../lib/static-html';

export const runtime = 'nodejs';

export async function GET() {
  const html = readStaticIndexHtml();

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
