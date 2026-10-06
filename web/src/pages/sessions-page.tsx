import { useCallback, useEffect, useState } from "react";
import type { AccountInfo, ThreadItem } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconChat, IconMegaphone } from "../shared/dashboard-icons";
import { AccountFilter, accountLabel } from "../shared/account-filter";
import {
  Badge,
  EmptyRow,
  formatNumber,
  formatTime,
  InitialAvatar,
  ListToolbar,
  TableShell,
  ToggleKnob,
} from "../shared/ui-bits";
import { SessionDetailDrawer } from "./session-detail-drawer";
import { BroadcastModal } from "./broadcast-modal";

export function SessionsPage({ accounts }: { accounts: AccountInfo[] }) {
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [page, setPage] = useState(0);
  const [openThread, setOpenThread] = useState<ThreadItem | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const showAccountColumn = accounts.length > 1;

  const reload = useCallback(() => {
    api
      .threads(accountFilter, query, page)
      .then((data) => {
        setItems(data.items);
        setHasMore(data.hasMore);
      })
      .catch(() => setItems([]));
  }, [accountFilter, query, page]);

  useEffect(reload, [reload]);
  useEffect(() => setPage(0), [accountFilter, query]);

  async function toggleBot(t: ThreadItem) {
    await api.setBotEnabled(t.accountId, t.threadId, !t.botEnabled);
    reload();
  }

  return (
    <div>
      <PageHeader
        icon={IconChat}
        title="Phiên trò chuyện"
        subtitle="Quản lý ngữ cảnh và lịch sử hội thoại Zalo trực tiếp, tự động lưu trữ trong SQLite"
        aside={
          <button
            type="button"
            onClick={() => setShowBroadcast(true)}
            className="gc-button-primary text-xs py-2 px-3.5"
          >
            <IconMegaphone size={15} />
            <span>Gửi thông báo</span>
          </button>
        }
      />

      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Tìm theo tên hoặc thread ID..."
        filter={<AccountFilter accounts={accounts} value={accountFilter} onChange={setAccountFilter} />}
        page={page}
        hasMore={hasMore}
        onPage={setPage}
      />

      <TableShell
        headers={
          showAccountColumn
            ? ["Tên hội thoại", "Tài khoản", "Phân loại", "Số tin", "Tiêu thụ Token", "Tin cuối", "Trạng thái Bot", ""]
            : ["Tên hội thoại", "Phân loại", "Số tin", "Tiêu thụ Token", "Tin cuối", "Trạng thái Bot", ""]
        }
        minWidth={showAccountColumn ? 980 : 880}
      >
        {items.length === 0 && (
          <EmptyRow colSpan={showAccountColumn ? 8 : 7} text="Chưa có phiên trò chuyện nào" />
        )}
        {items.map((t) => (
          <tr
            key={`${t.accountId}:${t.threadId}`}
            className="hover:bg-tile/40 transition-colors"
          >
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <InitialAvatar name={t.displayName || t.threadId} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink text-[13.5px]">{t.displayName || t.threadId}</div>
                  <div className="truncate font-mono text-[11px] text-ink-soft/70">{t.threadId}</div>
                </div>
              </div>
            </td>
            {showAccountColumn && (
              <td className="px-4 py-3.5">
                <Badge tone="gray" dot={false}>{accountLabel(accounts, t.accountId)}</Badge>
              </td>
            )}
            <td className="px-4 py-3.5">
              <Badge tone={t.threadType === 1 ? "amber" : "blue"} dot={false}>
                {t.threadType === 1 ? "👥 Nhóm" : "👤 Trực tiếp"}
              </Badge>
            </td>
            <td className="px-4 py-3.5 font-medium text-ink">{formatNumber(t.messageCount)}</td>
            <td className="px-4 py-3.5 text-ink-soft">
              <span className="font-semibold text-ink font-mono text-[12.5px]">{formatNumber(t.usage.totalTokens)}</span>
              <span className="text-[11.5px] text-ink-soft/70"> ({t.usage.turns} lượt)</span>
            </td>
            <td className="px-4 py-3.5 text-xs text-ink-soft">{formatTime(t.lastMessageAt)}</td>
            <td className="px-4 py-3.5">
              <button
                onClick={() => toggleBot(t)}
                title={t.botEnabled ? "Bot đang hoạt động - Bấm để tạm dừng" : "Bot đang tắt - Bấm để kích hoạt"}
                className="flex items-center gap-1.5"
              >
                <ToggleKnob on={t.botEnabled} />
              </button>
            </td>
            <td className="px-4 py-3.5 text-right">
              <button
                onClick={() => setOpenThread(t)}
                className="rounded-lg border border-line bg-surface/90 px-3 py-1 text-xs font-semibold text-ink hover:border-blue-500/40 hover:text-blue-500 transition-all shadow-2xs"
              >
                Chi tiết
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {openThread && (
        <SessionDetailDrawer
          thread={openThread}
          onClose={() => setOpenThread(null)}
          onDoiDuLieu={reload}
        />
      )}

      {showBroadcast && (
        <BroadcastModal
          accounts={accounts}
          initialAccountId={accountFilter}
          onClose={() => setShowBroadcast(false)}
        />
      )}
    </div>
  );
}
