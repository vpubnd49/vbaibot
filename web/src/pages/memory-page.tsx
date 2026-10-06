import { useCallback, useEffect, useState } from "react";
import type { AccountInfo, MemoryFactItem } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconBrain } from "../shared/dashboard-icons";
import { AccountFilter, accountLabel } from "../shared/account-filter";
import { Badge, EmptyRow, formatTime, ListToolbar, TableShell } from "../shared/ui-bits";

export function MemoryPage({ accounts }: { accounts: AccountInfo[] }) {
  const [items, setItems] = useState<MemoryFactItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [page, setPage] = useState(0);

  const showAccountColumn = accounts.length > 1;

  const reload = useCallback(() => {
    api
      .memories(accountFilter, query, page)
      .then((data) => {
        setItems(data.items);
        setHasMore(data.hasMore);
      })
      .catch(() => setItems([]));
  }, [accountFilter, query, page]);

  useEffect(reload, [reload]);
  useEffect(() => setPage(0), [accountFilter, query]);

  async function remove(fact: MemoryFactItem) {
    await api.deleteMemory(fact.accountId, fact.id);
    reload();
  }

  return (
    <div>
      <PageHeader
        icon={IconBrain}
        title="Trí nhớ dài hạn"
        subtitle="Thông tin bot tự động ghi nhớ qua tương tác — phân lập an toàn, dữ liệu cá nhân không bao giờ rò rỉ sang nhóm chung"
      />

      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Tìm trong nội dung trí nhớ hoặc ID người dùng..."
        filter={<AccountFilter accounts={accounts} value={accountFilter} onChange={setAccountFilter} />}
        page={page}
        hasMore={hasMore}
        onPage={setPage}
      />

      <TableShell
        headers={
          showAccountColumn
            ? ["Nội dung ghi nhớ (Fact)", "Tài khoản", "Đối tượng (Subject)", "Nguồn học", "Thời điểm", "Thao tác"]
            : ["Nội dung ghi nhớ (Fact)", "Đối tượng (Subject)", "Nguồn học", "Thời điểm", "Thao tác"]
        }
        minWidth={showAccountColumn ? 920 : 820}
      >
        {items.length === 0 && (
          <EmptyRow colSpan={showAccountColumn ? 6 : 5} text="Bot chưa ghi nhớ dữ liệu nào theo bộ lọc" />
        )}
        {items.map((m) => (
          <tr key={m.id} className="hover:bg-tile/40 transition-colors">
            <td className="max-w-md px-4 py-3.5 text-ink leading-relaxed font-normal">{m.content}</td>
            {showAccountColumn && (
              <td className="px-4 py-3.5">
                <Badge tone="gray" dot={false}>{accountLabel(accounts, m.accountId)}</Badge>
              </td>
            )}
            <td className="px-4 py-3.5 font-mono text-xs text-ink-soft">{m.subjectId}</td>
            <td className="px-4 py-3.5">
              <Badge tone={m.learnedInGroup ? "amber" : "blue"} dot={false}>
                {m.learnedInGroup ? "👥 Nhóm" : "👤 Chat riêng"}
              </Badge>
            </td>
            <td className="px-4 py-3.5 text-xs text-ink-soft">{formatTime(m.createdAt)}</td>
            <td className="px-4 py-3.5 text-right">
              <button
                onClick={() => remove(m)}
                className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-all"
              >
                Xóa
              </button>
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
