const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
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
    { name: 'ClipVault Feature Overview - Fast Downloads.mp4', path: '/path/1', size: 1024 * 1024 * 542, mtime: new Date(), duration: 10800, thumbnail: 'https://picsum.photos/seed/clipvault/400/225' },
    { name: 'High Quality Video Compression Tips.mp4', path: '/path/2', size: 1024 * 1024 * 850, mtime: new Date(Date.now() - 86400000), duration: 3600, thumbnail: 'https://picsum.photos/seed/quality/400/225' },
    { name: 'Electron + Vue 3 Development Guide.mp4', path: '/path/3', size: 1024 * 1024 * 125, mtime: new Date(Date.now() - 172800000), duration: 1200, thumbnail: 'https://picsum.photos/seed/dev/400/225' }
  ]),
  getMetadata: () => Promise.resolve({ title: 'Nature in 4K - Breathtaking Scenery', uploader: 'Nature Channel', thumbnail: 'https://picsum.photos/seed/nature/400/225', duration_string: '04:15' }),
  setStoreValue: () => Promise.resolve(),
  checkVideoExists: () => Promise.resolve(false),
  startDownload: () => Promise.resolve({ filePath: '/path/video.mp4' }),
  openFile: () => {},
  openFolder: () => {},
  deleteVideo: () => Promise.resolve(true)
});
