import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readStaticIndexHtml(): string {
  const filePath = join(process.cwd(), 'app', 'static', 'index.html');
  const installCss = readFileSync(join(process.cwd(), 'public', 'styles', 'install-prompt.css'), 'utf-8');
  const installScript = readFileSync(join(process.cwd(), 'public', 'scripts', 'install-prompt.js'), 'utf-8');
  return readFileSync(filePath, 'utf-8').replace(
    '</head>',
    `<style data-pwa-install>${installCss}</style><script data-pwa-install>${installScript}</script></head>`,
  );
}
