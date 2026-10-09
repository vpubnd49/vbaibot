import { useState } from "react";
import type { ReportDay } from "../home-api-client";

/**
 * Biểu đồ cột xếp chồng "Tin nhắn theo ngày": khách (xanh nhạt) + bot (xanh đậm).
 * SVG tự vẽ - không kéo thêm thư viện chart vào bundle cho một biểu đồ.
 * Chạm/rê vào cột để xem số của ngày đó.
 */

const CAO = 150;

function nhanNgay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function ReportStackedChart({ daily }: { daily: ReportDay[] }) {
  const [chon, setChon] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.user + d.bot));
  const n = daily.length;
  const w = 100 / n;
  const pick = chon !== null ? daily[chon] : null;

  return (
    <div className="warm-card p-4">
      <div className="mb-2 h-5 text-[13px] text-ink-soft">
        {pick ? (
          <span>
            <b className="text-ink">{nhanNgay(pick.day)}</b> · {pick.user} tin khách · {pick.bot} bot trả lời
          </span>
        ) : (
          <span>Chạm vào cột để xem chi tiết</span>
        )}
      </div>
      <svg
        viewBox={`0 0 100 ${CAO}`}
        preserveAspectRatio="none"
        className="h-[170px] w-full"
        role="img"
        aria-label="Biểu đồ tin nhắn theo ngày"
        onMouseLeave={() => setChon(null)}
      >
        {daily.map((d, i) => {
          const hUser = (d.user / max) * (CAO - 4);
          const hBot = (d.bot / max) * (CAO - 4);
          const x = i * w + w * 0.15;
          const bw = w * 0.7;
          const mo = chon !== null && chon !== i ? 0.45 : 1;
          return (
            <g key={d.day} opacity={mo} onMouseEnter={() => setChon(i)} onClick={() => setChon(i)} className="cursor-pointer">
              <rect x={i * w} y={0} width={w} height={CAO} fill="transparent" />
              <rect x={x} y={CAO - hUser} width={bw} height={hUser} rx={0.6} className="fill-emerald-500/80 dark:fill-emerald-400/70" />
              <rect x={x} y={CAO - hUser - hBot} width={bw} height={hBot} rx={0.6} className="fill-emerald-800 dark:fill-emerald-200/80" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-soft">
        <span>{daily[0] ? nhanNgay(daily[0].day) : ""}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />Khách</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-800" />Bot</span>
        </span>
        <span>{daily[n - 1] ? nhanNgay(daily[n - 1]!.day) : ""}</span>
      </div>
    </div>
  );
}
