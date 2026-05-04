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
      preload: path.join(__dirname, 'mock_preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadURL(url);
  
  await new Promise(resolve => {
    win.webContents.on('did-finish-load', async () => {
      try {
        await new Promise(r => setTimeout(r, 5000));

        if (actions) {
          await win.webContents.executeJavaScript(actions);
          await new Promise(r => setTimeout(r, 2000));
        }

        const image = await win.webContents.capturePage();
        const folder = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(folder)) fs.mkdirSync(folder);
        fs.writeFileSync(path.join(folder, name), image.toPNG());
        resolve();
      } catch (e) {
        console.error('Error during capture:', e);
        resolve();
      }
    });
  });

  win.close();
}

app.whenReady().then(async () => {
  const url = 'http://localhost:5173/';
  
  try {
    await capture(url, 'main-ui.png', `
      const input = document.querySelector('input[placeholder*="youtube.com"]');
      if (input) {
        input.value = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Fetch') || b.textContent.includes('Details'));
        if (btn) btn.click();
      }
    `);

    await capture(url, 'library-grid.png');

    await capture(url, 'library-compact.png', `
      const listBtn = document.querySelector('.lucide-list')?.closest('button');
      if (listBtn) listBtn.click();
    `);

    console.log('All screenshots captured!');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    app.quit();
  }
});
