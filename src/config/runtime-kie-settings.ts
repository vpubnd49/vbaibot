import { db } from "../conversation/database.js";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-cipher.js";

type KieSettings = { baseUrl: string; apiKey: string; imageModel: string; videoModel: string; musicModel: string };
const keys = { baseUrl: "kie_base_url", apiKey: "kie_api_key", imageModel: "kie_image_model", videoModel: "kie_video_model", musicModel: "kie_music_model" } as const;
const get = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const set = db.prepare("INSERT INTO runtime_settings (key,value,updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at");
function read(key: string) { return (get.get(key) as { value: string } | undefined)?.value; }
function secret() { const v = read(keys.apiKey); if (!v) return ""; try { return decryptSecret(v); } catch { return ""; } }
export function getKieSettings(): KieSettings { return { baseUrl: read(keys.baseUrl) ?? "", apiKey: secret(), imageModel: read(keys.imageModel) ?? "", videoModel: read(keys.videoModel) ?? "", musicModel: read(keys.musicModel) ?? "" }; }
export function updateKieSettings(update: Partial<KieSettings>) { for (const [name, value] of Object.entries(update)) { if (value === undefined) continue; const key = keys[name as keyof typeof keys]; if (!key) continue; if (value === "") db.prepare("DELETE FROM runtime_settings WHERE key = ?").run(key); else set.run(key, name === "apiKey" ? encryptSecret(value) : value); } return getKieSettings(); }
export function getKieSettingsForApi() { const s = getKieSettings(); return { baseUrl: s.baseUrl, apiKeyMasked: maskSecret(s.apiKey), hasApiKey: Boolean(s.apiKey), imageModel: s.imageModel, videoModel: s.videoModel, musicModel: s.musicModel, configured: Boolean(s.baseUrl && s.apiKey) }; }
