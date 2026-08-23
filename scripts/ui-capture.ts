import { chromium } from 'playwright';
import { createServer } from 'vite';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  description: string;
}

const VIEWPORTS: ViewportSpec[] = [
  { name: 'pos-terminal-1080p', width: 1920, height: 1080, description: 'POS Touchscreen Terminal (Full HD)' },
  { name: 'waiter-tablet-768p', width: 1024, height: 768, description: 'Waiter Mobile Tablet (4:3)' },
  { name: 'web-dashboard-900p', width: 1440, height: 900, description: 'Manager Web Back-Office' },
];

const SCENES = [
  { id: 'active-order', title: 'Active Dine-In Order & GST Slab Breakdown', theme: 'light' },
  { id: 'kds-station', title: 'Kitchen KDS Station Grid with SLA Timers', theme: 'dark' },
  { id: 'shift-reconciliation', title: 'Shift Till Reconciliation & Z-Report', theme: 'light' },
];

async function main() {
  const outputDir = path.resolve(process.cwd(), 'artifacts/screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  console.log('🚀 Starting programmatic Vite server for UI capture...');
  const server = await createServer({
    root: path.resolve(process.cwd(), 'apps/pos-client'),
    server: {
      port: 5173,
      strictPort: true,
    },
    logLevel: 'error',
  });
  await server.listen();
  console.log('🌐 Vite server ready at http://localhost:5173');

  console.log('🌐 Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const generatedScreenshots: { file: string; viewport: string; scene: string }[] = [];

  for (const scene of SCENES) {
    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const targetUrl = `http://localhost:5173/?scene=${scene.id}&theme=${scene.theme}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const filename = `${scene.id}-${vp.name}.png`;
      const filePath = path.join(outputDir, filename);
      await page.screenshot({ path: filePath, fullPage: false });
      generatedScreenshots.push({ file: filename, viewport: vp.description, scene: scene.title });
      console.log(`📸 Captured: ${filename} (${vp.width}x${vp.height})`);
      await page.close();
    }
  }

  await browser.close();
  await server.close();

  console.log(`\n✅ Generated ${generatedScreenshots.length} UI snapshot(s) in ${outputDir}`);

  // Write summary markdown for CI Step Summary
  const summaryLines = [
    '### 📸 UI Visual Verification Snapshots',
    '',
    '| Scene | Viewport | Status | Preview |',
    '| :--- | :--- | :---: | :--- |',
  ];

  for (const s of generatedScreenshots) {
    summaryLines.push(`| ${s.scene} | ${s.viewport} | ✅ Generated | \`${s.file}\` |`);
  }

  const summaryPath = path.join(outputDir, 'summary.md');
  await fs.writeFile(summaryPath, summaryLines.join('\n'), 'utf-8');

  process.exit(0);
}

main().catch((err) => {
  console.error('Error executing UI capture:', err);
  process.exit(1);
});
