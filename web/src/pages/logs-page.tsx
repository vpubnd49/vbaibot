import { useEffect, useState } from "react";
import type { LogEntry } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { DongLog } from "./log-row";
import { IconDatabase } from "../shared/dashboard-icons";
import { SelectMenu } from "../shared/select-menu";

/**
 * Log toàn hệ thống, đọc từ file `data/logs/bot.<ngày>.log`.
 *
 * Khác trang Trace: Trace chỉ có lượt agent, còn đây là MỌI thứ - kết nối Zalo,
 * login QR, định tuyến tin, lỗi của 30 scope trong hệ thống.
 *
 * File ghi cả mức debug bất kể LOG_LEVEL của terminal, nên xem ở đây luôn đầy
 * đủ hơn nhìn terminal.
 */

/**
 * Số dòng mỗi trang. Nhỏ hơn trần 500 của server để lần bấm "Xem thêm" phản hồi
 * nhanh - đọc log là việc dò tìm, người dùng bấm nhiều lần chứ không ngồi đợi
 * một cục lớn.
 */
const MOI_TRANG = 150;

const MUC_LOC = [
  { value: "", label: "Mọi mức" },
  { value: "debug", label: "Debug trở lên" },
  { value: "info", label: "Info trở lên" },
  { value: "warn", label: "Warn trở lên" },
  { value: "error", label: "Chỉ Error" },
];

export function LogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [tat, setTat] = useState(false);
  const [goiY, setGoiY] = useState("");
  const [level, setLevel] = useState("");
  const [scope, setScope] = useState("");
  const [search, setSearch] = useState("");
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  /** Con trỏ trang sau; `null` = đã hết log, ẩn nút "Xem thêm" */
  const [conTro, setConTro] = useState<string | null>(null);
  const [dangTaiThem, setDangTaiThem] = useState(false);

  /**
   * `before` rỗng = tải lại từ đầu (đổi bộ lọc, bấm Làm mới); có `before` =
   * NỐI THÊM trang cũ hơn. Gộp một hàm để hai đường không trôi khỏi nhau.
   */
  async function nap(before?: string) {
    const noiThem = Boolean(before);
    if (noiThem) setDangTaiThem(true);
    else setDangTai(true);
    setLoi("");
    try {
      const r = await api.logs({ level, scope, search, limit: MOI_TRANG, before });
      setEntries((cu) => (noiThem ? [...cu, ...r.entries] : r.entries));
      // Danh sách scope chỉ nạp khi CHƯA lọc, không thì lọc xong ô chọn rỗng dần
      if (!noiThem && !scope && !search) setScopes(r.scopes);
      setConTro(r.nextCursor);
      setTat(r.disabled);
      setGoiY(r.hint ?? "");
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setDangTai(false);
      setDangTaiThem(false);
    }
  }

  useEffect(() => {
    void nap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, scope]);

  return (
    <>
      <PageHeader
        icon={IconDatabase}
        title="Nhật ký hệ thống (Logs)"
        subtitle="Toàn bộ nhật ký hoạt động thời gian thực từ máy chủ — kết nối Zalo, định tuyến tin, trạng thái Whisper và các sự kiện AI"
      />

      {tat && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          {goiY || "Ghi log ra file đang tắt"}
        </div>
      )}
      {loi && (
        <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          {loi}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="min-w-[150px]">
          <SelectMenu value={level} onChange={setLevel} options={MUC_LOC} ariaLabel="Lọc theo mức" />
        </div>
        <div className="min-w-[170px]">
          <SelectMenu
            value={scope}
            onChange={setScope}
            options={[
              { value: "", label: "Mọi scope" },
              ...scopes.map((s) => ({ value: s, label: s })),
            ]}
            ariaLabel="Lọc theo scope"
          />
        </div>
        <input
          className="gc-input min-w-[200px] flex-1 text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void nap()}
          placeholder="Tìm từ khóa trong log rồi Enter..."
        />
        <button
          type="button"
          onClick={() => void nap()}
          disabled={dangTai}
          className="gc-button-secondary text-xs py-2 px-4"
        >
          {dangTai ? "Đang nạp..." : "🔄 Làm mới"}
        </button>
      </div>

      <div className="gc-card overflow-hidden divide-y divide-line/60">
        {entries.map((e, i) => (
          <DongLog key={i} e={e} />
        ))}
        {entries.length === 0 && !dangTai && !tat && (
          <p className="py-12 text-center text-xs text-ink-soft">
            Không có dòng nhật ký nào khớp bộ lọc.
          </p>
        )}
      </div>

      {conTro && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void nap(conTro)}
            disabled={dangTaiThem}
            className="gc-button-secondary text-xs py-2 px-5"
          >
            {dangTaiThem ? "Đang tải thêm..." : `Xem thêm ${MOI_TRANG} dòng cũ hơn`}
          </button>
        </div>
      )}

      {!conTro && entries.length > 0 && (
        <p className="mt-4 text-center text-[12px] text-ink-soft/60">
          Đã hết log lưu lại. Log cũ hơn bị xoay vòng theo LOG_FILE_KEEP_DAYS.
        </p>
      )}
    </>
  );
}
