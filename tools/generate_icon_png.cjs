const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

async function captureIcon() {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const svgPath = path.join(__dirname, '../public/icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        svg { width: 512px; height: 512px; }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  
  // Wait a bit for rendering
  await new Promise(resolve => setTimeout(resolve, 1000));

  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();
  
  fs.writeFileSync(path.join(__dirname, '../public/icon.png'), pngBuffer);
  fs.writeFileSync(path.join(__dirname, '../build/icon.png'), pngBuffer);
  
  console.log('Icon PNGs generated!');
  win.close();
}

app.whenReady().then(async () => {
  try {
    await captureIcon();
  } catch (err) {
    console.error('Error generating icon:', err);
  } finally {
    app.quit();
  }
});
