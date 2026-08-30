import { db } from "../conversation/database.js";
import { env } from "./env.js";
import { decryptSecret, encryptSecret } from "./secret-cipher.js";
import { getEffectiveLlmSettings } from "./runtime-llm-settings.js";

export type VideoGenSettings = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

const KEYS = {
  model: "video_gen_model",
  apiKey: "video_gen_api_key",
} as const;

const getStmt = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const setStmt = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const delStmt = db.prepare("DELETE FROM runtime_settings WHERE key = ?");

function read(key: string): string | undefined {
  return (getStmt.get(key) as { value: string } | undefined)?.value;
}

function readApiKey(): string {
  const stored = read(KEYS.apiKey);
  if (stored) {
    try {
      return decryptSecret(stored);
    } catch {
      // Ignore decryption failure
    }
  }
  if (env.VIDEO_GEN_API_KEY) {
    return env.VIDEO_GEN_API_KEY;
  }
  try {
    const llm = getEffectiveLlmSettings();
    if (llm.apiKey) {
      return llm.apiKey;
    }
  } catch {
    // Không để lỗi thoát ra
  }
  return "";
}

export function getVideoSettings(): VideoGenSettings {
  return {
    model: read(KEYS.model) ?? (env.VIDEO_GEN_MODEL || "veo-3.0-generate-preview"),
    apiKey: readApiKey(),
    baseUrl: (read("video_gen_base_url") ?? env.LLM_BASE_URL ?? "").replace(/\/$/, ""),
  };
}

export function isVideoGenConfigured(settings = getVideoSettings()): boolean {
  return Boolean(settings.apiKey);
}

export type VideoGenSettingsUpdate = {
  model?: string;
  apiKey?: string;
};

export function updateVideoSettings(update: VideoGenSettingsUpdate): VideoGenSettings {
  if (update.model !== undefined) {
    if (update.model === "") delStmt.run(KEYS.model);
    else setStmt.run(KEYS.model, update.model);
  }
  if (update.apiKey !== undefined) {
    if (update.apiKey === "") delStmt.run(KEYS.apiKey);
    else setStmt.run(KEYS.apiKey, encryptSecret(update.apiKey));
  }
  return getVideoSettings();
}
