import type { ReactNode, SVGProps } from "react";
import { IconSearch } from "./dashboard-icons";

/** Mảnh UI dùng chung theo mẫu GoClaw: badge chấm màu, stat card + sparkline, tile, bảng */

/**
 * Núm gạt bật/tắt - phần hình của mọi toggle (drawer account, trang Tools).
 *
 * `inline-block` là bắt buộc: span mặc định là display:inline, mà width/height
 * KHÔNG áp dụng cho inline element - núm chỉ có kích thước khi cha tình cờ là
 * flex container, đặt trong nút thường thì co về 0 và biến mất hẳn.
 */
export function ToggleKnob({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-blue-500/30" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-200 ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </span>
  );
}

export function Badge({
  tone,
  dot = true,
  children,
}: {
  tone: "blue" | "gray" | "green" | "red" | "amber";
  dot?: boolean;
  children: ReactNode;
}) {
  const tones = {
    blue: { chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25", dot: "bg-blue-500" },
    gray: { chip: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20", dot: "bg-slate-400 dark:bg-slate-500" },
    green: { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25", dot: "bg-emerald-500" },
    red: { chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25", dot: "bg-rose-500" },
    amber: { chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25", dot: "bg-amber-500" },
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold backdrop-blur-xs ${tones.chip}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${tones.dot}`} />}
      {children}
    </span>
  );
}

/** Sparkline SVG thuần từ 1 dãy số - đường mảnh + fill nhạt như mẫu */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120;
  const h = 28;
  if (values.length < 2 || values.every((v) => v === 0)) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
        <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="currentColor" strokeOpacity="0.25" />
      </svg>
    );
  }
  const max = Math.max(...values);
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - 2 - (v / max) * (h - 6),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="currentColor" fillOpacity="0.1" stroke="none" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Stat card theo mẫu: icon box góc trên, label nhỏ, số to, sparkline đáy */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  series,
}: {
  icon: (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;
  label: string;
  value: string;
  sub?: ReactNode;
  series?: number[];
}) {
  return (
    <div className="gc-card-hover flex flex-col justify-between p-5 relative overflow-hidden group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
          <div className="mt-2 text-2xl lg:text-[26px] font-bold tracking-tight text-ink tabular-nums">{value}</div>
          {sub && <div className="mt-1.5 text-[11.5px] font-medium text-ink-soft">{sub}</div>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform duration-200">
          <Icon size={19} />
        </span>
      </div>
      {series && <Sparkline values={series} className="mt-4 h-7 w-full text-blue-500" />}
    </div>
  );
}

/** Panel lớn có header icon + title (+ subtitle) + slot phải */
export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  aside,
  children,
}: {
  icon?: (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="gc-card p-5 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line/60">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function InfoTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="gc-tile flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-surface text-blue-600 dark:text-blue-400">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-ink-soft">{label}</div>
        <div className="truncate text-[14.5px] font-bold text-ink">{value}</div>
        {hint && <div className="truncate text-[11px] text-ink-soft/80">{hint}</div>}
      </div>
    </div>
  );
}

export function Pager({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (p: number) => void;
}) {
  const btn =
    "rounded-xl border border-line bg-surface/90 px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40 hover:bg-tile hover:border-line transition-colors";
  return (
    <div className="flex items-center gap-2">
      <button className={btn} disabled={page === 0} onClick={() => onPage(page - 1)}>
        Trước
      </button>
      <span className="text-xs font-medium text-ink-soft">Trang {page + 1}</span>
      <button className={btn} disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Sau
      </button>
    </div>
  );
}

export function TableShell({
  headers,
  minWidth = 720,
  children,
}: {
  headers: string[];
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div className="gc-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-line/80 bg-tile/50 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              {headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Thanh công cụ trên bảng: tìm kiếm + bộ lọc (vd account) + phân trang */
export function ListToolbar({
  query,
  onQuery,
  placeholder,
  filter,
  page,
  hasMore,
  onPage,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  /** Slot bộ lọc cạnh ô search - pattern GoClaw: lọc ở đâu, hiệu lực ở đó */
  filter?: ReactNode;
  page: number;
  hasMore: boolean;
  onPage: (p: number) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
          />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="gc-input w-full pl-9"
          />
        </div>
        {filter && <div className="w-full sm:w-56">{filter}</div>}
      </div>
      <Pager page={page} hasMore={hasMore} onPage={onPage} />
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-[14px] text-ink-soft/60">
        {text}
      </td>
    </tr>
  );
}

/** Avatar tròn chữ cái đầu - màu sinh từ tên để ổn định */
export function InitialAvatar({ name }: { name: string }) {
  const palette = [
    "bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20",
    "bg-gradient-to-br from-indigo-600 to-purple-600 shadow-indigo-500/20",
    "bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/20",
    "bg-gradient-to-br from-rose-600 to-pink-600 shadow-rose-500/20",
    "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20",
    "bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/20",
  ];
  const hash = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12.5px] font-bold text-white shadow-sm border border-white/15 ${palette[hash % palette.length]}`}
    >
      {initial}
    </span>
  );
}

/** "25/07 14:30" từ ISO UTC - hiển thị theo giờ máy người xem */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** "120d 1h 48m" từ giây */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}
