import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AccountInfo } from "../dashboard-api-client";
import { homeApi, type OverallInsight } from "../home-api-client";
import { IconBolt, IconChat, IconClock, IconUsers } from "../shared/dashboard-icons";
import { soGon, truocDay } from "../shared/vn-format";
import { LoadingCard, SectionHeading, SegmentedTabs, StatTile, WarmPageTitle } from "../shared/warm-ui";

export function InsightPage({ accounts }: { accounts: AccountInfo[] }) {
  const [selectedAcc, setSelectedAcc] = useState<string>("all");
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<OverallInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    homeApi
      .insights(selectedAcc, days)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAcc, days]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <WarmPageTitle
          eyebrow="Chiều sâu"
          title="Phân tích Insight"
          right={<span className="text-xs text-ink-soft">Theo dõi tương tác hội thoại</span>}
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAcc}
            onChange={(e) => setSelectedAcc(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs outline-none focus:border-zalo-500"
          >
            <option value="all">Tất cả tài khoản ({accounts.length})</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>

          <SegmentedTabs
            value={days}
            onChange={(v) => setDays(Number(v))}
            options={[
              { value: 7, label: "7 ngày" },
              { value: 30, label: "30 ngày" },
              { value: 90, label: "90 ngày" },
            ]}
          />
        </div>
      </div>

      {loading || !data ? (
        <LoadingCard text="Đang nạp dữ liệu phân tích..." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatTile icon={<IconUsers size={20} />} label="Cuộc hội thoại" value={soGon(data.totalThreads)} tone="sky" />
            <StatTile icon={<IconChat size={20} />} label="Lượt trả lời AI" value={soGon(data.totalTurns)} tone="emerald" />
            <StatTile icon={<IconBolt size={20} />} label="Token tiêu thụ" value={soGon(data.totalTokens)} tone="amber" to="/usage" />
            <StatTile icon={<IconClock size={20} />} label="Phản hồi TB" value={`${data.averageResponseTimeMs}ms`} tone="violet" />
          </div>

          {/* Biểu đồ xu hướng tương tác */}
          {data.turnsByDay.length > 0 && (
            <div className="warm-card p-4 sm:p-6 space-y-3">
              <SectionHeading title="Tần suất tương tác theo ngày" right={<span className="text-xs text-ink-soft">{days} ngày</span>} />
              <div className="flex h-36 items-end gap-1.5 pt-4">
                {(() => {
                  const max = Math.max(1, ...data.turnsByDay.map((d) => d.count));
                  return [...data.turnsByDay].reverse().map((d) => {
                    const h = Math.round((d.count / max) * 100);
                    return (
                      <div key={d.day} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                        <div
                          style={{ height: `${Math.max(4, h)}%` }}
                          className="w-full rounded-t bg-zalo-600/70 group-hover:bg-zalo-600 transition-colors"
                        />
                        <div className="absolute -top-7 hidden group-hover:block z-10 rounded bg-ink px-1.5 py-0.5 text-[10px] text-canvas shadow whitespace-nowrap">
                          {d.day.slice(5)}: {d.count} lượt
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Danh sách cuộc trò chuyện tương tác nhiều nhất */}
          <div className="warm-card p-4 sm:p-6 space-y-4">
            <SectionHeading
              title="Top cuộc trò chuyện tương tác nhiều nhất"
              right={<span className="text-xs text-ink-soft">{data.topThreads.length} cuộc hội thoại</span>}
            />

            {data.topThreads.length === 0 ? (
              <p className="text-xs text-ink-soft italic py-4 text-center">Chưa có dữ liệu trò chuyện trong khoảng thời gian này</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold text-ink-soft">
                      <th className="pb-2.5">Hội thoại / Nhóm</th>
                      <th className="pb-2.5 text-right">Lượt AI</th>
                      <th className="pb-2.5 text-right">Tổng token</th>
                      <th className="pb-2.5 text-right hidden sm:table-cell">Token/lượt</th>
                      <th className="pb-2.5 text-right hidden md:table-cell">Gần nhất</th>
                      <th className="pb-2.5 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {data.topThreads.map((t) => (
                      <tr key={t.threadId} className="hover:bg-tile/40 transition-colors">
                        <td className="py-3 pr-2">
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                t.threadType === 1
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {t.threadType === 1 ? "Nhóm" : "Cá nhân"}
                            </span>
                            <span className="truncate max-w-[200px] sm:max-w-[280px]" title={t.threadName}>
                              {t.threadName}
                            </span>
                          </div>
                          <div className="text-[10px] text-ink-soft">ID: {t.threadId}</div>
                        </td>
                        <td className="py-3 text-right font-medium">{soGon(t.totalTurns)}</td>
                        <td className="py-3 text-right font-medium text-amber-600 dark:text-amber-400">
                          {soGon(t.totalTokens)}
                        </td>
                        <td className="py-3 text-right hidden sm:table-cell text-ink-soft">
                          {soGon(t.avgTokensPerTurn)}
                        </td>
                        <td className="py-3 text-right hidden md:table-cell text-ink-soft">
                          {truocDay(new Date(t.lastActivity).getTime())}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/sessions`}
                            className="rounded-lg bg-tile px-2 py-1 text-[11px] font-medium text-zalo-600 hover:bg-zalo-50 transition-colors"
                          >
                            Xem chat
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
