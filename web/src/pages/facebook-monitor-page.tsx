import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../layout/page-header";
import { facebookMonitorApi, type FacebookMonitor, type FacebookPost } from "../facebook-api-client";
import { IconCheck, IconClock, IconGlobe, IconMessage, IconRefresh, IconWarning } from "../shared/dashboard-icons";
import { Badge, ListToolbar, SectionCard, StatCard, formatNumber, formatTime } from "../shared/ui-bits";

const PAGE_SIZE = 20;

const VIA_LABEL: Record<string, string> = {
  "graph-api": "Graph API",
  "browser-session": "Phiên đăng nhập",
  "public-scraper": "Trang công khai",
};

/**
 * Trang "Giám sát Facebook": xem kết quả mỗi lượt cào fanpage (cách cào, số bài,
 * lỗi) và đọc trực tiếp các bài đã lưu - đúng dữ liệu bot dùng khi trả lời tin tức.
 */
export function FacebookMonitorPage() {
  const [mon, setMon] = useState<FacebookMonitor | null>(null);
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [total, setTotal] = useState(0);
  const [pageId, setPageId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMon = useCallback(async () => {
    try {
      setMon(await facebookMonitorApi.monitor());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được trạng thái");
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const r = await facebookMonitorApi.posts({ pageId, q: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setPosts(r.items);
      setTotal(r.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được bài viết");
    }
  }, [pageId, query, page]);

  useEffect(() => {
    void loadMon();
  }, [loadMon]);

  useEffect(() => {
    const t = setTimeout(() => void loadPosts(), 250);
    return () => clearTimeout(t);
  }, [loadPosts]);

  const running = mon?.crawlRunning ?? false;
  useEffect(() => {
    const iv = setInterval(() => {
      void loadMon();
      if (running) void loadPosts();
    }, running ? 5000 : 30000);
    return () => clearInterval(iv);
  }, [running, loadMon, loadPosts]);

  const crawlNow = async () => {
    setBusy(true);
    try {
      await facebookMonitorApi.crawlNow();
      await loadMon();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chạy được");
    } finally {
      setBusy(false);
    }
  };

  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");

  const handleAddPage = async () => {
    if (!newPageId.trim() || !newPageName.trim()) return;
    setBusy(true);
    try {
      await facebookMonitorApi.addPage({
        pageId: newPageId.trim(),
        pageName: newPageName.trim(),
      });
      setNewPageId("");
      setNewPageName("");
      await loadMon();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được fanpage");
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePage = async (targetPageId: string, enabled: boolean) => {
    setBusy(true);
    try {
      await facebookMonitorApi.togglePage(targetPageId, enabled);
      await loadMon();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được trạng thái fanpage");
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePage = async (targetPageId: string, pageName: string) => {
    if (!window.confirm(`Xóa fanpage "${pageName}" khỏi danh sách theo dõi?`)) return;
    setBusy(true);
    try {
      await facebookMonitorApi.deletePage(targetPageId);
      await loadMon();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được fanpage");
    } finally {
      setBusy(false);
    }
  };

  const session = mon?.session;
  const okPages = mon?.pages.filter((p) => p.enabled && p.lastReport && !p.lastReport.error).length ?? 0;
  const errPages = mon?.pages.filter((p) => p.enabled && p.lastReport?.error).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={IconGlobe}
        title="Giám sát Facebook"
        subtitle="Kết quả cào các fanpage và toàn bộ bài đã lưu - đây là dữ liệu bot dùng khi trả lời tin tức"
        aside={
          <>
            <Link to="/tools" className="rounded-xl border border-line bg-surface/90 px-3 py-2 text-xs font-semibold text-ink hover:bg-tile">
              Cài đặt đăng nhập
            </Link>
            <button
              id="fb-monitor-crawl-now"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/30 hover:opacity-95 disabled:opacity-60"
              disabled={busy || running}
              onClick={() => void crawlNow()}
            >
              <IconRefresh size={14} className={running ? "animate-spin" : ""} />
              {running ? "Đang cào..." : "Cào ngay"}
            </button>
          </>
        }
      />

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>}

      {session?.hasSession && session.health?.lastCheckOk === false && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold">⚠️ Phiên Facebook đã hết hạn:</span> Facebook đã đăng xuất phiên này theo chu kỳ bảo mật. Cần dán cookie mới để tiếp tục cào fanpage.
          </div>
          <Link
            to="/tools"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-amber-400"
          >
            Cập nhật Cookie
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IconMessage} label="Bài đã lưu" value={formatNumber(mon?.totalPosts ?? 0)} sub="Giữ 30 ngày gần nhất" />
        <StatCard
          icon={session?.health?.lastCheckOk === false ? IconWarning : IconCheck}
          label="Phiên Facebook"
          value={
            !session?.hasSession
              ? "Chưa đăng nhập"
              : session.health?.lastCheckOk === false
                ? "Phiên hết hạn"
                : session.isHardcoded
                  ? session.source === "env"
                    ? "Cấu hình cứng (.env)"
                    : "Lưu cứng (file txt)"
                  : "Đang hoạt động"
          }
          sub={
            !session?.hasSession
              ? "Đang dùng cách đọc công khai (hay bị chặn)"
              : session.health?.lastCheckOk === false
                ? "Cần cập nhật cookie mới"
                : `UID ${session.userId ?? ""}${session.isHardcoded ? " · Lưu vĩnh viễn" : ""}`
          }
        />
        <StatCard icon={IconClock} label="Lượt cào gần nhất" value={formatTime(mon?.lastRun?.finishedAt ?? mon?.lastRun?.startedAt)} sub={mon?.lastRun ? `+${mon.lastRun.totalNew} bài · ${mon.lastRun.pagesProcessed} trang` : "Tự chạy mỗi 30 phút"} />
        <StatCard icon={IconWarning} label="Fanpage OK / lỗi" value={`${okPages} / ${errPages}`} sub="Theo lượt cào gần nhất" />
      </div>

      <SectionCard icon={IconGlobe} title="Tình trạng từng fanpage" subtitle="Cách cào, số bài lấy được và quản lý danh sách fanpage theo dõi">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            className="gc-input sm:w-64"
            placeholder="ID hoặc URL fanpage (vd: thongtinlamdong)"
            value={newPageId}
            onChange={(e) => setNewPageId(e.target.value)}
          />
          <input
            type="text"
            className="gc-input sm:flex-1"
            placeholder="Tên hiển thị (vd: Thông tin Lâm Đồng)"
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !newPageId.trim() || !newPageName.trim()}
            onClick={() => void handleAddPage()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            + Thêm Fanpage
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="py-2">Fanpage</th>
                <th className="py-2">Lượt gần nhất</th>
                <th className="py-2">Cách cào</th>
                <th className="py-2 text-right">Lấy được</th>
                <th className="py-2 text-right">Đã lưu</th>
                <th className="py-2">Bài mới nhất</th>
                <th className="py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(mon?.pages ?? []).map((p) => (
                <tr key={p.pageId} className="align-top">
                  <td className="py-2.5">
                    <a href={p.pageUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      {p.pageName}
                    </a>
                    {!p.enabled && <span className="ml-1.5 text-[11px] text-ink-soft">(tắt)</span>}
                  </td>
                  <td className="py-2.5 tabular-nums text-ink-soft">{formatTime(p.lastReport?.at ?? p.lastCrawledAt)}</td>
                  <td className="py-2.5">
                    {p.lastReport ? (
                      p.lastReport.error ? (
                        <div>
                          <Badge tone="red">{VIA_LABEL[p.lastReport.via] ?? p.lastReport.via}</Badge>
                          <div className="mt-1 max-w-[260px] text-[11px] text-rose-500">{p.lastReport.error}</div>
                        </div>
                      ) : (
                        <Badge tone="green">{VIA_LABEL[p.lastReport.via] ?? p.lastReport.via}</Badge>
                      )
                    ) : (
                      <span className="text-[12px] text-ink-soft">Chưa có từ lúc khởi động</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{p.lastReport?.saved ?? "-"}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">{p.posts}</td>
                  <td className="py-2.5 tabular-nums text-ink-soft">{formatTime(p.latestPostAt)}</td>
                  <td className="py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        className="rounded-lg border border-line px-2 py-1 text-[11.5px] font-semibold text-ink hover:bg-tile"
                        onClick={() => {
                          setPageId(p.pageId);
                          setPage(0);
                        }}
                      >
                        Xem bài
                      </button>
                      <button
                        className="rounded-lg border border-line px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-tile hover:text-ink"
                        disabled={busy}
                        onClick={() => void handleTogglePage(p.pageId, !p.enabled)}
                      >
                        {p.enabled ? "Tắt" : "Bật"}
                      </button>
                      <button
                        className="rounded-lg border border-rose-500/30 px-2 py-1 text-[11.5px] font-semibold text-rose-500 hover:bg-rose-500/10"
                        disabled={busy}
                        onClick={() => void handleDeletePage(p.pageId, p.pageName)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div>
        <ListToolbar
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder="Tìm trong nội dung bài..."
          filter={
            <select
              id="fb-monitor-filter-page"
              className="gc-input w-full"
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả fanpage</option>
              {(mon?.pages ?? []).map((p) => (
                <option key={p.pageId} value={p.pageId}>
                  {p.pageName}
                </option>
              ))}
            </select>
          }
          page={page}
          hasMore={(page + 1) * PAGE_SIZE < total}
          onPage={setPage}
        />
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="gc-card px-4 py-12 text-center text-[14px] text-ink-soft/70">
              Chưa có bài nào. Nếu Facebook chặn, hãy đăng nhập phiên Facebook (nút “Cài đặt đăng nhập”).
            </div>
          )}
          {posts.map((post) => (
            <article key={post.postId} className="gc-card flex gap-4 p-4">
              {post.imageUrl && (
                <img src={post.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                  <span className="font-semibold text-ink">{post.pageName}</span>
                  <span>· đăng {formatTime(post.createdAt)}</span>
                  <span>· lấy về {formatTime(post.fetchedAt)}</span>
                </div>
                <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[13.5px] leading-[1.6] text-ink">{post.message}</p>
                <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  Mở bài gốc trên Facebook ↗
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-2 text-right text-[12px] text-ink-soft">Tổng {formatNumber(total)} bài</p>
      </div>
    </div>
  );
}
