import { Link } from "react-router-dom";
import type { UpcomingJob } from "../home-api-client";
import { gioNgan, gioPhut, khoangToi } from "../shared/vn-format";

/** "Việc sắp tới": việc gần nhất hiện to (giờ + đếm ngược), các việc sau dạng danh sách */

const NHAN_LICH: Record<string, string> = { once: "một lần", every: "lặp lại", cron: "định kỳ" };
const NHAN_LOAI: Record<string, string> = { message: "Nhắn tin", agent: "Bot tự làm" };

export function HomeUpcoming({ jobs }: { jobs: UpcomingJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="warm-card px-5 py-6 text-center text-[14px] text-ink-soft">
        Chưa có lịch hẹn nào sắp tới.{" "}
        <Link to="/schedule" className="font-semibold text-zalo-600 hover:underline">
          Tạo lịch hẹn
        </Link>
      </div>
    );
  }
  const [dau, ...con] = jobs;
  return (
    <div className="space-y-3">
      <Link to="/schedule" className="warm-card flex items-stretch gap-4 p-4 transition-transform hover:-translate-y-0.5">
        <div className="flex w-[110px] shrink-0 flex-col items-center justify-center border-r border-line pr-3">
          <span className="font-heading text-[34px] font-bold leading-none text-ink">{gioPhut(dau!.nextRunAt)}</span>
          {gioNgan(dau!.nextRunAt) !== gioPhut(dau!.nextRunAt) && (
            <span className="mt-1 text-[12px] font-semibold text-ink-soft">{gioNgan(dau!.nextRunAt).split(" ")[0]}</span>
          )}
          <span className="mt-1 text-[12.5px] text-ink-soft">Còn {khoangToi(dau!.nextRunAt)}</span>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-[16px] font-bold text-ink">{dau!.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-soft">
            {NHAN_LOAI[dau!.kind] ?? dau!.kind} tại {dau!.threadName} · {dau!.accountLabel}
          </p>
          <span className="mt-2 inline-block rounded-full bg-tile px-2.5 py-0.5 text-[12px] font-medium text-ink-soft">
            {NHAN_LICH[dau!.scheduleKind] ?? dau!.scheduleKind}
          </span>
        </div>
      </Link>
      {con.length > 0 && (
        <div className="warm-card divide-y divide-line px-4">
          {con.map((j) => (
            <div key={j.id} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-ink">
                  {j.name} <span className="font-normal text-ink-soft">· {gioNgan(j.nextRunAt)}</span>
                </p>
                <p className="truncate text-[12.5px] text-ink-soft">
                  {NHAN_LOAI[j.kind] ?? j.kind} tại {j.threadName} ({NHAN_LICH[j.scheduleKind] ?? j.scheduleKind})
                </p>
              </div>
              <span className="shrink-0 text-[12.5px] text-ink-soft">sau {khoangToi(j.nextRunAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
