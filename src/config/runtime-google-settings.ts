import { db } from "../conversation/database.js";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-cipher.js";

/**
 * Cấu hình Google Gemini bổ sung (cho STT, Vision, OCR, TTS).
 * Tách riêng để LLM chat chính vẫn chạy qua 9Router/OpenAI-compatible
 * mà không bị đè hay lẫn lộn.
 */
export type GoogleSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

const keys = {
  baseUrl: "google_base_url",
  apiKey: "google_api_key",
  model: "google_model",
} as const;

const get = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const set = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
`);

function read(key: string): string | undefined {
  return (get.get(key) as { value: string } | undefined)?.value;
}

function secret(): string {
  const v = read(keys.apiKey);
  if (!v) return "";
  try {
    return decryptSecret(v);
  } catch {
    return "";
  }
}

export function getGoogleSettings(): GoogleSettings {
  return {
    baseUrl: read(keys.baseUrl) ?? "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: secret(),
    model: read(keys.model) ?? "gemini-2.5-flash",
  };
}

export function isGoogleConfigured(s = getGoogleSettings()): boolean {
  return Boolean(s.apiKey);
}

export function updateGoogleSettings(update: Partial<GoogleSettings>): GoogleSettings {
  for (const [name, value] of Object.entries(update)) {
    if (value === undefined) continue;
    const key = keys[name as keyof typeof keys];
    if (!key) continue;
    if (value === "") {
      db.prepare("DELETE FROM runtime_settings WHERE key = ?").run(key);
    } else {
      set.run(key, name === "apiKey" ? encryptSecret(value) : value);
    }
  }
  return getGoogleSettings();
}

export function getGoogleSettingsForApi() {
  const s = getGoogleSettings();
  return {
    baseUrl: s.baseUrl,
    model: s.model,
    apiKeyMasked: maskSecret(s.apiKey),
    hasApiKey: Boolean(s.apiKey),
    configured: Boolean(s.apiKey),
  };
}
