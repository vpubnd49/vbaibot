import { useEffect, useState } from "react";
import type { NotionSettings } from "../dashboard-api-client";
import { api, ApiError } from "../dashboard-api-client";
import { SecretInput } from "../shared/secret-input";
import { ToggleKnob } from "../shared/ui-bits";
import { ModalField, modalButton, ToolModalShell } from "./tool-settings-modal-shell";

export function NotionSettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [defaultDatabaseId, setDefaultDatabaseId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "green" | "red" | "blue"; text: string } | null>(null);

  useEffect(() => {
    api.getNotionSettings()
      .then((data: NotionSettings) => {
        setHasApiKey(data.hasApiKey);
        setMaskedKey(data.apiKeyMasked || "");
        setDefaultDatabaseId(data.defaultDatabaseId || "");
        setEnabled(data.enabled);
      })
      .catch((err) => {
        setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Không tải được cấu hình" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      await api.updateNotionSettings({
        apiKey: apiKey.trim() || undefined,
        defaultDatabaseId: defaultDatabaseId.trim(),
        enabled,
      });
      onSaved();
      onClose();
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Lưu thất bại" });
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setStatus({ tone: "blue", text: "Đang kiểm tra kết nối tới Notion API..." });
    try {
      const res = await api.testNotionConnection(apiKey.trim() || undefined);
      if (res.ok) {
        setStatus({
          tone: "green",
          text: `Kết nối thành công! Nhận diện bot Notion: "${res.botName || "Notion Bot"}" (${res.type || "bot"}).`,
        });
      } else {
        setStatus({ tone: "red", text: `Kiểm tra thất bại: ${res.error || "Không thể kết nối"}` });
      }
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Lỗi kiểm tra" });
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    if (!confirm("Bạn có chắc muốn xóa Notion API key hiện tại?")) return;
    setBusy(true);
    try {
      await api.updateNotionSettings({ clearKey: true, enabled: false });
      setHasApiKey(false);
      setMaskedKey("");
      setApiKey("");
      setEnabled(false);
      setStatus({ tone: "green", text: "Đã xóa API key Notion" });
      onSaved();
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Xóa thất bại" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModalShell
      title="Cài đặt Đồng bộ Notion (notion_sync)"
      subtitle="Kết nối Notion API để AI tạo trang, ghi chú và quản lý cơ sở dữ liệu Notion theo yêu cầu."
      onClose={onClose}
      footer={
        <>
          {hasApiKey && (
            <button
              type="button"
              onClick={clearKey}
              disabled={busy}
              className={modalButton.danger}
            >
              Xóa API Key
            </button>
          )}
          <button
            type="button"
            onClick={testConnection}
            disabled={busy || (!apiKey && !hasApiKey)}
            className={modalButton.secondary}
          >
            Kiểm tra kết nối
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={modalButton.cancel}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={modalButton.primary}
          >
            Lưu
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-tile p-3 text-[12px] leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">💡 Hướng dẫn tạo token kết nối Notion:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Vào{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                notion.so/my-integrations
              </a>{" "}
              tạo một Internal Integration để lấy <strong>Secret API Token</strong> (bắt đầu bằng <code className="text-accent">secret_...</code>).
            </li>
            <li>Mở trang Notion hoặc Database muốn bot truy cập, bấm dấu <strong>•••</strong> góc trên bên phải → <strong>Connections</strong> → Thêm integration vừa tạo.</li>
          </ol>
        </div>

        {loading ? (
          <p className="py-4 text-center text-ink-soft">Đang tải cấu hình...</p>
        ) : (
          <>
            <ModalField
              id="notion-api-key"
              label="Notion API Key (Integration Secret Token)"
              hint={
                hasApiKey
                  ? `Hiện tại: ${maskedKey}. Nhập key mới nếu muốn đổi, hoặc bấm "Xóa API Key".`
                  : "Chưa có key. Cần nhập token để công cụ có thể kích hoạt."
              }
            >
              <SecretInput
                id="notion-api-key"
                value={apiKey}
                onChange={setApiKey}
                placeholder={hasApiKey ? `Đang dùng key ${maskedKey}` : "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              />
            </ModalField>

            <ModalField
              id="notion-db-id"
              label="Default Database ID (Tùy chọn)"
              hint="ID database mặc định để bot lưu dữ liệu khi không chỉ định database cụ thể."
            >
              <input
                id="notion-db-id"
                type="text"
                value={defaultDatabaseId}
                onChange={(e) => setDefaultDatabaseId(e.target.value)}
                placeholder="Ví dụ: 1234567890abcdef1234567890abcdef"
                disabled={busy}
                className="gc-input w-full"
              />
            </ModalField>

            <div className="flex items-center justify-between rounded-xl bg-tile p-3">
              <div>
                <p className="text-[13px] font-medium text-ink">Bật tích hợp Notion</p>
                <p className="text-[12px] text-ink-soft">Cho phép AI gọi công cụ notion_sync trong các lượt chat</p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                disabled={busy}
                aria-label="Bật tắt Notion"
              >
                <ToggleKnob on={enabled} />
              </button>
            </div>

            {status && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-[13px] ${
                  status.tone === "green"
                    ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : status.tone === "red"
                    ? "border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                    : "border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                }`}
              >
                {status.text}
              </div>
            )}
          </>
        )}
      </div>
    </ToolModalShell>
  );
}
