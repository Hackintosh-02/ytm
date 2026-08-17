// Copy non-TS renderer assets (HTML, CSS) into dist so BrowserWindow.loadFile
// can find them next to the compiled overlay.js.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

walk(SRC, (file) => {
  if (/\.(html|css|png|svg|ico|icns)$/i.test(file)) {
    const rel = path.relative(SRC, file);
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
  }
});
