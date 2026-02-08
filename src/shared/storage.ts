import { DEFAULT_SETTINGS, SettingsSchema, type ShipItSettings } from "./settings";

const KEY = "shipit.settings";

export async function getSettings(): Promise<ShipItSettings> {
  const obj = await chrome.storage.local.get(KEY);
  const raw = obj[KEY] ?? {};
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  return SettingsSchema.parse(merged);
}

export async function saveSettings(partial: Partial<ShipItSettings>): Promise<ShipItSettings> {
  const current = await getSettings();
  const next = SettingsSchema.parse({ ...current, ...partial });
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
