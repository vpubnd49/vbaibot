import { useEffect, useState } from "react";
import type { HomeSummary } from "../home-api-client";
import { IconAlert, IconCheckCircle } from "../shared/warm-icons";
import { truocDay } from "../shared/vn-format";

/** Thẻ "Hệ thống ổn định 100%" + thanh tiến độ + "Cập nhật x giây trước" */

const MAU: Record<HomeSummary["health"]["level"], { text: string; bar: string; badge: string; title: string }> = {
  ok: { text: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-600", badge: "bg-emerald-700", title: "Hệ thống ổn định" },
  warn: { text: "text-amber-600 dark:text-amber-300", bar: "bg-amber-500", badge: "bg-amber-500", title: "Cần chú ý" },
  bad: { text: "text-rose-600 dark:text-rose-300", bar: "bg-rose-500", badge: "bg-rose-600", title: "Có sự cố" },
};

export function HomeHealthCard({ health, generatedAt }: { health: HomeSummary["health"]; generatedAt: number }) {
  const m = MAU[health.level];
  // Đồng hồ nhỏ để chữ "x giây trước" tự nhảy giữa hai lần tải dữ liệu
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="warm-card p-4 sm:p-5" aria-label="Tình trạng hệ thống">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${m.badge}`}>
          {health.level === "ok" ? <IconCheckCircle size={24} /> : <IconAlert size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-bold leading-tight text-ink">{m.title}</p>
          <p className="truncate text-[13.5px] text-ink-soft">
            {health.reasons.length ? health.reasons[0] : "Không có cảnh báo"}
          </p>
        </div>
        <span className={`text-[30px] font-bold tabular-nums ${m.text}`}>{health.score}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-tile">
        <div className={`h-full rounded-full transition-all duration-700 ${m.bar}`} style={{ width: `${health.score}%` }} />
      </div>
      {health.reasons.length > 1 && (
        <ul className="mt-3 space-y-1 text-[13px] text-ink-soft">
          {health.reasons.slice(1).map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-between text-[13px] text-ink-soft">
        <span>Cập nhật</span>
        <span>{truocDay(generatedAt, now)}</span>
      </div>
    </section>
  );
}
