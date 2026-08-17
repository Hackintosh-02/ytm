import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

const YTM_URL = 'https://music.youtube.com';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const ytmSession = session.fromPartition('persist:ytm');
  ytmSession.setUserAgent(CHROME_UA);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'YTM Desktop',
    backgroundColor: '#030303',
    webPreferences: {
      session: ytmSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/ytm.js'),
    },
  });

  win.loadURL(YTM_URL, { userAgent: CHROME_UA });
  return win;
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
