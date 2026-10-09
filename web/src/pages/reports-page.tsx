import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { homeApi, type ReportSummary } from "../home-api-client";
import { IconBolt, IconBot, IconChat, IconClock, IconUsers } from "../shared/dashboard-icons";
import { IconAlert, IconChart } from "../shared/warm-icons";
import { LoadingCard, SectionHeading, SegmentedTabs, StatTile, WarmPageTitle } from "../shared/warm-ui";
import { soGon } from "../shared/vn-format";
import { ReportStackedChart } from "./report-stacked-chart";

/** Báo cáo tổng hợp 7 / 30 ngày - số liệu từ /api/reports */

function giay(ms: number): string {
  if (!ms) return "-";
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

export function ReportsPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loi, setLoi] = useState("");
  const [sendingVps, setSendingVps] = useState(false);
  const [vpsNotice, setVpsNotice] = useState("");

  useEffect(() => {
    setData(null);
    homeApi
      .reports(days)
      .then((d) => (setData(d), setLoi("")))
      .catch((e: unknown) => setLoi(e instanceof Error ? e.message : "Không tải được báo cáo"));
  }, [days]);

  const handleSendVpsReport = async () => {
    setSendingVps(true);
    setVpsNotice("");
    try {
      const res = await homeApi.sendVpsReport();
      setVpsNotice(res.message || "Đã gửi báo cáo VPS đến Zalo Admin");
    } catch (err) {
      setVpsNotice(err instanceof Error ? err.message : "Lỗi khi gửi báo cáo");
    } finally {
      setSendingVps(false);
    }
  };

  const t = data?.totals;
  return (
    <div className="w-full pb-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <WarmPageTitle eyebrow="Tổng hợp" title="Báo cáo" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/insights"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:border-zalo-500 transition-colors"
          >
            <IconChart size={15} />
            <span>Phân tích Insight</span>
          </Link>
          <button
            onClick={handleSendVpsReport}
            disabled={sendingVps}
            className="flex items-center gap-1.5 rounded-xl bg-zalo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zalo-700 disabled:opacity-50 transition-colors"
          >
            <span>{sendingVps ? "Đang gửi..." : "Gửi báo cáo VPS vào Zalo"}</span>
          </button>
        </div>
      </div>

      {vpsNotice && (
        <p className="mb-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {vpsNotice}
        </p>
      )}

      <SegmentedTabs options={[{ value: 7, label: "7 ngày" }, { value: 30, label: "30 ngày" }]} value={days} onChange={setDays} />

      {loi && <p className="mb-3 rounded-2xl bg-rose-100 px-4 py-2.5 text-[13.5px] text-rose-700">{loi}</p>}
      {!data || !t ? (
        <LoadingCard />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            <StatTile icon={<IconChat size={20} />} tone="emerald" value={soGon(t.user)} label="Tin khách" />
            <StatTile icon={<IconBot size={20} />} tone="stone" value={soGon(t.bot)} label="Bot trả lời" />
            <StatTile icon={<IconBolt size={20} />} tone="emerald" value={soGon(t.turns)} label="Lượt AI" />
            <StatTile icon={<IconClock size={20} />} tone="stone" value={soGon(t.tokens)} label="Token" to="/usage" />
            <StatTile icon={<IconUsers size={20} />} tone="emerald" value={soGon(t.newContacts)} label="Liên hệ mới" to="/contacts" />
            <StatTile icon={<IconAlert size={20} />} tone={t.errors ? "rose" : "amber"} value={soGon(t.errors + t.warnings)} label="Cảnh báo" to="/journal?loc=canh-bao" />
            <StatTile icon={<IconClock size={20} />} tone="emerald" value={giay(t.avgResponseMs)} label="Phản hồi TB" />
            <Link to="/journal" className="warm-card flex flex-col items-center justify-center px-2 py-3.5 text-center text-[13px] font-semibold text-ink-soft hover:text-ink">
              <span className="text-[20px]">›</span>Xem nhật ký
            </Link>
          </div>
          {data.logDaysAvailable < data.days && (
            <p className="mt-2 text-[12px] text-ink-soft">
              * Cảnh báo chỉ tính trong {data.logDaysAvailable} ngày gần nhất còn file log.
            </p>
          )}

          <SectionHeading title="Tin nhắn theo ngày" right={<span className="text-[13px] text-ink-soft">{days} ngày</span>} />
          <ReportStackedChart daily={data.daily} />

          <SectionHeading title="Theo tài khoản" />
          <div className="warm-card divide-y divide-line px-4">
            {data.byAccount.map((a) => (
              <div key={a.accountId} className="flex items-start gap-3 py-3">
                <b className="w-[38%] shrink-0 text-[14.5px] leading-snug text-ink">{a.label}</b>
                <span className="text-[13px] leading-snug text-ink-soft">
                  {soGon(a.user)} khách · {soGon(a.bot)} bot · {soGon(a.turns)} lượt · {soGon(a.tokens)} token · {soGon(a.newContacts)} mới
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
