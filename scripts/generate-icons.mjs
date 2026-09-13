import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const iconDir = resolve(rootDir, 'public/icon');
const svgPath = resolve(iconDir, 'icon.svg');
const sizes = [16, 19, 32, 38, 48, 96, 128];

function buildSvg(size = 128) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128" fill="none">
  <rect x="4" y="4" width="120" height="120" rx="32" fill="#123C35"/>
  <path d="M85 38a34 34 0 1 0 0 52" stroke="#E6FFF5" stroke-width="13" stroke-linecap="round"/>
  <path d="m77 51 22 26M99 51 77 77" stroke="#68E3B5" stroke-width="10" stroke-linecap="round"/>
</svg>
`.trim();
}

mkdirSync(iconDir, { recursive: true });
writeFileSync(svgPath, `${buildSvg()}\n`);

const browser = await chromium.launch();

try {
  for (const size of sizes) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: size, height: size }
    });

    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden;">${buildSvg(size)}</body></html>`
    );

    await page.screenshot({
      omitBackground: true,
      path: resolve(iconDir, `${size}.png`)
    });

    await page.close();
  }
} finally {
  await browser.close();
}
