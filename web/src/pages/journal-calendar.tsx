import type { JournalDay } from "../home-api-client";
import { congNgay, khoaNgay, tuKhoaNgay } from "../shared/vn-format";

/**
 * Lưới lịch cho Nhật ký: chế độ Tháng (lưới 6 tuần, bắt đầu Thứ Hai) và Tuần
 * (một hàng 7 ngày). Chấm đỏ = có lỗi, chấm vàng = có cảnh báo cần chú ý.
 */

export const THU_NGAN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Thứ Hai của tuần chứa `key` */
export function dauTuan(key: string): string {
  const d = tuKhoaNgay(key);
  const lech = (d.getDay() + 6) % 7;
  return congNgay(key, -lech);
}

/** Danh sách ngày hiển thị cho tháng của `key` (đệm đầu tuần bằng null) */
export function oThang(key: string): (string | null)[] {
  const d = tuKhoaNgay(key);
  const dau = new Date(d.getFullYear(), d.getMonth(), 1);
  const soNgay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const dem = (dau.getDay() + 6) % 7;
  const out: (string | null)[] = Array.from({ length: dem }, () => null);
  for (let i = 0; i < soNgay; i++) out.push(khoaNgay(new Date(d.getFullYear(), d.getMonth(), i + 1)));
  return out;
}

function mucDo(d: JournalDay | undefined): "do" | "vang" | null {
  if (!d) return null;
  if (d.errors > 0 || d.scheduleErrors > 0) return "do";
  if (d.warnings > 0) return "vang";
  return null;
}

export function JournalCalendar({
  cells,
  summary,
  selected,
  today,
  onSelect,
}: {
  cells: (string | null)[];
  summary: Map<string, JournalDay>;
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[12px] font-medium text-ink-soft">
        {THU_NGAN.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const md = mucDo(summary.get(day));
          const isSel = day === selected;
          const tuongLai = day > today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={`Ngày ${day}`}
              aria-pressed={isSel}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] font-semibold transition-all active:scale-95 ${
                isSel ? "border-2 border-zalo-600 bg-surface text-ink" : "bg-tile text-ink hover:brightness-95"
              } ${tuongLai ? "opacity-60" : ""}`}
            >
              {Number(day.slice(8))}
              {md && (
                <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${md === "do" ? "bg-rose-500" : "bg-gold-500"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
