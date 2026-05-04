import { spawn, execSync } from 'child_process';
import http from 'http';

const DEV_SERVER_URL = 'http://localhost:5173';
const SCREENSHOT_CMD = 'npx electron tools/take_screenshots.cjs';

async function isPortOpen(url) {
  return new Promise((resolve) => {
    http.get(url, () => resolve(true)).on('error', () => resolve(false));
  });
}

async function waitPort(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isPortOpen(url)) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function run() {
  let devServerProcess = null;
  const alreadyRunning = await isPortOpen(DEV_SERVER_URL);

  if (!alreadyRunning) {
    console.log('Starting dev server...');
    devServerProcess = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
    
    const ready = await waitPort(DEV_SERVER_URL);
    if (!ready) {
      console.error('Timeout waiting for dev server');
      devServerProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('Dev server already running.');
  }

  try {
    console.log('Running screenshot capture...');
    execSync(SCREENSHOT_CMD, { stdio: 'inherit' });
    console.log('Screenshots updated successfully!');
  } catch (err) {
    console.error('Error capturing screenshots:', err);
  } finally {
    if (devServerProcess) {
      console.log('Stopping dev server...');
      devServerProcess.kill();
      // On Windows, spawn with shell: true might need more forceful kill
      if (process.platform === 'win32') {
        execSync('taskkill /pid ' + devServerProcess.pid + ' /T /F');
      }
    }
  }
}

run();
