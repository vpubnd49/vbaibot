import { useEffect, useState } from "react";
import { SecretInput } from "../shared/secret-input";
import { api, type KieSettings, type GoogleSettings } from "../dashboard-api-client";

export function SupplementaryProviders() {
  const [kie, setKie] = useState<KieSettings | null>(null);
  const [kieForm, setKieForm] = useState({ baseUrl: "", apiKey: "", imageModel: "", videoModel: "", musicModel: "" });
  const [kieStatus, setKieStatus] = useState<string>("");

  const [google, setGoogle] = useState<GoogleSettings | null>(null);
  const [googleForm, setGoogleForm] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [googleStatus, setGoogleStatus] = useState<string>("");

  useEffect(() => {
    api.kie().then((s) => {
      setKie(s);
      setKieForm({ baseUrl: s.baseUrl, apiKey: "", imageModel: s.imageModel, videoModel: s.videoModel, musicModel: s.musicModel });
    }).catch(() => undefined);

    api.google().then((s) => {
      setGoogle(s);
      setGoogleForm({ baseUrl: s.baseUrl, apiKey: "", model: s.model });
    }).catch(() => undefined);
  }, []);

  async function saveKie() {
    setKieStatus("");
    try {
      const s = await api.updateKie({ ...kieForm, apiKey: kieForm.apiKey || undefined });
      setKie(s);
      setKieForm({ ...kieForm, apiKey: "" });
      setKieStatus("Đã lưu cấu hình KIE");
    } catch {
      setKieStatus("Lưu cấu hình KIE thất bại");
    }
  }

  async function saveGoogle() {
    setGoogleStatus("");
    try {
      const s = await api.updateGoogle({ ...googleForm, apiKey: googleForm.apiKey || undefined });
      setGoogle(s);
      setGoogleForm({ ...googleForm, apiKey: "" });
      setGoogleStatus("Đã lưu cấu hình Google Gemini bổ sung");
    } catch {
      setGoogleStatus("Lưu cấu hình Google thất bại");
    }
  }

  return (
    <div className="mt-8 space-y-8 border-t border-line pt-6">
      {google && (
        <div className="space-y-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Provider bổ sung: Google Gemini</h3>
            <p className="mt-1 text-[12px] text-ink-soft">
              Dùng cho các chức năng bổ sung: bóc băng Speech-to-Text, nhận diện hình ảnh/OCR, trích xuất file scan.
              Không ảnh hưởng đến LLM chat chính. Key được mã hóa AES-256-GCM.
            </p>
          </div>
          <input
            className="gc-input w-full"
            value={googleForm.baseUrl}
            onChange={(e) => setGoogleForm({ ...googleForm, baseUrl: e.target.value })}
            placeholder="Base URL Google"
          />
          <input
            className="gc-input w-full"
            value={googleForm.model}
            onChange={(e) => setGoogleForm({ ...googleForm, model: e.target.value })}
            placeholder="Model Google (vd: gemini-2.5-flash)"
          />
          <SecretInput
            id="google-api-key"
            value={googleForm.apiKey}
            onChange={(apiKey) => setGoogleForm({ ...googleForm, apiKey })}
            placeholder={`Bỏ trống để giữ key (${google.apiKeyMasked})`}
          />
          <button
            onClick={saveGoogle}
            className="rounded-lg bg-zalo-500 px-4 py-2 text-[14px] font-medium text-white hover:bg-zalo-600"
          >
            Lưu provider Google bổ sung
          </button>
          {googleStatus && <p className="text-[13px] text-emerald-600">{googleStatus}</p>}
        </div>
      )}

      {kie && (
        <div className="space-y-3 border-t border-line pt-6">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Provider phụ: KIE.ai</h3>
            <p className="mt-1 text-[12px] text-ink-soft">
              Lưu một key dùng cho model tạo ảnh, video và nhạc. Key được mã hóa và không hiển thị đầy đủ.
            </p>
          </div>
          <input
            className="gc-input w-full"
            value={kieForm.baseUrl}
            onChange={(e) => setKieForm({ ...kieForm, baseUrl: e.target.value })}
            placeholder="Base URL KIE"
          />
          <SecretInput
            id="kie-api-key"
            value={kieForm.apiKey}
            onChange={(apiKey) => setKieForm({ ...kieForm, apiKey })}
            placeholder={`Bỏ trống để giữ key (${kie.apiKeyMasked})`}
          />
          <input
            className="gc-input w-full"
            value={kieForm.imageModel}
            onChange={(e) => setKieForm({ ...kieForm, imageModel: e.target.value })}
            placeholder="Model tạo ảnh"
          />
          <input
            className="gc-input w-full"
            value={kieForm.videoModel}
            onChange={(e) => setKieForm({ ...kieForm, videoModel: e.target.value })}
            placeholder="Model tạo video"
          />
          <input
            className="gc-input w-full"
            value={kieForm.musicModel}
            onChange={(e) => setKieForm({ ...kieForm, musicModel: e.target.value })}
            placeholder="Model tạo nhạc"
          />
          <button
            onClick={saveKie}
            className="rounded-lg bg-zalo-500 px-4 py-2 text-[14px] font-medium text-white hover:bg-zalo-600"
          >
            Lưu provider KIE
          </button>
          {kieStatus && <p className="text-[13px] text-emerald-600">{kieStatus}</p>}
        </div>
      )}
    </div>
  );
}
