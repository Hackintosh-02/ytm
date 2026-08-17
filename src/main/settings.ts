import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface OverlaySettings {
  enabled: boolean; // whether the overlay is shown at all
  fontSize: number;
  opacity: number; // 0..1 background darkness
  offset: number;  // seconds; positive = lyrics later
  bounds?: { x: number; y: number; width: number; height: number };
}

const DEFAULTS: OverlaySettings = {
  enabled: false,
  fontSize: 18,
  opacity: 0.55,
  offset: 0,
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'overlay-settings.json');
}

export function loadSettings(): OverlaySettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: OverlaySettings) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  } catch {
    // best-effort persistence; ignore errors
  }
}
