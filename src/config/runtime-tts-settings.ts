import { db } from "../conversation/database.js";
import { env } from "./env.js";
import { decryptSecret, encryptSecret } from "./secret-cipher.js";

/**
 * Cấu hình Text-to-Speech (TTS) cho tính năng voice podcast.
 *
 * Theo đúng kiến trúc của `runtime-vision-settings.ts`: ưu tiên DB → env,
 * key mã hóa AES-256-GCM, dashboard sửa được.
 *
 * Dùng Gemini Flash TTS làm mặc định. Nếu bot đang chạy provider "google"
 * thì tái sử dụng API key đó; nếu không thì cần set riêng TTS_API_KEY.
 */

export type TtsSettings = {
  /** Model Gemini TTS */
  model: string;
  /** API key (tái sử dụng từ LLM settings nếu provider là google, hoặc key riêng) */
  apiKey: string;
  /** URL công khai của server để Zalo tải file audio (VD: https://bot.example.com) */
  publicBaseUrl: string;
  /** Giọng nam (Gemini voice name) */
  maleVoice: string;
  /** Giọng nữ (Gemini voice name) */
  femaleVoice: string;
  /** Tên host nam trong podcast */
  hostMaleName: string;
  /** Tên host nữ trong podcast */
  hostFemaleName: string;
};

const KEYS = {
  model: "tts_model",
  apiKey: "tts_api_key",
  publicBaseUrl: "tts_public_base_url",
  maleVoice: "tts_male_voice",
  femaleVoice: "tts_female_voice",
  hostMaleName: "tts_host_male_name",
  hostFemaleName: "tts_host_female_name",
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

import { getEffectiveLlmSettings } from "./runtime-llm-settings.js";

function readApiKey(): string {
  const stored = read(KEYS.apiKey);
  if (stored) {
    try {
      return decryptSecret(stored);
    } catch {
      // Ignore decryption failure
    }
  }
  if (env.TTS_API_KEY) {
    return env.TTS_API_KEY;
  }
  // Fallback: Tự động dùng API key từ cấu hình LLM đang hoạt động (kể cả lưu trong DB)
  try {
    const llm = getEffectiveLlmSettings();
    if (llm.apiKey && (llm.provider === "google" || llm.apiKey.startsWith("AIza"))) {
      return llm.apiKey;
    }
  } catch {
    // Không để lỗi thoát ra
  }
  return "";
}

export function getTtsSettings(): TtsSettings {
  return {
    model: read(KEYS.model) ?? env.TTS_MODEL,
    apiKey: readApiKey(),
    publicBaseUrl: (read(KEYS.publicBaseUrl) ?? env.TTS_PUBLIC_BASE_URL).replace(/\/$/, ""),
    maleVoice: read(KEYS.maleVoice) ?? env.TTS_MALE_VOICE,
    femaleVoice: read(KEYS.femaleVoice) ?? env.TTS_FEMALE_VOICE,
    hostMaleName: read(KEYS.hostMaleName) ?? env.TTS_HOST_MALE_NAME,
    hostFemaleName: read(KEYS.hostFemaleName) ?? env.TTS_HOST_FEMALE_NAME,
  };
}

export function isTtsConfigured(settings = getTtsSettings()): boolean {
  return Boolean(settings.apiKey && settings.publicBaseUrl);
}

export type TtsSettingsUpdate = {
  model?: string;
  apiKey?: string;
  publicBaseUrl?: string;
  maleVoice?: string;
  femaleVoice?: string;
  hostMaleName?: string;
  hostFemaleName?: string;
};

export function updateTtsSettings(update: TtsSettingsUpdate): TtsSettings {
  const pairs: [string, string | undefined][] = [
    [KEYS.model, update.model],
    [KEYS.publicBaseUrl, update.publicBaseUrl],
    [KEYS.maleVoice, update.maleVoice],
    [KEYS.femaleVoice, update.femaleVoice],
    [KEYS.hostMaleName, update.hostMaleName],
    [KEYS.hostFemaleName, update.hostFemaleName],
  ];
  for (const [key, value] of pairs) {
    if (value !== undefined) {
      if (value === "") delStmt.run(key);
      else setStmt.run(key, value);
    }
  }
  // API key mã hóa riêng
  if (update.apiKey !== undefined) {
    if (update.apiKey === "") delStmt.run(KEYS.apiKey);
    else setStmt.run(KEYS.apiKey, encryptSecret(update.apiKey));
  }
  return getTtsSettings();
}
