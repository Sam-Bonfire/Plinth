import { spawnSync, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PNG } from 'pngjs';

interface SceneSpec {
  id: string;
  title: string;
  theme: 'light' | 'dark';
}

const SCENES: SceneSpec[] = [
  { id: 'active-order', title: 'Active Dine-In Order & GST Slab Breakdown', theme: 'light' },
  { id: 'kds-station', title: 'Kitchen KDS Station Grid with SLA Timers', theme: 'dark' },
  { id: 'shift-reconciliation', title: 'Shift Till Reconciliation & Z-Report', theme: 'light' },
];

function runCommand(command: string, args: string[]): { status: number | null; stdout: Buffer; stderr: Buffer } {
  return spawnSync(command, args, { stdio: 'pipe' });
}

async function validateAndNormalizePng(filePath: string, label: string): Promise<void> {
  const fileBytes = await fs.readFile(filePath);
  const png = PNG.sync.read(fileBytes);
  console.log(`🔍 [${label}] Validated PNG: ${png.width}x${png.height} (8-bit RGBA)`);

  const normalized = PNG.sync.write(png, {
    bitDepth: 8,
    colorType: 2, // 24-bit RGB
    inputColorType: 6, // RGBA
    inputHasAlpha: true,
  });
  await fs.writeFile(filePath, normalized);
}

async function captureAndroid(outputDir: string) {
  console.log('🤖 Capturing Android Emulator screens via adb...');
  const devices = runCommand('adb', ['devices']).stdout.toString();
  if (!devices.includes('emulator-') && !devices.includes('device')) {
    console.warn('⚠️ No connected Android emulator or device found via adb. Skipping native Android screencap.');
    return [];
  }

  const results: { file: string; title: string; platform: string }[] = [];

  for (const scene of SCENES) {
    const url = `http://10.0.2.2:5173/?scene=${scene.id}&theme=${scene.theme}`;
    runCommand('adb', ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url]);
    await new Promise((r) => setTimeout(r, 2000)); // Allow render

    const filename = `android-${scene.id}.png`;
    const destination = path.join(outputDir, filename);

    const capture = runCommand('adb', ['exec-out', 'screencap', '-p']);
    if (capture.status === 0 && capture.stdout.length > 0) {
      await fs.writeFile(destination, capture.stdout);
      await validateAndNormalizePng(destination, 'Android');
      results.push({ file: filename, title: scene.title, platform: 'Android Tablet/Phone' });
      console.log(`✅ Captured Android Emulator: ${filename}`);
    } else {
      console.error(`❌ Failed capturing Android scene: ${scene.id}`);
    }
  }

  return results;
}

async function captureIos(outputDir: string) {
  console.log('🍎 Capturing iOS Simulator screens via xcrun simctl...');
  const list = runCommand('xcrun', ['simctl', 'list', 'devices', 'booted']).stdout.toString();
  if (!list.includes('Booted')) {
    console.warn('⚠️ No booted iOS Simulator found. Skipping native iOS screencap.');
    return [];
  }

  const results: { file: string; title: string; platform: string }[] = [];

  for (const scene of SCENES) {
    const url = `http://localhost:5173/?scene=${scene.id}&theme=${scene.theme}`;
    runCommand('xcrun', ['simctl', 'openurl', 'booted', url]);
    await new Promise((r) => setTimeout(r, 2000));

    const filename = `ios-${scene.id}.png`;
    const destination = path.join(outputDir, filename);

    const capture = runCommand('xcrun', ['simctl', 'io', 'booted', 'screenshot', destination]);
    if (capture.status === 0) {
      await validateAndNormalizePng(destination, 'iOS');
      results.push({ file: filename, title: scene.title, platform: 'iOS iPad/iPhone' });
      console.log(`✅ Captured iOS Simulator: ${filename}`);
    }
  }

  return results;
}

async function main() {
  const outputDir = path.resolve(process.cwd(), 'artifacts/screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  const platformArg = process.argv.find((a) => a.startsWith('--platform='))?.split('=')[1] ?? 'all';

  let captures: { file: string; title: string; platform: string }[] = [];

  if (platformArg === 'all' || platformArg === 'android') {
    captures = captures.concat(await captureAndroid(outputDir));
  }
  if (platformArg === 'all' || platformArg === 'ios') {
    captures = captures.concat(await captureIos(outputDir));
  }

  console.log(`\n🎉 Native Emulator Capture complete. Total captures: ${captures.length}`);
}

main().catch((err) => {
  console.error('Fatal error during emulator capture:', err);
  process.exit(1);
});
