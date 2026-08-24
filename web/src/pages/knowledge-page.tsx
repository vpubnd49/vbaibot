import { useCallback, useEffect, useState } from "react";
import type { AccountInfo, SharedKnowledgeItem } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconCheck, IconDatabase, IconPlus } from "../shared/dashboard-icons";
import { AccountFilter } from "../shared/account-filter";
import { Badge, EmptyRow, formatTime, ListToolbar, TableShell } from "../shared/ui-bits";

const CATEGORY_LABELS: Record<string, { text: string; tone: "blue" | "amber" | "green" | "red" | "gray" }> = {
  legal: { text: "Pháp luật", tone: "blue" },
  policy: { text: "Chính sách", tone: "amber" },
  procedure: { text: "Quy trình", tone: "green" },
  correction: { text: "Đính chính", tone: "red" },
  general: { text: "Kiến thức", tone: "gray" },
};

const STATUS_LABELS: Record<string, { text: string; tone: "blue" | "amber" | "green" | "red" | "gray" }> = {
  pending: { text: "Chờ duyệt", tone: "amber" },
  approved: { text: "Đã duyệt", tone: "green" },
  rejected: { text: "Đã từ chối", tone: "red" },
};

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
];

export function KnowledgePage({ accounts }: { accounts: AccountInfo[] }) {
  const [items, setItems] = useState<SharedKnowledgeItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("general");
  const [newContent, setNewContent] = useState("");
  const [newSource, setNewSource] = useState("");
  const [busyApproveAll, setBusyApproveAll] = useState(false);

  const reload = useCallback(() => {
    const accId = accountFilter || (accounts.length === 1 ? accounts[0].id : "");
    if (!accId) return;
    api
      .knowledge(accId, statusFilter, query, page)
      .then((data) => {
        setItems(data.items);
        setHasMore(data.hasMore);
        setPendingCount(data.pendingCount);
      })
      .catch(() => setItems([]));
  }, [accountFilter, accounts, statusFilter, query, page]);

  useEffect(reload, [reload]);
  useEffect(() => setPage(0), [accountFilter, statusFilter, query]);

  // Auto-select first account
  useEffect(() => {
    if (!accountFilter && accounts.length === 1) setAccountFilter(accounts[0].id);
  }, [accounts, accountFilter]);

  async function approve(item: SharedKnowledgeItem) {
    await api.approveKnowledge(item.accountId, item.id);
    reload();
  }

  async function approveAll() {
    const accId = accountFilter || (accounts.length === 1 ? accounts[0].id : "");
    if (!accId) return;
    if (!confirm(`Duyệt tất cả ${pendingCount > 0 ? pendingCount + " mục" : ""} tri thức đang chờ?`)) return;
    setBusyApproveAll(true);
    try {
      await api.approveAllKnowledge(accId);
      reload();
    } finally {
      setBusyApproveAll(false);
    }
  }

  async function reject(item: SharedKnowledgeItem) {
    await api.rejectKnowledge(item.accountId, item.id);
    reload();
  }

  async function remove(item: SharedKnowledgeItem) {
    if (!confirm("Xóa tri thức này?")) return;
    await api.deleteKnowledge(item.accountId, item.id);
    reload();
  }

  async function addNew() {
    const accId = accountFilter || (accounts.length === 1 ? accounts[0].id : "");
    if (!accId || !newContent.trim()) return;
    const result = await api.addKnowledge(accId, newCategory, newContent.trim(), newSource.trim());
    if (result.ok) {
      setNewContent("");
      setNewSource("");
      setShowAdd(false);
      reload();
    }
  }

  return (
    <div>
      <PageHeader
        icon={IconDatabase}
        title="Tri thức dùng chung"
        subtitle="Tri thức đã duyệt được inject vào MỌI cuộc trò chuyện — luật mới, quy trình, đính chính"
      />

      {/* Status tabs */}
      <div className="mb-4 flex items-center gap-2 px-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-zalo-600 text-white"
                : "bg-tile text-ink-soft hover:bg-line hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        {pendingCount > 0 && (
          <button
            onClick={approveAll}
            disabled={busyApproveAll}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            title="Duyệt toàn bộ tri thức đang chờ"
          >
            <IconCheck size={14} />
            Duyệt tất cả ({pendingCount})
          </button>
        )}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-lg bg-zalo-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-zalo-700 transition-colors"
        >
          <IconPlus size={14} />
          Thêm mới
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 rounded-xl border border-line bg-tile p-4">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] text-ink-soft">Phân loại</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.text}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-ink-soft">Nguồn (tùy chọn)</label>
              <input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="VD: NĐ 30/2020/NĐ-CP, admin:Hải..."
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-[13px] text-ink-soft">Nội dung tri thức</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="VD: Nghị định 30/2020/NĐ-CP đã được sửa đổi bởi Nghị định XX/2025/NĐ-CP, có hiệu lực từ..."
              rows={3}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addNew}
              disabled={!newContent.trim()}
              className="rounded-lg bg-zalo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-zalo-700 disabled:opacity-50"
            >
              Thêm & tự động duyệt
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg bg-tile px-4 py-2 text-[13px] text-ink-soft hover:bg-line"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Tìm trong nội dung hoặc nguồn..."
        filter={
          accounts.length > 1
            ? <AccountFilter accounts={accounts} value={accountFilter} onChange={setAccountFilter} />
            : undefined
        }
        page={page}
        hasMore={hasMore}
        onPage={setPage}
      />

      <TableShell
        headers={["Nội dung", "Phân loại", "Nguồn", "Trạng thái", "Ngày tạo", "Hành động"]}
        minWidth={900}
      >
        {items.length === 0 && (
          <EmptyRow colSpan={6} text="Chưa có tri thức nào" />
        )}
        {items.map((item) => {
          const cat = CATEGORY_LABELS[item.category] ?? { text: item.category, tone: "gray" as const };
          const st = STATUS_LABELS[item.status] ?? { text: item.status, tone: "gray" as const };
          return (
            <tr key={item.id} className="border-b border-line/60 last:border-0 hover:bg-tile/40">
              <td className="max-w-md px-4 py-3 text-ink">{item.content}</td>
              <td className="px-4 py-3">
                <Badge tone={cat.tone} dot={false}>{cat.text}</Badge>
              </td>
              <td className="px-4 py-3 text-[13px] text-ink-soft">{item.source || "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={st.tone} dot={false}>{st.text}</Badge>
              </td>
              <td className="px-4 py-3 text-ink-soft">{formatTime(item.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {item.status === "pending" && (
                    <>
                      <button onClick={() => approve(item)} className="text-[13px] text-green-600 dark:text-green-400 hover:underline">
                        Duyệt
                      </button>
                      <button onClick={() => reject(item)} className="text-[13px] text-red-600 dark:text-red-400 hover:underline">
                        Từ chối
                      </button>
                    </>
                  )}
                  <button onClick={() => remove(item)} className="text-[13px] text-red-600 dark:text-red-400 hover:underline">
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}
