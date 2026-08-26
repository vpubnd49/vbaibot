import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type AccountInfo,
  type BroadcastLogItem,
  type BroadcastSendResult,
  type BroadcastTargetItem,
  type BroadcastTemplateItem,
} from "../dashboard-api-client";
import { useChotNen } from "../shared/backdrop-close-guard";
import { Badge, formatTime, InitialAvatar } from "../shared/ui-bits";

export function BroadcastModal({
  accounts,
  initialAccountId,
  onClose,
}: {
  accounts: AccountInfo[];
  initialAccountId?: string;
  onClose: () => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || accounts[0]?.id || "",
  );
  const [targets, setTargets] = useState<BroadcastTargetItem[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplateItem[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"all" | "group" | "direct">("group");
  const [botEnabledOnly, setBotEnabledOnly] = useState(true);
  const [active7Days, setActive7Days] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<BroadcastSendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [viewTab, setViewTab] = useState<"compose" | "history">("compose");
  const [historyLogs, setHistoryLogs] = useState<BroadcastLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const nen = useChotNen(onClose);

  // Load templates on mount
  useEffect(() => {
    api.broadcast.templates().then((res) => {
      setTemplates(res.templates);
      if (res.templates.length > 0 && !message) {
        const def = res.templates[0]!;
        setSelectedTemplateId(def.id);
        setMessage(def.content);
      }
    }).catch(() => {});
  }, []);

  // Load targets when filters change
  const loadTargets = useCallback(() => {
    if (!selectedAccountId) return;
    setLoadingTargets(true);
    api.broadcast
      .targets({
        accountId: selectedAccountId,
        type: filterType,
        botEnabledOnly,
        activeWithinDays: active7Days ? 7 : undefined,
        q: searchQuery,
      })
      .then((res) => {
        setTargets(res.targets);
      })
      .catch(() => {
        setTargets([]);
      })
      .finally(() => {
        setLoadingTargets(false);
      });
  }, [selectedAccountId, filterType, botEnabledOnly, active7Days, searchQuery]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  // Load history when tab is history
  const loadHistory = useCallback(() => {
    if (!selectedAccountId) return;
    setLoadingHistory(true);
    api.broadcast
      .history(selectedAccountId, 30)
      .then((res) => setHistoryLogs(res.items))
      .catch(() => setHistoryLogs([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedAccountId]);

  useEffect(() => {
    if (viewTab === "history") {
      loadHistory();
    }
  }, [viewTab, loadHistory]);

  // Select all / Deselect all
  const filteredIds = useMemo(() => targets.map((t) => t.threadId), [targets]);

  const isAllSelected = useMemo(() => {
    if (filteredIds.length === 0) return false;
    return filteredIds.every((id) => selectedThreadIds.has(id));
  }, [filteredIds, selectedThreadIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedThreadIds);
      filteredIds.forEach((id) => next.delete(id));
      setSelectedThreadIds(next);
    } else {
      const next = new Set(selectedThreadIds);
      filteredIds.forEach((id) => next.add(id));
      setSelectedThreadIds(next);
    }
  };

  const toggleSelectThread = (threadId: string) => {
    const next = new Set(selectedThreadIds);
    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
    }
    setSelectedThreadIds(next);
  };

  const handleSelectTemplate = (tpl: BroadcastTemplateItem) => {
    setSelectedTemplateId(tpl.id);
    setMessage(tpl.content);
  };

  const handleSend = async () => {
    if (selectedThreadIds.size === 0) {
      alert("Vui lòng chọn ít nhất 1 nhóm hoặc người nhận.");
      return;
    }
    if (!message.trim()) {
      alert("Vui lòng nhập nội dung thông báo.");
      return;
    }

    const confirmMsg = `Bạn có chắc chắn muốn gửi thông báo này đến ${selectedThreadIds.size} nhóm/người nhận đã chọn không?\n\n(Hệ thống sẽ gửi tuần tự với khoảng cách an toàn để chống spam)`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSending(true);
    setSendResult(null);
    setSendError(null);

    try {
      const res = await api.broadcast.send({
        accountId: selectedAccountId,
        threadIds: Array.from(selectedThreadIds),
        message: message.trim(),
      });
      setSendResult(res.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSendError(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Live preview parser
  const renderPreview = (text: string) => {
    // Basic conversion for tags
    let formatted = text
      .replace(/<do>(.*?)<\/do>/g, '<span class="text-red-500 font-medium">$1</span>')
      .replace(/<cam>(.*?)<\/cam>/g, '<span class="text-amber-500 font-medium">$1</span>')
      .replace(/<vang>(.*?)<\/vang>/g, '<span class="text-yellow-500 font-medium">$1</span>')
      .replace(/<xanh>(.*?)<\/xanh>/g, '<span class="text-emerald-500 font-medium">$1</span>')
      .replace(/<gach>(.*?)<\/gach>/g, '<span class="underline">$1</span>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    return (
      <div
        className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90 font-sans"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      {...nen}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-surface p-6 shadow-2xl border border-line flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📢</span>
              <h2 className="text-[17px] font-bold text-ink">Gửi Thông Báo & Cập Nhật Tính Năng</h2>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Gửi bài giới thiệu tính năng ngắn gọn, đúng chuẩn định dạng Zalo đến các nhóm được chọn lọc.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-line p-0.5 bg-tile">
              <button
                type="button"
                onClick={() => setViewTab("compose")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewTab === "compose" ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                ✏️ Soạn thông báo
              </button>
              <button
                type="button"
                onClick={() => setViewTab("history")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewTab === "history" ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                📜 Lịch sử gửi
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-tile hover:text-ink transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {viewTab === "history" ? (
          /* History tab */
          <div className="flex-1 overflow-y-auto py-4">
            {loadingHistory ? (
              <div className="py-12 text-center text-sm text-ink-soft">Đang tải lịch sử...</div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-soft">Chưa có lịch sử gửi thông báo nào.</div>
            ) : (
              <div className="space-y-3">
                {historyLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-line bg-tile/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{log.threadName}</span>
                        <Badge tone={log.status === "success" ? "green" : "red"}>
                          {log.status === "success" ? "Thành công" : "Thất bại"}
                        </Badge>
                      </div>
                      <span className="text-xs text-ink-soft">{formatTime(log.createdAt)}</span>
                    </div>
                    {log.error && <p className="mt-1 text-xs text-red-500">Lỗi: {log.error}</p>}
                    <p className="mt-2 text-xs text-ink/80 whitespace-pre-wrap line-clamp-3 bg-surface p-2.5 rounded-lg border border-line/60">
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Compose & Target selection split */
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-6 py-4">
            {/* Left: Target Selection (5 cols) */}
            <div className="md:col-span-5 flex flex-col border border-line rounded-xl bg-tile/40 overflow-hidden">
              {/* Account & Filter bar */}
              <div className="p-3 border-b border-line bg-surface space-y-2.5">
                {accounts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-ink-soft shrink-0">Tài khoản:</label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => {
                        setSelectedAccountId(e.target.value);
                        setSelectedThreadIds(new Set());
                      }}
                      className="w-full text-xs rounded-lg border border-line bg-tile px-2 py-1 text-ink focus:outline-none"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} ({a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterType("group")}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${
                      filterType === "group"
                        ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300"
                        : "bg-surface border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    👥 Nhóm chat ({targets.filter((t) => t.threadType === 1).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("direct")}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${
                      filterType === "direct"
                        ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300"
                        : "bg-surface border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    👤 Chat 1-1 ({targets.filter((t) => t.threadType === 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${
                      filterType === "all"
                        ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300"
                        : "bg-surface border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    Tất cả ({targets.length})
                  </button>
                </div>

                {/* Toggle filters & search */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={botEnabledOnly}
                      onChange={(e) => setBotEnabledOnly(e.target.checked)}
                      className="rounded border-line"
                    />
                    Đang bật Bot
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={active7Days}
                      onChange={(e) => setActive7Days(e.target.checked)}
                      className="rounded border-line"
                    />
                    Tương tác 7 ngày qua
                  </label>
                </div>

                <input
                  type="text"
                  placeholder="Tìm tên nhóm hoặc ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs rounded-lg border border-line bg-tile px-2.5 py-1.5 text-ink placeholder:text-ink-soft/60 focus:outline-none"
                />
              </div>

              {/* Selection Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-tile border-b border-line text-xs">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-zalo-600 hover:text-zalo-700 font-medium text-[11px]"
                >
                  {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả đang lọc"}
                </button>
                <span className="text-[11px] text-ink-soft">
                  Đã chọn <strong className="text-ink">{selectedThreadIds.size}</strong> mục
                </span>
              </div>

              {/* Target List */}
              <div className="flex-1 overflow-y-auto divide-y divide-line/60">
                {loadingTargets ? (
                  <div className="py-8 text-center text-xs text-ink-soft">Đang lọc danh sách...</div>
                ) : targets.length === 0 ? (
                  <div className="py-8 text-center text-xs text-ink-soft">Không tìm thấy nhóm/người nhận nào.</div>
                ) : (
                  targets.map((t) => {
                    const isSelected = selectedThreadIds.has(t.threadId);
                    return (
                      <div
                        key={t.threadId}
                        onClick={() => toggleSelectThread(t.threadId)}
                        className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-tile transition-colors ${
                          isSelected ? "bg-zalo-50/60 dark:bg-zalo-950/20" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by parent div
                          className="rounded border-line shrink-0"
                        />
                        <InitialAvatar name={t.displayName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-ink truncate text-[12px]">{t.displayName}</span>
                            {!t.botEnabled && (
                              <span className="shrink-0 text-[10px] text-ink-soft bg-tile px-1 rounded">Tắt bot</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-ink-soft">
                            <span>{t.messageCount} tin</span>
                            {t.lastMessageAt && <span>• {formatTime(t.lastMessageAt)}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Message Editor & Preview (7 cols) */}
            <div className="md:col-span-7 flex flex-col space-y-3 overflow-y-auto">
              {/* Presets */}
              <div>
                <label className="text-xs font-semibold text-ink flex items-center justify-between">
                  <span>Mẫu thông báo có sẵn:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`text-left p-2 rounded-xl border text-xs transition-all ${
                        selectedTemplateId === tpl.id
                          ? "border-zalo-500 bg-zalo-50/50 dark:bg-zalo-950/30 text-ink font-medium shadow-xs"
                          : "border-line bg-tile hover:bg-surface text-ink-soft"
                      }`}
                    >
                      <div className="font-semibold text-[11px] truncate text-ink">{tpl.title}</div>
                      <div className="text-[10px] text-ink-soft truncate mt-0.5">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="flex flex-col flex-1">
                <label className="text-xs font-semibold text-ink mb-1 flex items-center justify-between">
                  <span>Nội dung thông báo (định dạng Zalo):</span>
                  <span className="text-[11px] font-normal text-ink-soft">{message.length} ký tự</span>
                </label>
                <textarea
                  rows={8}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setSelectedTemplateId("");
                  }}
                  placeholder="Nhập nội dung thông báo gửi đến các nhóm..."
                  className="w-full text-xs font-mono rounded-xl border border-line bg-tile/40 p-3 text-ink focus:outline-none focus:border-zalo-500 focus:bg-surface transition-all"
                />
                <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-soft">
                  <span>Mẹo định dạng:</span>
                  <code className="bg-tile px-1 rounded">&lt;do&gt;đỏ&lt;/do&gt;</code>
                  <code className="bg-tile px-1 rounded">&lt;cam&gt;cam&lt;/cam&gt;</code>
                  <code className="bg-tile px-1 rounded">&lt;xanh&gt;xanh lá&lt;/xanh&gt;</code>
                  <code className="bg-tile px-1 rounded">**in đậm**</code>
                </div>
              </div>

              {/* Live Preview */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-[11px] font-semibold text-ink-soft">
                  <span>📱 Xem trước hiển thị trên Zalo:</span>
                  <span className="text-[10px] font-normal bg-zalo-50 text-zalo-700 px-2 py-0.5 rounded-full border border-zalo-100">
                    Live Preview
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto pr-1">
                  {message.trim() ? (
                    renderPreview(message)
                  ) : (
                    <span className="text-xs text-ink-soft italic">Chưa có nội dung...</span>
                  )}
                </div>
              </div>

              {/* Status / Result alerts */}
              {sendError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-300">
                  ❌ {sendError}
                </div>
              )}

              {sendResult && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300">
                  ✅ <strong>Đã hoàn thành đợt gửi thông báo:</strong> Thành công {sendResult.succeeded}/
                  {sendResult.total} nhóm
                  {sendResult.failed > 0 && ` (${sendResult.failed} thất bại)`}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        {viewTab === "compose" && (
          <div className="flex items-center justify-between pt-4 border-t border-line mt-2">
            <div className="text-xs text-ink-soft">
              Đã chọn <strong className="text-ink">{selectedThreadIds.size}</strong> người nhận
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 rounded-xl border border-line text-xs font-medium text-ink hover:bg-tile transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || selectedThreadIds.size === 0 || !message.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-zalo-600 hover:bg-zalo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all"
              >
                {isSending ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Đang gửi tuần tự...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Gửi thông báo ({selectedThreadIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
