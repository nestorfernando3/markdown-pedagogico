#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const APP_URL = process.argv[2] ?? 'http://localhost:5173/';
const SCREENSHOT_PATH = path.resolve('output/playwright/training-smoke.png');
const PDF_PATH = path.resolve('output/pdf/training-smoke.pdf');

const SAMPLE_MARKDOWN = `# Documento guiado

Este párrafo **explica** el objetivo del documento y enlaza a [OpenAI](https://openai.com).

- primer punto
- segundo punto

\`\`\`ts
const answer = 42;
\`\`\`
`;

async function ensureDirectories() {
  await fs.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(PDF_PATH), { recursive: true });
}

async function main() {
  await ensureDirectories();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    try {
      delete window.showSaveFilePicker;
    } catch {}

    try {
      delete Object.getPrototypeOf(window).showSaveFilePicker;
    } catch {}
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Activar training mode/i }).click();
  await page.getByRole('textbox', { name: 'Escritura (Markdown)' }).fill(SAMPLE_MARKDOWN);
  await page.getByRole('heading', { name: 'Exporta tu documento' }).waitFor();
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: /^Exportar PDF$/i }).click(),
  ]);

  await download.saveAs(PDF_PATH);
  await browser.close();

  console.log(`screenshot: ${SCREENSHOT_PATH}`);
  console.log(`pdf: ${PDF_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
