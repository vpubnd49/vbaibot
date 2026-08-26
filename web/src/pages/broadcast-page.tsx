import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type AccountInfo,
  type BroadcastLogItem,
  type BroadcastSendResult,
  type BroadcastTargetItem,
  type BroadcastTemplateItem,
} from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { AccountFilter } from "../shared/account-filter";
import { IconMegaphone } from "../shared/dashboard-icons";
import { Badge, formatTime, InitialAvatar } from "../shared/ui-bits";

export function BroadcastPage({ accounts }: { accounts: AccountInfo[] }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || "");
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

  // Load templates on mount
  useEffect(() => {
    api.broadcast
      .templates()
      .then((res) => {
        setTemplates(res.templates);
        if (res.templates.length > 0 && !message) {
          const def = res.templates[0]!;
          setSelectedTemplateId(def.id);
          setMessage(def.content);
        }
      })
      .catch(() => {});
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
      .history(selectedAccountId, 50)
      .then((res) => setHistoryLogs(res.items))
      .catch(() => setHistoryLogs([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedAccountId]);

  useEffect(() => {
    if (viewTab === "history") {
      loadHistory();
    }
  }, [viewTab, loadHistory]);

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

    const confirmMsg = `Bạn có chắc chắn muốn gửi thông báo này đến ${selectedThreadIds.size} nhóm/người nhận đã chọn không?\n\n(Hệ thống sẽ gửi tuần tự an toàn để bảo vệ tài khoản)`;
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

  const renderPreview = (text: string) => {
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
    <div className="space-y-6">
      <PageHeader
        icon={IconMegaphone}
        title="Thông báo & Nâng cấp"
        subtitle="Soạn thảo và phát tin giới thiệu tính năng mới đến từng nhóm chat cụ thể trên Zalo"
        aside={
          <div className="flex rounded-xl border border-line p-1 bg-tile">
            <button
              type="button"
              onClick={() => setViewTab("compose")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewTab === "compose" ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              ✏️ Soạn thông báo mới
            </button>
            <button
              type="button"
              onClick={() => setViewTab("history")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewTab === "history" ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              📜 Lịch sử đã gửi
            </button>
          </div>
        }
      />

      {viewTab === "history" ? (
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <h2 className="text-base font-semibold text-ink">Nhật ký các đợt phát tin thông báo</h2>
            <button
              type="button"
              onClick={loadHistory}
              className="text-xs text-zalo-600 hover:text-zalo-700 font-medium"
            >
              🔄 Tải lại
            </button>
          </div>

          <div className="mt-4">
            {loadingHistory ? (
              <div className="py-12 text-center text-sm text-ink-soft">Đang tải lịch sử...</div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-soft">Chưa có lịch sử gửi thông báo nào.</div>
            ) : (
              <div className="divide-y divide-line/60">
                {historyLogs.map((log) => (
                  <div key={log.id} className="py-3.5 first:pt-0 last:pb-0">
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
                    <p className="mt-2 text-xs text-ink/80 whitespace-pre-wrap bg-tile p-3 rounded-xl border border-line/60">
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột 1: Danh sách nhóm (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-line bg-surface p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <span>1. Chọn nhóm nhận tin</span>
                  <span className="text-xs font-normal text-ink-soft bg-tile px-2 py-0.5 rounded-full border border-line">
                    Đã chọn {selectedThreadIds.size}
                  </span>
                </h2>
                <p className="text-[12px] text-ink-soft mt-0.5">Tích chọn các nhóm chat bạn muốn gửi thông báo</p>
              </div>
            </div>

            {/* Account Selector */}
            {accounts.length > 1 && (
              <AccountFilter accounts={accounts} value={selectedAccountId} onChange={setSelectedAccountId} />
            )}

            {/* Filters */}
            <div className="space-y-2.5 pt-2 border-t border-line/60">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType("group")}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    filterType === "group"
                      ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300 font-semibold"
                      : "bg-tile border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  👥 Nhóm chat ({targets.filter((t) => t.threadType === 1).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("direct")}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    filterType === "direct"
                      ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300 font-semibold"
                      : "bg-tile border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  👤 Chat 1-1 ({targets.filter((t) => t.threadType === 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    filterType === "all"
                      ? "bg-zalo-50 border-zalo-200 text-zalo-700 dark:bg-zalo-950/40 dark:text-zalo-300 font-semibold"
                      : "bg-tile border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  Tất cả ({targets.length})
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-ink-soft">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={botEnabledOnly}
                    onChange={(e) => setBotEnabledOnly(e.target.checked)}
                    className="rounded border-line"
                  />
                  Chỉ nhóm đang bật Bot
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
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
                className="w-full text-xs rounded-xl border border-line bg-tile px-3 py-2 text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-zalo-500"
              />
            </div>

            {/* List & Select All */}
            <div className="rounded-xl border border-line overflow-hidden bg-tile/30">
              <div className="flex items-center justify-between px-3 py-2 bg-tile border-b border-line text-xs">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-zalo-600 hover:text-zalo-700 font-semibold text-xs"
                >
                  {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả đang lọc"}
                </button>
                <span className="text-xs text-ink-soft">
                  {selectedThreadIds.size}/{filteredIds.length} đã chọn
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-line/50">
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
                        className={`flex items-center gap-3 px-3 py-2.5 text-xs cursor-pointer hover:bg-tile transition-colors ${
                          isSelected ? "bg-zalo-50/70 dark:bg-zalo-950/20" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-line shrink-0"
                        />
                        <InitialAvatar name={t.displayName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-ink truncate text-[13px]">{t.displayName}</span>
                            {!t.botEnabled && (
                              <span className="shrink-0 text-[10px] text-ink-soft bg-tile px-1.5 py-0.5 rounded border border-line">
                                Tắt bot
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-ink-soft mt-0.5">
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
          </div>

          {/* Cột 2: Khung Soạn thảo & Xem trước (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-line bg-surface p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-ink">2. Soạn nội dung thông báo</h2>
              <p className="text-[12px] text-ink-soft mt-0.5">
                Chọn mẫu có sẵn hoặc chỉnh sửa nội dung bài viết gửi đến Zalo
              </p>
            </div>

            {/* Presets */}
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1.5">Mẫu thông báo có sẵn:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      selectedTemplateId === tpl.id
                        ? "border-zalo-500 bg-zalo-50/60 dark:bg-zalo-950/30 text-ink font-semibold shadow-xs"
                        : "border-line bg-tile hover:bg-surface text-ink-soft"
                    }`}
                  >
                    <div className="font-semibold text-xs truncate text-ink">{tpl.title}</div>
                    <div className="text-[10px] text-ink-soft truncate mt-0.5">{tpl.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Khung soạn thảo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-ink">Khung tạo nội dung thông báo:</label>
                <span className="text-ink-soft font-mono text-[11px]">{message.length} ký tự</span>
              </div>
              <textarea
                rows={10}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setSelectedTemplateId("");
                }}
                placeholder="Nhập nội dung thông báo cập nhật gửi đến các nhóm..."
                className="w-full text-xs font-mono rounded-xl border border-line bg-tile/40 p-3.5 text-ink focus:outline-none focus:border-zalo-500 focus:bg-surface transition-all leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft pt-1">
                <span>Cú pháp màu:</span>
                <code className="bg-tile px-1.5 py-0.5 rounded border border-line text-red-500">&lt;do&gt;chữ đỏ&lt;/do&gt;</code>
                <code className="bg-tile px-1.5 py-0.5 rounded border border-line text-amber-500">&lt;cam&gt;chữ cam&lt;/cam&gt;</code>
                <code className="bg-tile px-1.5 py-0.5 rounded border border-line text-emerald-500">&lt;xanh&gt;chữ xanh&lt;/xanh&gt;</code>
                <code className="bg-tile px-1.5 py-0.5 rounded border border-line font-bold">**in đậm**</code>
              </div>
            </div>

            {/* Live Preview */}
            <div className="rounded-xl border border-line bg-tile/20 p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-xs font-semibold text-ink-soft">
                <span>📱 Xem trước hiển thị trên Zalo (Live Preview):</span>
                <span className="text-[10px] font-normal bg-zalo-50 text-zalo-700 px-2 py-0.5 rounded-full border border-zalo-100">
                  Chuẩn format Zalo
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto pr-1">
                {message.trim() ? (
                  renderPreview(message)
                ) : (
                  <span className="text-xs text-ink-soft italic">Chưa có nội dung soạn thảo...</span>
                )}
              </div>
            </div>

            {/* Status alerts */}
            {sendError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-300">
                ❌ {sendError}
              </div>
            )}

            {sendResult && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300">
                ✅ <strong>Đã gửi thành công:</strong> {sendResult.succeeded}/{sendResult.total} nhóm
                {sendResult.failed > 0 && ` (${sendResult.failed} thất bại)`}.
              </div>
            )}

            {/* Action button */}
            <div className="pt-2 flex items-center justify-between border-t border-line/60">
              <span className="text-xs text-ink-soft">
                Sẽ gửi đến <strong className="text-ink">{selectedThreadIds.size}</strong> nhóm/người nhận
              </span>

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || selectedThreadIds.size === 0 || !message.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zalo-600 hover:bg-zalo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                {isSending ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Đang gửi tuần tự...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Gửi thông báo ngay ({selectedThreadIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
