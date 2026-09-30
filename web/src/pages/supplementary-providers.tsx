import { useEffect, useState } from "react";
import { SecretInput } from "../shared/secret-input";
import { api, type GoogleSettings, type ImageGenSettings } from "../dashboard-api-client";

/** Trạng thái TTS đọc từ runtime_settings DB */
type TtsInfo = { model: string };

export function SupplementaryProviders() {
  const [google, setGoogle] = useState<GoogleSettings | null>(null);
  const [googleForm, setGoogleForm] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [googleStatus, setGoogleStatus] = useState<string>("");

  const [imageGen, setImageGen] = useState<ImageGenSettings | null>(null);
  const [imageForm, setImageForm] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [imageStatus, setImageStatus] = useState<string>("");

  const [tts, setTts] = useState<TtsInfo | null>(null);
  const [ttsForm, setTtsForm] = useState({ model: "" });
  const [ttsStatus, setTtsStatus] = useState<string>("");

  useEffect(() => {
    api.google().then((s) => {
      setGoogle(s);
      setGoogleForm({ baseUrl: s.baseUrl, apiKey: "", model: s.model });
    }).catch(() => undefined);

    api.imageGen().then((s) => {
      setImageGen(s);
      setImageForm({ baseUrl: s.baseUrl, apiKey: "", model: s.model });
    }).catch(() => undefined);

    // TTS model: đọc trực tiếp từ runtime_settings
    fetch("/api/settings/tts", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setTts(d); setTtsForm({ model: d.model || "" }); } })
      .catch(() => undefined);
  }, []);

  async function saveGoogle() {
    setGoogleStatus("");
    try {
      const s = await api.updateGoogle({ ...googleForm, apiKey: googleForm.apiKey || undefined });
      setGoogle(s);
      setGoogleForm({ ...googleForm, apiKey: "" });
      setGoogleStatus("✓ Đã lưu");
    } catch {
      setGoogleStatus("✗ Lưu thất bại");
    }
  }

  async function saveImage() {
    setImageStatus("");
    try {
      const s = await api.updateImageGen({ ...imageForm, apiKey: imageForm.apiKey || undefined });
      setImageGen(s);
      setImageForm({ ...imageForm, apiKey: "" });
      setImageStatus("✓ Đã lưu");
    } catch {
      setImageStatus("✗ Lưu thất bại");
    }
  }

  async function saveTts() {
    setTtsStatus("");
    try {
      await fetch("/api/settings/tts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ttsForm.model }),
      });
      setTts({ model: ttsForm.model });
      setTtsStatus("✓ Đã lưu");
    } catch {
      setTtsStatus("✗ Lưu thất bại");
    }
  }

  return (
    <div className="mt-8 space-y-6 border-t border-line pt-6">
      {/* ─── Tạo ảnh ─── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
            <span className="text-base">🖼️</span> Tạo ảnh
          </h3>
          <p className="mt-1 text-[12px] text-ink-soft">
            Model vẽ ảnh (GPT Image 2). Dùng chung API key và Base URL với LLM chính nếu bỏ trống.
          </p>
        </div>
        {imageGen && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-soft">Base URL</label>
                <input
                  className="gc-input w-full"
                  value={imageForm.baseUrl}
                  onChange={(e) => setImageForm({ ...imageForm, baseUrl: e.target.value })}
                  placeholder="Bỏ trống = dùng chung LLM"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-soft">Model</label>
                <input
                  className="gc-input w-full"
                  value={imageForm.model}
                  onChange={(e) => setImageForm({ ...imageForm, model: e.target.value })}
                  placeholder="gpt-image-2"
                />
              </div>
            </div>
            <SecretInput
              id="img-api-key"
              value={imageForm.apiKey}
              onChange={(apiKey) => setImageForm({ ...imageForm, apiKey })}
              placeholder={`Bỏ trống để giữ key (${imageGen.apiKeyMasked})`}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveImage}
                className="rounded-lg bg-zalo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-zalo-600"
              >
                Lưu
              </button>
              {imageStatus && (
                <span className={`text-[13px] ${imageStatus.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                  {imageStatus}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── TTS (Text-to-Speech) ─── */}
      <div className="space-y-3 border-t border-line pt-6">
        <div>
          <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
            <span className="text-base">🔊</span> Đọc văn bản (TTS)
          </h3>
          <p className="mt-1 text-[12px] text-ink-soft">
            Model chuyển văn bản thành giọng nói. Dùng chung API key và Base URL với LLM chính.
          </p>
        </div>
        {tts !== null && (
          <>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-soft">Model</label>
              <input
                className="gc-input w-full"
                value={ttsForm.model}
                onChange={(e) => setTtsForm({ model: e.target.value })}
                placeholder="tts-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveTts}
                className="rounded-lg bg-zalo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-zalo-600"
              >
                Lưu
              </button>
              {ttsStatus && (
                <span className={`text-[13px] ${ttsStatus.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                  {ttsStatus}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Google Gemini bổ sung ─── */}
      {google && (
        <div className="space-y-3 border-t border-line pt-6">
          <div>
            <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
              <span className="text-base">⚡</span> Provider bổ sung: Backup
            </h3>
            <p className="mt-1 text-[12px] text-ink-soft">
              Dùng cho chức năng dự phòng: bóc băng STT, OCR, trích xuất scan. Không ảnh hưởng LLM chat chính.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-soft">Base URL</label>
              <input
                className="gc-input w-full"
                value={googleForm.baseUrl}
                onChange={(e) => setGoogleForm({ ...googleForm, baseUrl: e.target.value })}
                placeholder="Base URL Google"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-soft">Model</label>
              <input
                className="gc-input w-full"
                value={googleForm.model}
                onChange={(e) => setGoogleForm({ ...googleForm, model: e.target.value })}
                placeholder="deepseek-v4-flash"
              />
            </div>
          </div>
          <SecretInput
            id="google-api-key"
            value={googleForm.apiKey}
            onChange={(apiKey) => setGoogleForm({ ...googleForm, apiKey })}
            placeholder={`Bỏ trống để giữ key (${google.apiKeyMasked})`}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={saveGoogle}
              className="rounded-lg bg-zalo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-zalo-600"
            >
              Lưu
            </button>
            {googleStatus && (
              <span className={`text-[13px] ${googleStatus.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                {googleStatus}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
