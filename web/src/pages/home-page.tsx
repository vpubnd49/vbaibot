import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { homeApi, type HomeSummary } from "../home-api-client";
import { IconBolt, IconChat } from "../shared/dashboard-icons";
import { IconAlert, IconCalendar, IconChart, IconPlug } from "../shared/warm-icons";
import { LoadingCard, SectionHeading, StatTile } from "../shared/warm-ui";
import { loiChao, ngayDayDu, soGon } from "../shared/vn-format";
import { HomeHealthCard } from "./home-health-card";
import { HomeUpcoming } from "./home-upcoming";

/**
 * Trang chủ kiểu "chủ bot xem nhanh trên điện thoại": lời chào, sức khỏe hệ
 * thống, 4 ô số, việc sắp tới. Tự làm mới mỗi 30 giây khi tab đang mở.
 */

const LAM_MOI_MS = 30_000;

export function HomePage() {
  const [data, setData] = useState<HomeSummary | null>(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    let huy = false;
    const tai = () => {
      if (document.hidden) return;
      homeApi
        .home()
        .then((d) => !huy && (setData(d), setLoi("")))
        .catch((e: unknown) => !huy && setLoi(e instanceof Error ? e.message : "Không tải được dữ liệu"));
    };
    tai();
    const t = setInterval(tai, LAM_MOI_MS);
    document.addEventListener("visibilitychange", tai);
    return () => {
      huy = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", tai);
    };
  }, []);

  const now = new Date();
  return (
    <div className="mx-auto w-full max-w-3xl pb-6">
      <h1 className="warm-title text-[32px] leading-tight sm:text-[38px]">{loiChao(now)}</h1>
      <p className="mb-4 text-[14px] text-ink-soft">{ngayDayDu(now)}</p>

      {loi && <p className="mb-3 rounded-2xl bg-rose-100 px-4 py-2.5 text-[13.5px] text-rose-700">{loi}</p>}
      {!data ? (
        <LoadingCard />
      ) : (
        <>
          <HomeHealthCard health={data.health} generatedAt={data.generatedAt} />

          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
            <StatTile icon={<IconPlug size={20} />} tone="sky" value={`${data.accounts.online}/${data.accounts.enabled}`} label="Tài khoản" to="/accounts" />
            <StatTile icon={<IconChat size={20} />} tone="emerald" value={soGon(data.messagesToday)} label="Tin hôm nay" to="/sessions" />
            <StatTile icon={<IconAlert size={20} />} tone={data.errors24h ? "rose" : "amber"} value={data.errors24h} label="Lỗi 24 giờ" to="/journal?loc=canh-bao" />
            <StatTile icon={<IconBolt size={20} />} tone="violet" value={soGon(data.turnsToday)} label="Lượt AI" to="/reports" />
          </div>

          <SectionHeading
            title="Việc sắp tới"
            right={
              <Link to="/schedule" className="text-[14px] font-semibold text-zalo-600 hover:underline">
                Xem tất cả ›
              </Link>
            }
          />
          <HomeUpcoming jobs={data.upcoming} />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link to="/reports" className="warm-card flex items-center gap-3 p-4 hover:-translate-y-0.5 transition-transform">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zalo-50 text-zalo-600"><IconChart size={20} /></span>
              <span><b className="block text-[15px] text-ink">Báo cáo</b><span className="text-[12.5px] text-ink-soft">7 / 30 ngày</span></span>
            </Link>
            <Link to="/journal" className="warm-card flex items-center gap-3 p-4 hover:-translate-y-0.5 transition-transform">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><IconCalendar size={20} /></span>
              <span><b className="block text-[15px] text-ink">Nhật ký</b><span className="text-[12.5px] text-ink-soft">{data.warnings24h} cảnh báo / 24h</span></span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
