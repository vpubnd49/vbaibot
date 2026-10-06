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
    const accId = accountFilter || (accounts.length >= 1 ? accounts[0].id : "");
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
    if (!accountFilter && accounts.length >= 1) setAccountFilter(accounts[0].id);
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
        title="Kho tri thức dùng chung"
        subtitle="Tri thức đã duyệt được tự động cung cấp vào MỌI phiên trò chuyện — văn bản pháp lý, quy chế, thủ tục và đính chính"
      />

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.value
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "bg-tile/70 border border-line/60 text-ink-soft hover:text-ink hover:bg-tile"
            }`}
          >
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
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
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
            title="Duyệt toàn bộ tri thức đang chờ"
          >
            <IconCheck size={14} />
            Duyệt tất cả ({pendingCount})
          </button>
        )}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="gc-button-primary text-xs py-2 px-3.5"
        >
          <IconPlus size={14} />
          Thêm tri thức
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-5 gc-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <h3 className="text-sm font-bold text-ink">Thêm mục tri thức mới</h3>
            <span className="text-xs text-ink-soft">Tự động kích hoạt cho các trợ lý bot</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Phân loại</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="gc-input w-full text-xs"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.text}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Nguồn trích dẫn (tùy chọn)</label>
              <input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="VD: NĐ 30/2020/NĐ-CP, Công văn 1234/UBND..."
                className="gc-input w-full text-xs"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Nội dung tri thức</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="VD: Nghị định 30/2020/NĐ-CP quy định về thể thức và kỹ thuật trình bày văn bản hành chính..."
              rows={3}
              className="gc-input w-full text-xs leading-relaxed"
            />
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={addNew}
              disabled={!newContent.trim()}
              className="gc-button-primary text-xs py-2 px-4"
            >
              Lưu & tự động duyệt
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="gc-button-secondary text-xs py-2 px-4"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Tìm trong nội dung hoặc nguồn trích dẫn..."
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
        headers={["Nội dung tri thức", "Phân loại", "Nguồn", "Trạng thái", "Ngày tạo", "Thao tác"]}
        minWidth={900}
      >
        {items.length === 0 && (
          <EmptyRow colSpan={6} text="Chưa có mục tri thức nào phù hợp bộ lọc" />
        )}
        {items.map((item) => {
          const cat = CATEGORY_LABELS[item.category] ?? { text: item.category, tone: "gray" as const };
          const st = STATUS_LABELS[item.status] ?? { text: item.status, tone: "gray" as const };
          return (
            <tr key={item.id} className="hover:bg-tile/40 transition-colors">
              <td className="max-w-md px-4 py-3.5 text-ink leading-relaxed font-normal">{item.content}</td>
              <td className="px-4 py-3.5">
                <Badge tone={cat.tone} dot={false}>{cat.text}</Badge>
              </td>
              <td className="px-4 py-3.5 text-xs text-ink-soft font-medium">{item.source || "—"}</td>
              <td className="px-4 py-3.5">
                <Badge tone={st.tone} dot>{st.text}</Badge>
              </td>
              <td className="px-4 py-3.5 text-xs text-ink-soft">{formatTime(item.createdAt)}</td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  {item.status === "pending" && (
                    <>
                      <button
                        onClick={() => approve(item)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        Duyệt
                      </button>
                      <button
                        onClick={() => reject(item)}
                        className="rounded-lg border border-line bg-tile/60 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-tile hover:text-ink transition-all"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => remove(item)}
                    className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-all"
                  >
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
