import type { JournalEvent, JournalEventType } from "../home-api-client";
import { gioPhut } from "../shared/vn-format";

/** Danh sách sự kiện của ngày đã chọn + chip lọc theo loại */

export type BoLoc = "tat-ca" | JournalEventType;

export const CHIP: { value: BoLoc; label: string }[] = [
  { value: "tat-ca", label: "Tất cả" },
  { value: "canh-bao", label: "Cảnh báo" },
  { value: "khach", label: "Khách" },
  { value: "lich", label: "Lịch hẹn" },
  { value: "he-thong", label: "Hệ thống" },
];

const CHAM: Record<JournalEvent["level"], string> = {
  info: "bg-emerald-600",
  warn: "bg-gold-500",
  error: "bg-rose-500",
};

export function JournalFilterChips({ value, onChange }: { value: BoLoc; onChange: (v: BoLoc) => void }) {
  return (
    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
      {CHIP.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors ${
            value === c.value ? "border-zalo-600 bg-surface text-ink" : "border-line bg-surface/70 text-ink-soft hover:text-ink"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function JournalEventList({ events, loading }: { events: JournalEvent[]; loading: boolean }) {
  if (loading) return <div className="warm-card animate-pulse px-5 py-8 text-center text-ink-soft">Đang tải sự kiện...</div>;
  if (events.length === 0) {
    return <div className="warm-card px-5 py-8 text-center text-[15px] text-ink-soft">Không có sự kiện nào.</div>;
  }
  return (
    <ul className="warm-card divide-y divide-line px-4">
      {events.map((e, i) => (
        <li key={`${e.time}-${i}`} className="flex gap-3 py-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CHAM[e.level]}`} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-[14.5px] font-semibold leading-snug text-ink">{e.title}</p>
            {(e.detail || e.accountLabel) && (
              <p className="mt-0.5 break-words text-[12.5px] leading-snug text-ink-soft">
                {[e.accountLabel, e.detail].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[12.5px] tabular-nums text-ink-soft">{gioPhut(e.time)}</span>
        </li>
      ))}
    </ul>
  );
}
