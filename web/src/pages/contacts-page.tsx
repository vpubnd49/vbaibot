import { useCallback, useEffect, useState } from "react";
import type { AccountInfo, ContactItem } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconUsers } from "../shared/dashboard-icons";
import { AccountFilter, accountLabel } from "../shared/account-filter";
import {
  Badge,
  EmptyRow,
  formatNumber,
  formatTime,
  InitialAvatar,
  ListToolbar,
  TableShell,
} from "../shared/ui-bits";

export function ContactsPage({ accounts }: { accounts: AccountInfo[] }) {
  const [items, setItems] = useState<ContactItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [page, setPage] = useState(0);

  const showAccountColumn = accounts.length > 1;

  const reload = useCallback(() => {
    api
      .contacts(accountFilter, query, page)
      .then((data) => {
        setItems(data.items);
        setHasMore(data.hasMore);
      })
      .catch(() => setItems([]));
  }, [accountFilter, query, page]);

  useEffect(reload, [reload]);
  useEffect(() => setPage(0), [accountFilter, query]);

  return (
    <div>
      <PageHeader
        icon={IconUsers}
        title="Danh bạ người dùng"
        subtitle="Hồ sơ người dùng và thành viên tự động đồng bộ từ các cuộc trò chuyện trên Zalo"
      />

      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Tìm theo tên hiển thị hoặc Zalo User ID..."
        filter={<AccountFilter accounts={accounts} value={accountFilter} onChange={setAccountFilter} />}
        page={page}
        hasMore={hasMore}
        onPage={setPage}
      />

      <TableShell
        headers={
          showAccountColumn
            ? ["Tên người dùng", "Tài khoản bot", "User ID", "Tổng số tin", "Tương tác đầu", "Tương tác gần nhất"]
            : ["Tên người dùng", "User ID", "Tổng số tin", "Tương tác đầu", "Tương tác gần nhất"]
        }
        minWidth={showAccountColumn ? 900 : 800}
      >
        {items.length === 0 && (
          <EmptyRow colSpan={showAccountColumn ? 6 : 5} text="Chưa có liên hệ nào trong danh bạ" />
        )}
        {items.map((contact) => (
          <tr
            key={`${contact.accountId}:${contact.userId}`}
            className="hover:bg-tile/40 transition-colors"
          >
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <InitialAvatar name={contact.displayName || contact.userId} />
                <span className="font-semibold text-ink text-[13.5px]">{contact.displayName || "(Chưa đặt tên)"}</span>
              </div>
            </td>
            {showAccountColumn && (
              <td className="px-4 py-3.5">
                <Badge tone="gray" dot={false}>{accountLabel(accounts, contact.accountId)}</Badge>
              </td>
            )}
            <td className="px-4 py-3.5 font-mono text-xs text-ink-soft">{contact.userId}</td>
            <td className="px-4 py-3.5 font-bold text-ink font-mono">{formatNumber(contact.messageCount)}</td>
            <td className="px-4 py-3.5 text-xs text-ink-soft">{formatTime(contact.firstSeen)}</td>
            <td className="px-4 py-3.5 text-xs text-ink font-medium">{formatTime(contact.lastSeen)}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
