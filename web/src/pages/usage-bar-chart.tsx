import { formatNumber } from "../shared/ui-bits";

export type UsageDay = {
  day: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
};

export type UsageItem = {
  day?: string;
  periodKey?: string;
  label?: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
};

/**
 * Biểu đồ cột mức dùng đa chu kỳ (Ngày / Tuần / Tháng / Năm).
 * HTML + CSS thuần, không cần thêm thư viện ngoài.
 */

const NGUONG_HIEN_SO = 10;

function buocNhan(soCot: number): number {
  if (soCot <= 10) return 1;
  if (soCot <= 16) return 2;
  return 5;
}

export function UsageBarChart({
  data,
  metric,
}: {
  data: (UsageDay | UsageItem)[];
  /** Đang xem số lượt hay số token */
  metric: "turns" | "tokens";
}) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-[13px] text-ink-soft">Chưa có dữ liệu thống kê</div>;
  }

  const giaTri = (d: UsageDay | UsageItem) => (metric === "turns" ? d.turns : d.inputTokens + d.outputTokens);
  const dinhTruc = tranTruc(Math.max(...data.map(giaTri), 0));
  const buoc = buocNhan(data.length);
  const vach = Array.from({ length: 5 }, (_, i) => Math.round((dinhTruc / 4) * (4 - i)));
  const chiSoMoiNhat = data.length - 1;

  const layNhan = (d: UsageDay | UsageItem): string => {
    if ("label" in d && d.label) return d.label;
    if ("day" in d && d.day) return d.day;
    if ("periodKey" in d && d.periodKey) return d.periodKey;
    return "";
  };

  const layNhanNgan = (d: UsageDay | UsageItem): string => {
    const raw = layNhan(d);
    // Nếu là ngày YYYY-MM-DD -> lấy MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(5);
    // Nếu là tháng YYYY-MM -> lấy MM/YY
    if (/^\d{4}-\d{2}$/.test(raw)) return raw.slice(5) + "/" + raw.slice(2, 4);
    // Nếu là Tuần xx -> lấy ngắn gọn
    if (raw.startsWith("Tuần ")) {
      const match = raw.match(/Tuần (\d+)/);
      return match ? `T${match[1]}` : raw;
    }
    return raw;
  };

  return (
    <div>
      <div className="flex gap-3">
        {/* Trục Y */}
        <div className="flex h-52 w-12 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-ink-soft">
          {vach.map((v) => (
            <span key={v} className="leading-none">
              {formatNumber(v)}
            </span>
          ))}
        </div>

        <div className="relative h-52 min-w-0 flex-1">
          {/* Lưới ngang nét đứt */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {vach.map((v) => (
              <div key={v} className="border-t border-dashed border-line" />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-2 sm:gap-4">
            {data.map((d, i) => {
              const v = giaTri(d);
              const cao = dinhTruc > 0 ? (v / dinhTruc) * 100 : 0;
              const noiBat = i === chiSoMoiNhat;
              const nhan = layNhan(d);
              const key = ("periodKey" in d && d.periodKey) || ("day" in d && d.day) || String(i);

              return (
                <div key={key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  {data.length <= NGUONG_HIEN_SO && (
                    <span
                      className={`mb-1.5 text-[11px] font-semibold tabular-nums ${
                        noiBat ? "text-zalo-600 dark:text-zalo-400" : "text-ink-soft"
                      }`}
                    >
                      {formatNumber(v)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[72px] rounded-t-md transition-colors ${
                      noiBat
                        ? "bg-zalo-500 shadow-sm"
                        : "bg-zalo-500/40 hover:bg-zalo-500/70 dark:bg-zalo-400/40 dark:hover:bg-zalo-400/70"
                    }`}
                    style={{ height: `max(4px, ${cao}%)` }}
                    title={`${nhan}: ${formatNumber(d.turns)} lượt, ${formatNumber(
                      d.inputTokens,
                    )} token vào, ${formatNumber(d.outputTokens)} token ra (Tổng: ${formatNumber(
                      d.inputTokens + d.outputTokens,
                    )} token)`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Nhãn trục X */}
      <div className="mt-2 flex gap-3">
        <div className="w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-2 border-t border-line pt-2 sm:gap-4">
          {data.map((d, i) => {
            const key = ("periodKey" in d && d.periodKey) || ("day" in d && d.day) || String(i);
            const hienNhan = (data.length - 1 - i) % buoc === 0;
            return (
              <div
                key={key}
                className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-ink-soft"
                title={layNhan(d)}
              >
                {hienNhan ? layNhanNgan(d) : ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function tranTruc(max: number): number {
  if (max <= 4) return 4;
  const buoc = max / 4;
  const bac = 10 ** Math.floor(Math.log10(buoc));
  const buocDep = [1, 2, 2.5, 5, 10].map((h) => bac * h).find((b) => b >= buoc) ?? buoc;
  return buocDep * 4;
}
