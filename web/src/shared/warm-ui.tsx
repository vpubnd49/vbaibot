import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Khối giao diện dùng chung cho Trang chủ / Báo cáo / Nhật ký (phong cách nền kem,
 * thẻ bo tròn lớn, tiêu đề serif - theo mẫu anh duyệt).
 */

export type Tone = "sky" | "emerald" | "amber" | "violet" | "rose" | "stone";

const TONE: Record<Tone, string> = {
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  stone: "bg-stone-200/70 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300",
};

export function WarmPageTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[13px] text-ink-soft">{eyebrow}</p>}
        <h1 className="warm-title text-[30px] leading-tight sm:text-[34px]">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function StatTile({
  icon,
  tone,
  value,
  label,
  to,
}: {
  icon: ReactNode;
  tone: Tone;
  value: ReactNode;
  label: string;
  to?: string;
}) {
  const inner = (
    <>
      <span className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${TONE[tone]}`}>{icon}</span>
      <span className="block text-[20px] font-bold leading-tight text-ink tabular-nums">{value}</span>
      <span className="mt-0.5 block text-[12px] leading-tight text-ink-soft">{label}</span>
    </>
  );
  const cls =
    "warm-card block px-2 py-3.5 text-center transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]";
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function SegmentedTabs<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4 grid gap-1 rounded-2xl bg-tile p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-xl py-2 text-[14px] font-semibold transition-all ${
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between">
      <h2 className="text-[19px] font-bold tracking-tight text-ink">{title}</h2>
      {right}
    </div>
  );
}

export function LoadingCard({ text = "Đang tải..." }: { text?: string }) {
  return <div className="warm-card animate-pulse px-5 py-8 text-center text-ink-soft">{text}</div>;
}
