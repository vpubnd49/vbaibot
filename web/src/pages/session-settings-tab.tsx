import { useEffect, useState } from "react";
import type { ThreadItem, ToolCatalogItem } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { ToggleKnob } from "../shared/ui-bits";

export function SessionSettingsTab({
  thread,
  onSaved,
}: {
  thread: ThreadItem;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tools, setTools] = useState<ToolCatalogItem[]>([]);

  const [botEnabled, setBotEnabled] = useState(thread.botEnabled);
  const [isVip, setIsVip] = useState(thread.isVip ?? false);
  const [customModel, setCustomModel] = useState("");
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getThreadSettings(thread.accountId, thread.threadId),
      api.tools().catch(() => ({ items: [] as ToolCatalogItem[] })),
    ])
      .then(([s, tRes]) => {
        if (cancelled) return;
        setBotEnabled(s.botEnabled);
        setIsVip(s.isVip);
        setCustomModel(s.customModel ?? "");
        setDisabledTools(s.disabledTools ?? []);
        setNotes(s.notes ?? "");
        setTools(tRes.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [thread.accountId, thread.threadId]);

  function toggleTool(key: string) {
    setDisabledTools((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateThreadSettings(thread.accountId, thread.threadId, {
        botEnabled,
        isVip,
        customModel: customModel.trim() || null,
        disabledTools,
        notes,
      });
      setSaveSuccess(true);
      onSaved?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-ink-soft">
        Đang tải cấu hình cuộc trò chuyện...
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto p-5 text-[13px]">
      {saveSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          ✓ Đã lưu cài đặt riêng cho cuộc trò chuyện này!
        </div>
      )}

      {/* Trạng thái Bot & VIP */}
      <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-ink">Phản hồi của Bot</div>
            <div className="text-[11.5px] text-ink-soft">Bật/tắt bot tự động trả lời cuộc trò chuyện này</div>
          </div>
          <button type="button" onClick={() => setBotEnabled((v) => !v)} className="cursor-pointer">
            <ToggleKnob on={botEnabled} />
          </button>
        </div>

        <div className="border-t border-line/60 pt-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <span>Đánh dấu VIP</span>
              <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[10px] font-bold text-amber-600">VIP</span>
            </div>
            <div className="text-[11.5px] text-ink-soft">Đánh dấu nhóm quan trọng hoặc khách hàng ưu tiên</div>
          </div>
          <button type="button" onClick={() => setIsVip((v) => !v)} className="cursor-pointer">
            <ToggleKnob on={isVip} />
          </button>
        </div>
      </div>

      {/* Model AI riêng */}
      <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-2 shadow-2xs">
        <label className="font-semibold text-ink block">Mô hình AI riêng (Model Override)</label>
        <p className="text-[11.5px] text-ink-soft">
          Đè lên model mặc định của Agent cho riêng cuộc chat này (để trống = dùng theo Agent).
        </p>
        <input
          type="text"
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          placeholder="vd: google/gemini-2.5-flash hoặc gpt-4o-mini"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs font-mono text-ink placeholder:text-ink-soft/50 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Tool bị tắt riêng */}
      <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-ink">Tắt công cụ cho cuộc chat này</label>
          <span className="text-[11px] text-ink-soft">
            Đã tắt {disabledTools.length} tool
          </span>
        </div>
        <p className="text-[11.5px] text-ink-soft">
          Chọn các công cụ mà bot KHÔNG được phép gọi khi trả lời trong cuộc trò chuyện này.
        </p>
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {tools.map((t) => {
            const isOff = disabledTools.includes(t.key);
            return (
              <label
                key={t.key}
                className="flex items-center justify-between rounded-lg border border-line/60 bg-surface/80 px-3 py-2 text-xs hover:bg-tile/50 cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-medium text-ink">{t.label || t.key}</div>
                  <div className="truncate text-[10.5px] text-ink-soft">{t.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={isOff}
                  onChange={() => toggleTool(t.key)}
                  className="cursor-pointer accent-rose-600"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Ghi chú nội bộ */}
      <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-2 shadow-2xs">
        <label className="font-semibold text-ink block">Ghi chú nội bộ</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ghi chú về nhóm/khách hàng này (chỉ xem trong trang quản trị)..."
          className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft/50 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      {/* Nút lưu */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gc-button-primary w-full justify-center py-2.5 text-xs font-semibold"
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt cuộc trò chuyện"}
        </button>
      </div>
    </div>
  );
}
