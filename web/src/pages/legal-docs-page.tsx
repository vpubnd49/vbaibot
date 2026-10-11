import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../layout/page-header";
import { legalDocsApi, type LegalDocItem, type LegalDocsOverview } from "../legal-docs-api-client";
import {
  IconCheck,
  IconClock,
  IconDatabase,
  IconFileText,
  IconGlobe,
  IconRefresh,
  IconWarning,
} from "../shared/dashboard-icons";
import { Badge, EmptyRow, ListToolbar, SectionCard, StatCard, TableShell, formatNumber, formatTime } from "../shared/ui-bits";

const PAGE_SIZE = 30;

const SOURCE_LABEL: Record<string, string> = {
  chinhphu: "vanban.chinhphu.vn",
  congbao: "Công báo",
  vbpl: "VBPL",
  phapluat: "phapluat.gov.vn",
  tvpl: "TVPL",
};

const STATUS_META: Record<LegalDocItem["status"], { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }> = {
  downloaded: { label: "Đã tải", tone: "green" },
  duplicate: { label: "Trùng (đã có)", tone: "blue" },
  pending: { label: "Chờ tải", tone: "amber" },
  failed: { label: "Lỗi", tone: "red" },
  no_file: { label: "Chưa có file", tone: "gray" },
  purged: { label: "Đã dọn file", tone: "gray" },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(ymd: string | null | undefined): string {
  if (!ymd) return "-";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

const selectCls = "gc-input w-full";

export function LegalDocsPage() {
  const [overview, setOverview] = useState<LegalDocsOverview | null>(null);
  const [items, setItems] = useState<LegalDocItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await legalDocsApi.overview());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được thống kê");
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await legalDocsApi.list({ status, source, q: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách");
    }
  }, [status, source, query, page]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const t = setTimeout(() => void loadList(), 250);
    return () => clearTimeout(t);
  }, [loadList]);

  // Đang cào thì làm mới nhanh để thấy số liệu nhảy; bình thường 30s/lần
  const running = overview?.crawler.running ?? false;
  useEffect(() => {
    const iv = setInterval(() => {
      void loadOverview();
      if (running) void loadList();
    }, running ? 4000 : 30000);
    return () => clearInterval(iv);
  }, [running, loadOverview, loadList]);

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setNotice(null);
    try {
      setNotice(await fn());
      await Promise.all([loadOverview(), loadList()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(null);
    }
  };

  const s = overview?.stats;
  const c = overview?.crawler;
  const downloaded = (s?.byStatus.downloaded ?? 0) + (s?.byStatus.duplicate ?? 0);
  const pending = s?.byStatus.pending ?? 0;
  const failed = (s?.byStatus.failed ?? 0) + (s?.byStatus.no_file ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={IconFileText}
        title="Kho văn bản pháp luật"
        subtitle="Tự động cào văn bản mới từ vanban.chinhphu.vn và Công báo, tải sẵn bản PDF chính thức để trả người dùng ngay"
        aside={
          <>
            <button
              id="legal-docs-retry-failed"
              className="rounded-xl border border-line bg-surface/90 px-3 py-2 text-xs font-semibold text-ink hover:bg-tile disabled:opacity-50"
              disabled={busy !== null || failed === 0}
              onClick={() => void act("retry-all", async () => `Đã xếp lại ${(await legalDocsApi.retryFailed()).count} văn bản lỗi vào hàng chờ`)}
            >
              Tải lại mục lỗi
            </button>
            <button
              id="legal-docs-crawl-now"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/30 hover:opacity-95 disabled:opacity-60"
              disabled={busy !== null || running}
              onClick={() =>
                void act("crawl", async () => {
                  const r = await legalDocsApi.crawl();
                  return r.started ? "Đã bắt đầu lượt cào mới - số liệu sẽ tự cập nhật" : (r.message ?? "Đang có lượt cào chạy");
                })
              }
            >
              <IconRefresh size={14} className={running ? "animate-spin" : ""} />
              {running ? "Đang cào..." : "Cào ngay"}
            </button>
          </>
        }
      />

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{notice}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IconDatabase} label="Tổng đã cào" value={formatNumber(s?.total ?? 0)} sub={`+${s?.newToday ?? 0} văn bản mới hôm nay`} />
        <StatCard icon={IconCheck} label="Đã tải về" value={formatNumber(downloaded)} sub={`+${s?.downloadedToday ?? 0} hôm nay · ${formatBytes(s?.totalBytes ?? 0)}`} />
        <StatCard icon={IconClock} label="Chờ tải" value={formatNumber(pending)} sub={c ? `Tối đa ${c.downloadsPerRound} file / lượt` : undefined} />
        <StatCard icon={IconWarning} label="Lỗi / chưa có file" value={formatNumber(failed)} sub={`Mới nhất ban hành: ${formatDate(s?.latestIssued)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={IconRefresh} title="Bộ cào tự động" subtitle={c ? `Chạy mỗi ${c.intervalMinutes} phút` : undefined}
          aside={running ? <Badge tone="blue">Đang chạy</Badge> : <Badge tone="green">Sẵn sàng</Badge>}>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="gc-tile">
              <dt className="text-ink-soft text-[11.5px]">Lượt gần nhất</dt>
              <dd className="font-bold text-ink">{formatTime(c?.lastRound?.finishedAt)}</dd>
            </div>
            <div className="gc-tile">
              <dt className="text-ink-soft text-[11.5px]">Lượt kế tiếp</dt>
              <dd className="font-bold text-ink">{formatTime(c?.nextRunAt)}</dd>
            </div>
            <div className="gc-tile">
              <dt className="text-ink-soft text-[11.5px]">Văn bản mới phát hiện</dt>
              <dd className="font-bold text-ink">{c?.lastRound?.newDocs ?? 0}</dd>
            </div>
            <div className="gc-tile">
              <dt className="text-ink-soft text-[11.5px]">Tải thành công / lỗi</dt>
              <dd className="font-bold text-ink">
                {c?.lastRound?.downloaded ?? 0} / {c?.lastRound?.failed ?? 0}
              </dd>
            </div>
          </dl>
          {c?.lastRound && (
            <p className="mt-3 text-[12px] text-ink-soft">
              Quét: vanban.chinhphu.vn {c.lastRound.discovered.chinhphu} mục · Công báo {c.lastRound.discovered.congbao} mục
            </p>
          )}
          {c?.lastRound?.errors.length ? (
            <ul className="mt-2 space-y-1 text-[12px] text-rose-600">
              {c.lastRound.errors.map((e, i) => (
                <li key={i}>⚠ {e}</li>
              ))}
            </ul>
          ) : null}
          {c?.storage && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-ink">Dung lượng kho tự tải</span>
                <span className="tabular-nums text-ink-soft">
                  {formatBytes(c.storage.usedBytes)} / {formatBytes(c.storage.maxBytes)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-tile">
                <div
                  className={`h-full rounded-full ${c.storage.usedBytes / c.storage.maxBytes > 0.85 ? "bg-amber-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`}
                  style={{ width: `${Math.min(100, (c.storage.usedBytes / Math.max(1, c.storage.maxBytes)) * 100).toFixed(1)}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] leading-[1.6] text-ink-soft">
                Tự xoá file cũ hơn <b>{c.storage.retentionDays || "∞"}</b> ngày hoặc khi vượt trần (xoá file cũ nhất trước).
                Đĩa VPS còn <b>{c.storage.diskFreeBytes !== null ? formatBytes(c.storage.diskFreeBytes) : "?"}</b>; dưới{" "}
                {formatBytes(c.storage.minFreeBytes)} sẽ tạm dừng tải. Văn bản đã dọn vẫn còn trong danh mục, người dùng hỏi thì bot tải lại từ nguồn.
              </p>
              {c.lastRound?.purged && c.lastRound.purged.files > 0 && (
                <p className="mt-1 text-[11.5px] text-ink-soft">
                  Lượt gần nhất đã dọn {c.lastRound.purged.files} file ({formatBytes(c.lastRound.purged.bytes)}) — {c.lastRound.purged.reason.join(", ")}
                </p>
              )}
              <button
                id="legal-docs-purge"
                className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-tile disabled:opacity-50"
                disabled={busy !== null}
                onClick={() =>
                  void act("purge", async () => {
                    const r = await legalDocsApi.purge();
                    return r.files ? `Đã dọn ${r.files} file (${formatBytes(r.bytes)})` : "Không có file nào cần dọn";
                  })
                }
              >
                Dọn ngay theo chính sách
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={IconGlobe} title="Theo nguồn" subtitle={`Người dùng tải: ${s?.byOrigin.user ?? 0} · Bộ cào: ${s?.byOrigin.crawler ?? 0}`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="py-1.5">Nguồn</th>
                <th className="py-1.5 text-right">Tổng</th>
                <th className="py-1.5 text-right">Đã tải</th>
                <th className="py-1.5 text-right">Chờ</th>
                <th className="py-1.5 text-right">Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(s?.bySource ?? []).map((r) => (
                <tr key={r.source}>
                  <td className="py-2 font-semibold text-ink">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td className="py-2 text-right tabular-nums">{r.total}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-600">{r.downloaded}</td>
                  <td className="py-2 text-right tabular-nums text-amber-600">{r.pending}</td>
                  <td className="py-2 text-right tabular-nums text-rose-600">{r.failed}</td>
                </tr>
              ))}
              {!s?.bySource.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-soft/70">
                    Chưa có dữ liệu - bộ cào chạy lượt đầu sau khi khởi động 90 giây
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div>
        <ListToolbar
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder="Tìm số hiệu hoặc trích yếu..."
          filter={
            <div className="flex gap-2">
              <select id="legal-docs-filter-status" className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                <option value="">Mọi trạng thái</option>
                <option value="downloaded">Đã tải</option>
                <option value="pending">Chờ tải</option>
                <option value="failed">Lỗi</option>
                <option value="purged">Đã dọn file</option>
              </select>
              <select id="legal-docs-filter-source" className={selectCls} value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }}>
                <option value="">Mọi nguồn</option>
                {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          }
          page={page}
          hasMore={(page + 1) * PAGE_SIZE < total}
          onPage={setPage}
        />
        <TableShell headers={["Số hiệu", "Trích yếu", "Ban hành", "Nguồn", "Trạng thái", "Phát hiện", ""]} minWidth={980}>
          {items.length === 0 && <EmptyRow colSpan={7} text="Không có văn bản phù hợp" />}
          {items.map((d) => {
            const meta = STATUS_META[d.status];
            return (
              <tr key={d.id} className="hover:bg-tile/40 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                  {d.soHieu || "-"}
                  {d.origin === "user" && <span className="ml-1.5 text-[10.5px] font-medium text-indigo-500">(người dùng)</span>}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  <div className="line-clamp-2 max-w-[420px]" title={d.trichYeu}>{d.trichYeu || d.loaiVb || "-"}</div>
                  {d.lastError && d.status !== "downloaded" && <div className="mt-0.5 text-[11px] text-rose-500 line-clamp-1" title={d.lastError}>{d.lastError}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDate(d.ngayBanHanh)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {d.detailUrl ? (
                    <a href={d.detailUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                      {SOURCE_LABEL[d.source] ?? d.source}
                    </a>
                  ) : (SOURCE_LABEL[d.source] ?? d.source)}
                </td>
                <td className="whitespace-nowrap px-4 py-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-soft tabular-nums">{formatTime(d.discoveredAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {d.filePath && (d.status === "downloaded" || d.status === "duplicate") ? (
                    <a
                      href={legalDocsApi.fileUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[12px] font-semibold text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
                    >
                      Mở file · {formatBytes(d.fileSize)}
                    </a>
                  ) : d.status === "failed" || d.status === "no_file" ? (
                    <button
                      className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-tile disabled:opacity-50"
                      disabled={busy !== null}
                      onClick={() => void act(`retry-${d.id}`, async () => { await legalDocsApi.retry(d.id); return `Đã xếp ${d.soHieu} vào hàng chờ tải lại`; })}
                    >
                      Tải lại
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </TableShell>
        <p className="mt-2 text-right text-[12px] text-ink-soft">Tổng {formatNumber(total)} văn bản</p>
      </div>
    </div>
  );
}
