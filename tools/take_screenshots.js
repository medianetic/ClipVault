const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

async function capture(url, name, actions = null) {
  console.log(`Capturing ${name}...`);
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const mockScript = `
    window.api = {
      checkBinaries: () => Promise.resolve({ ytDlp: true, ffmpeg: true, ffprobe: true }),
      getStoreValue: (key) => {
        if (key === 'language') return Promise.resolve('en');
        if (key === 'theme') return Promise.resolve('dark');
        if (key === 'libraryViewMode') return Promise.resolve('detailed');
        return Promise.resolve(null);
      },
      onBinaryProgress: () => {},
      onDownloadProgress: () => {},
      listVideos: () => Promise.resolve([
        { name: 'Lo-Fi Hip Hop Radio - Beats to Relax/Study to.mp4', path: '/path/1', size: 1024 * 1024 * 542, mtime: new Date(), duration: 10800, thumbnail: 'https://picsum.photos/seed/lofi/400/225' },
        { name: 'SpaceX Starship IFT-3 Flight Test.mp4', path: '/path/2', size: 1024 * 1024 * 850, mtime: new Date(Date.now() - 86400000), duration: 3600, thumbnail: 'https://picsum.photos/seed/spacex/400/225' },
        { name: 'Vue 3 Composition API Tutorial.mp4', path: '/path/3', size: 1024 * 1024 * 125, mtime: new Date(Date.now() - 172800000), duration: 1200, thumbnail: 'https://picsum.photos/seed/vue/400/225' }
      ]),
      getMetadata: () => Promise.resolve({ title: 'Big Buck Bunny', uploader: 'Peach Open Movie', thumbnail: 'https://picsum.photos/seed/bunny/400/225', duration_string: '10:34' }),
      setStoreValue: () => Promise.resolve(),
      checkVideoExists: () => Promise.resolve(false),
      startDownload: () => Promise.resolve({ filePath: '/path/video.mp4' }),
      openFile: () => {},
      openFolder: () => {},
      deleteVideo: () => Promise.resolve(true)
    };
  `;

  await win.loadURL(url);
  await win.webContents.executeJavaScript(mockScript);
  
  // Reload to ensure the mock is applied early enough if needed, or just wait.
  // Since App.vue calls checkBinaries onMounted, we might need a reload or just wait for it to recover.
  await win.webContents.executeJavaScript('location.reload()');
  // Re-inject mock after reload
  win.webContents.on('did-finish-load', async () => {
    await win.webContents.executeJavaScript(mockScript);
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (actions) {
    await win.webContents.executeJavaScript(actions);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const image = await win.webContents.capturePage();
  const folder = path.join(__dirname, '../screenshots');
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, name), image.toPNG());
  win.close();
}

app.whenReady().then(async () => {
  const url = 'http://localhost:5173/';
  
  try {
    // 1. Main UI with metadata fetched
    await capture(url, 'main-ui.png', `
      // Fill URL and fetch metadata
      const input = document.querySelector('input[placeholder*="youtube.com"]');
      if (input) {
        input.value = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fetch') || b.textContent.includes('Details'));
        if (btn) btn.click();
      }
    `);

    // 2. Library Grid View
    await capture(url, 'library-grid.png');

    // 3. Library Compact View
    await capture(url, 'library-compact.png', `
      const listBtn = document.querySelector('.lucide-list')?.closest('button');
      if (listBtn) listBtn.click();
    `);

    console.log('All screenshots captured!');
  } catch (err) {
    console.error('Error capturing screenshots:', err);
  } finally {
    app.quit();
  }
});
