import { db } from "../conversation/database.js";
import { env } from "./env.js";
import { decryptSecret, encryptSecret } from "./secret-cipher.js";
import { getEffectiveLlmSettings } from "./runtime-llm-settings.js";
import { getKieSettings } from "./runtime-kie-settings.js";

export type MusicGenSettings = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxDurationSec: number;
  timeoutMs?: number;
};

const KEYS = {
  apiKey: "music_gen_api_key",
  model: "music_gen_model",
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
  if (env.MUSIC_GEN_API_KEY) {
    return env.MUSIC_GEN_API_KEY;
  }
  // Fallback: Tự động dùng API key từ cấu hình LLM đang hoạt động (kể cả router proxy)
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

export function getMusicSettings(): MusicGenSettings {
  return {
    apiKey: readApiKey(),
    model: read(KEYS.model) ?? env.MUSIC_GEN_MODEL,
    baseUrl: (read("music_gen_base_url") ?? env.LLM_BASE_URL ?? "").replace(/\/$/, ""),
    maxDurationSec: 180,
  };
}

export function isMusicGenConfigured(settings = getMusicSettings()): boolean {
  return Boolean(settings.apiKey);
}

export type MusicGenSettingsUpdate = {
  apiKey?: string;
  model?: string;
};

export function updateMusicSettings(update: MusicGenSettingsUpdate): MusicGenSettings {
  if (update.model !== undefined) {
    if (update.model === "") delStmt.run(KEYS.model);
    else setStmt.run(KEYS.model, update.model);
  }
  if (update.apiKey !== undefined) {
    if (update.apiKey === "") delStmt.run(KEYS.apiKey);
    else setStmt.run(KEYS.apiKey, encryptSecret(update.apiKey));
  }
  return getMusicSettings();
}

/**
 * KIE ưu tiên: trả cấu hình KIE cho nhạc nếu KIE đã đủ.
 */
export function getKieMusicConfig(): import("../music/kie-music-adapter.js").KieMusicConfig | null {
  try {
    const kie = getKieSettings();
    if (kie.baseUrl && kie.apiKey && kie.musicModel) {
      return { baseUrl: kie.baseUrl, apiKey: kie.apiKey, model: kie.musicModel };
    }
  } catch { /* bỏ qua */ }
  return null;
}
