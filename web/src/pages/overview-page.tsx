import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { OverviewData, UsageGranularity } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import {
  IconBolt,
  IconBrain,
  IconChat,
  IconClock,
  IconCpu,
  IconDatabase,
  IconGrid,
  IconHeart,
  IconMessage,
  IconSignal,
  IconUsers,
} from "../shared/dashboard-icons";
import {
  Badge,
  formatNumber,
  formatUptime,
  InfoTile,
  SectionCard,
  StatCard,
} from "../shared/ui-bits";
import { SelectMenu } from "../shared/select-menu";
import { UsageBarChart, type UsageItem } from "./usage-bar-chart";

export function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [chiSo, setChiSo] = useState<"turns" | "tokens">("tokens");
  const [granularity, setGranularity] = useState<UsageGranularity>("day");
  const [soNgay, setSoNgay] = useState(7);

  useEffect(() => {
    api.overview({ days: soNgay, granularity })
      .then(setData)
      .catch(() => setData(null));
  }, [soNgay, granularity]);

  if (!data) return <p className="text-ink-soft">Đang tải...</p>;

  // Tổng hợp stats từ các accounts
  const stats = data.statsByAccount.reduce(
    (acc, { stats: s }) => ({
      threads: acc.threads + s.threads,
      contacts: acc.contacts + s.contacts,
      memories: acc.memories + s.memories,
      messagesTotal: acc.messagesTotal + s.messagesTotal,
      messagesToday: acc.messagesToday + s.messagesToday,
    }),
    { threads: 0, contacts: 0, memories: 0, messagesTotal: 0, messagesToday: 0 },
  );

  // Tổng hợp token summary 4 mốc: Hôm nay, Tuần này, Tháng này, Năm này, Toàn thời gian
  const tokenSummary = (data.tokenSummaryByAccount ?? []).reduce(
    (acc, { summary }) => ({
      today: {
        inputTokens: acc.today.inputTokens + summary.today.inputTokens,
        outputTokens: acc.today.outputTokens + summary.today.outputTokens,
        totalTokens: acc.today.totalTokens + summary.today.totalTokens,
        turns: acc.today.turns + summary.today.turns,
      },
      thisWeek: {
        inputTokens: acc.thisWeek.inputTokens + summary.thisWeek.inputTokens,
        outputTokens: acc.thisWeek.outputTokens + summary.thisWeek.outputTokens,
        totalTokens: acc.thisWeek.totalTokens + summary.thisWeek.totalTokens,
        turns: acc.thisWeek.turns + summary.thisWeek.turns,
      },
      thisMonth: {
        inputTokens: acc.thisMonth.inputTokens + summary.thisMonth.inputTokens,
        outputTokens: acc.thisMonth.outputTokens + summary.thisMonth.outputTokens,
        totalTokens: acc.thisMonth.totalTokens + summary.thisMonth.totalTokens,
        turns: acc.thisMonth.turns + summary.thisMonth.turns,
      },
      thisYear: {
        inputTokens: acc.thisYear.inputTokens + summary.thisYear.inputTokens,
        outputTokens: acc.thisYear.outputTokens + summary.thisYear.outputTokens,
        totalTokens: acc.thisYear.totalTokens + summary.thisYear.totalTokens,
        turns: acc.thisYear.turns + summary.thisYear.turns,
      },
      allTime: {
        inputTokens: acc.allTime.inputTokens + summary.allTime.inputTokens,
        outputTokens: acc.allTime.outputTokens + summary.allTime.outputTokens,
        totalTokens: acc.allTime.totalTokens + summary.allTime.totalTokens,
        turns: acc.allTime.turns + summary.allTime.turns,
      },
    }),
    {
      today: { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 },
      thisWeek: { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 },
      thisMonth: { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 },
      thisYear: { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 },
      allTime: { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 },
    },
  );

  // Tổng hợp grouped usage từ groupedUsageByAccount (hoặc fallback sang usageByAccount)
  const groupedMap = new Map<
    string,
    { periodKey: string; label: string; turns: number; inputTokens: number; outputTokens: number; totalTokens: number }
  >();

  if (data.groupedUsageByAccount && data.groupedUsageByAccount.length > 0) {
    for (const { items } of data.groupedUsageByAccount) {
      for (const item of items) {
        const agg = groupedMap.get(item.periodKey) ?? {
          periodKey: item.periodKey,
          label: item.label,
          turns: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        };
        agg.turns += item.turns;
        agg.inputTokens += item.inputTokens;
        agg.outputTokens += item.outputTokens;
        agg.totalTokens += item.totalTokens;
        groupedMap.set(item.periodKey, agg);
      }
    }
  } else {
    for (const { daily } of data.usageByAccount) {
      for (const d of daily) {
        const agg = groupedMap.get(d.day) ?? {
          periodKey: d.day,
          label: d.day,
          turns: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        };
        agg.turns += d.turns;
        agg.inputTokens += d.inputTokens;
        agg.outputTokens += d.outputTokens;
        agg.totalTokens += d.inputTokens + d.outputTokens;
        groupedMap.set(d.day, agg);
      }
    }
  }

  // Dãy tăng dần thời gian (cũ -> mới) cho biểu đồ
  const series: UsageItem[] = [...groupedMap.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey),
  );

  const tongLuot = series.reduce((n, d) => n + d.turns, 0);
  const tongInputToken = series.reduce((n, d) => n + d.inputTokens, 0);
  const tongOutputToken = series.reduce((n, d) => n + d.outputTokens, 0);
  const tongToken = tongInputToken + tongOutputToken;
  const trungBinhKy = series.length > 0 ? Math.round(tongToken / series.length) : 0;

  return (
    <div>
      <PageHeader icon={IconGrid} title="Tổng quan" subtitle="Trạng thái bot và thống kê token LLM" />

      {!data.system.llm.daCauHinh && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
            Chưa cấu hình LLM - bot chưa trả lời được tin nhắn nào
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
            Thiếu API key, tên model hoặc base URL.{" "}
            <Link to="/tuning/providers" className="font-medium underline underline-offset-2">
              Nhập ở trang Cấu hình
            </Link>
          </div>
        </div>
      )}

      {/* 4 thẻ chỉ số nhanh ở đầu */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={IconMessage}
          label="Tin nhắn hôm nay"
          value={formatNumber(stats?.messagesToday ?? 0)}
          sub={<span className="text-ink-soft">/ {formatNumber(stats?.messagesTotal ?? 0)} tổng</span>}
        />
        <StatCard
          icon={IconBolt}
          label="Lượt agent hôm nay"
          value={formatNumber(tokenSummary.today.turns)}
          series={series.map((d) => d.turns)}
        />
        <StatCard
          icon={IconCpu}
          label="Token hôm nay"
          value={formatNumber(tokenSummary.today.totalTokens)}
          sub={
            <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-soft">
              <span>{formatNumber(tokenSummary.today.inputTokens)} vào</span>
              <span>·</span>
              <span>{formatNumber(tokenSummary.today.outputTokens)} ra</span>
            </div>
          }
          series={series.map((d) => d.inputTokens + d.outputTokens)}
        />
        <StatCard
          icon={IconUsers}
          label="Contacts"
          value={formatNumber(stats?.contacts ?? 0)}
          sub={<span className="text-ink-soft">{formatNumber(stats?.threads ?? 0)} sessions</span>}
        />
      </div>

      {/* 4 THẺ THỐNG KÊ TOKEN: Ngày, Tuần, Tháng, Năm */}
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconCpu className="text-zalo-500" />
            <h2 className="text-[15px] font-semibold text-ink">Thống kê Token theo Mốc thời gian</h2>
          </div>
          <span className="text-[12px] text-ink-soft">Múi giờ: {data.timezone}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TokenPeriodCard
            title="Hôm nay"
            subTitle="Trong ngày hiện tại"
            badge="Ngày"
            badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            metric={tokenSummary.today}
          />
          <TokenPeriodCard
            title="Tuần này"
            subTitle="Từ Thứ Hai đến nay"
            badge="Tuần"
            badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            metric={tokenSummary.thisWeek}
          />
          <TokenPeriodCard
            title="Tháng này"
            subTitle="Từ đầu tháng đến nay"
            badge="Tháng"
            badgeColor="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
            metric={tokenSummary.thisMonth}
          />
          <TokenPeriodCard
            title="Năm này"
            subTitle="Lũy kế từ 01/01"
            badge="Năm"
            badgeColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            metric={tokenSummary.thisYear}
          />
        </div>
      </div>

      {/* BIỂU ĐỒ & BẢNG PHÂN TÍCH THEO CHU KỲ (NGÀY / TUẦN / THÁNG / NĂM) */}
      <div className="mb-5">
        <SectionCard
          icon={IconBolt}
          title="Phân tích Mức sử dụng & Token"
          subtitle={`Chi tiết mức dùng theo ${
            granularity === "day"
              ? `${data.days} ngày gần nhất`
              : granularity === "week"
                ? "12 tuần qua"
                : granularity === "month"
                  ? "12 tháng qua"
                  : "các năm"
          }`}
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {/* Bộ chọn Granularity: Ngày / Tuần / Tháng / Năm */}
              <div className="flex rounded-lg border border-line bg-surface p-0.5">
                {(
                  [
                    ["day", "Ngày"],
                    ["week", "Tuần"],
                    ["month", "Tháng"],
                    ["year", "Năm"],
                  ] as const
                ).map(([key, nhan]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGranularity(key)}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      granularity === key
                        ? "bg-zalo-500 text-white shadow-sm"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {nhan}
                  </button>
                ))}
              </div>

              {/* Bộ chọn chỉ số: Token / Lượt dùng */}
              <div className="flex rounded-lg border border-line p-0.5">
                {(
                  [
                    ["tokens", "Token"],
                    ["turns", "Lượt dùng"],
                  ] as const
                ).map(([key, nhan]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChiSo(key)}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      chiSo === key ? "bg-zalo-50 text-zalo-700 dark:bg-zalo-950 dark:text-zalo-300" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {nhan}
                  </button>
                ))}
              </div>

              {/* Khoảng thời gian cho Ngày */}
              {granularity === "day" && <ChonKhoangNgay giaTri={soNgay} onChange={setSoNgay} />}
            </div>
          }
        >
          {/* Ô tổng kết */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TongKet
              nhan="Tổng Token trong kỳ"
              giaTri={formatNumber(tongToken)}
              phu={`Vào: ${formatNumber(tongInputToken)} · Ra: ${formatNumber(tongOutputToken)}`}
              mau="bg-emerald-500"
            />
            <TongKet
              nhan="Tổng lượt Agent"
              giaTri={formatNumber(tongLuot)}
              phu={`Trung bình: ${series.length > 0 ? (tongLuot / series.length).toFixed(1) : 0} lượt / kỳ`}
              mau="bg-zalo-500"
            />
            <TongKet
              nhan="Trung bình Token / kỳ"
              giaTri={formatNumber(trungBinhKy)}
              phu={`Gồm ${series.length} chu kỳ thống kê`}
              mau="bg-violet-500"
            />
          </div>

          {/* Biểu đồ cột */}
          <div className="mb-6">
            <UsageBarChart data={series} metric={chiSo} />
            <p className="mt-3 text-[12px] text-ink-soft">
              Rê chuột vào từng cột để xem chi tiết số lượt và token vào/ra.
            </p>
          </div>

          {/* BẢNG CHI TIẾT SỐ LIỆU */}
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-3 text-[13px] font-semibold text-ink">Bảng số liệu chi tiết</h3>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-line bg-surface-soft font-semibold text-ink-soft">
                  <tr>
                    <th className="px-3.5 py-2.5">Thời gian</th>
                    <th className="px-3.5 py-2.5 text-right">Lượt Agent</th>
                    <th className="px-3.5 py-2.5 text-right">Token Vào (Prompt)</th>
                    <th className="px-3.5 py-2.5 text-right">Token Ra (Output)</th>
                    <th className="px-3.5 py-2.5 text-right">Tổng Token</th>
                    <th className="px-3.5 py-2.5 text-right">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...series].reverse().map((row) => {
                    const tyLe = tongToken > 0 ? ((row.inputTokens + row.outputTokens) / tongToken) * 100 : 0;
                    return (
                      <tr key={row.periodKey} className="hover:bg-surface-soft/50 transition-colors">
                        <td className="px-3.5 py-2.5 font-medium text-ink">
                          {row.label}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-ink">
                          {formatNumber(row.turns)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-ink-soft">
                          {formatNumber(row.inputTokens)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-ink-soft">
                          {formatNumber(row.outputTokens)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatNumber(row.inputTokens + row.outputTokens)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-ink-soft">
                          {tyLe.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-line bg-surface-soft font-semibold text-ink">
                  <tr>
                    <td className="px-3.5 py-2.5">Tổng cộng ({series.length} kỳ)</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{formatNumber(tongLuot)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{formatNumber(tongInputToken)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{formatNumber(tongOutputToken)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatNumber(tongToken)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Tình trạng hệ thống */}
      <SectionCard
        icon={IconHeart}
        title="Tình trạng hệ thống"
        subtitle="Bot đang chạy ra sao và giữ bao nhiêu dữ liệu"
        aside={<Badge tone="gray" dot={false}>node {data.system.nodeVersion}</Badge>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <InfoTile
            icon={IconClock}
            label="Uptime"
            value={formatUptime(data.system.uptimeSeconds)}
            hint="Thời gian hoạt động"
          />
          <InfoTile icon={IconDatabase} label="Database" value="SQLite · Connected" hint="Trạng thái kết nối" />
          <InfoTile
            icon={IconSignal}
            label="Accounts online"
            value={`${data.accounts.filter((a) => a.online).length} / ${data.accounts.length}`}
            hint="Tài khoản đang online"
          />
          <InfoTile
            icon={IconChat}
            label="Sessions"
            value={formatNumber(stats?.threads ?? 0)}
            hint="Phiên hội thoại"
          />
          <InfoTile
            icon={IconUsers}
            label="Contacts"
            value={formatNumber(stats?.contacts ?? 0)}
            hint="Tổng số liên hệ"
          />
          <InfoTile
            icon={IconBrain}
            label="Memory facts"
            value={formatNumber(stats?.memories ?? 0)}
            hint="Dữ liệu trí nhớ"
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            Kênh
          </div>
          <div className="flex flex-wrap gap-2">
            {data.accounts.map((a) => (
              <Badge key={a.id} tone={a.online ? "green" : a.enabled ? "red" : "gray"}>
                {a.label}
              </Badge>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/** Thẻ thống kê Token cho 1 mốc thời gian (Hôm nay, Tuần này, Tháng này, Năm này) */
function TokenPeriodCard({
  title,
  subTitle,
  badge,
  badgeColor,
  metric,
}: {
  title: string;
  subTitle: string;
  badge: string;
  badgeColor: string;
  metric: { inputTokens: number; outputTokens: number; totalTokens: number; turns: number };
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-soft">{subTitle}</div>

      <div className="mt-3 text-[22px] font-bold tabular-nums text-ink">
        {formatNumber(metric.totalTokens)}
        <span className="ml-1 text-[12px] font-normal text-ink-soft">tokens</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-2.5 text-[11px]">
        <div>
          <span className="text-ink-soft">Vào (Prompt):</span>
          <div className="font-semibold tabular-nums text-ink">
            {formatNumber(metric.inputTokens)}
          </div>
        </div>
        <div>
          <span className="text-ink-soft">Ra (Output):</span>
          <div className="font-semibold tabular-nums text-ink">
            {formatNumber(metric.outputTokens)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
        <span>Lượt agent:</span>
        <span className="font-semibold tabular-nums text-zalo-600 dark:text-zalo-400">
          {formatNumber(metric.turns)} lượt
        </span>
      </div>
    </div>
  );
}

function ChonKhoangNgay({ giaTri, onChange }: { giaTri: number; onChange: (n: number) => void }) {
  return (
    <SelectMenu
      icon={IconClock}
      ariaLabel="Khoảng ngày của biểu đồ"
      value={String(giaTri)}
      options={[7, 14, 30].map((n) => ({ value: String(n), label: `${n} ngày qua` }))}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function TongKet({
  nhan,
  giaTri,
  phu,
  mau,
}: {
  nhan: string;
  giaTri: string;
  phu?: string;
  mau: string;
}) {
  return (
    <div className="gc-tile">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${mau}`} />
        <span className="text-[12px] text-ink-soft">{nhan}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold text-ink">{giaTri}</div>
      {phu && <div className="mt-0.5 text-[11px] text-ink-soft">{phu}</div>}
    </div>
  );
}
