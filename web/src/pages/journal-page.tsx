import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { homeApi, type JournalDay, type JournalEvent } from "../home-api-client";
import { congNgay, khoaNgay, ngayDayDu, tuKhoaNgay } from "../shared/vn-format";
import { SegmentedTabs, WarmPageTitle } from "../shared/warm-ui";
import { JournalCalendar, dauTuan, oThang } from "./journal-calendar";
import { CHIP, JournalEventList, JournalFilterChips, type BoLoc } from "./journal-event-list";

/**
 * Nhật ký dạng lịch Tháng / Tuần / Ngày. Chọn ngày -> xem sự kiện đã gom
 * (tin khách, liên hệ mới, lịch hẹn, cấu hình, cảnh báo/lỗi).
 * `?loc=canh-bao` mở sẵn bộ lọc (dùng cho ô "Lỗi 24 giờ" ở Trang chủ).
 */

type CheDo = "thang" | "tuan" | "ngay";

export function JournalPage() {
  const [params] = useSearchParams();
  const today = khoaNgay(new Date());
  const [cheDo, setCheDo] = useState<CheDo>("thang");
  const [chon, setChon] = useState(today);
  const [moc, setMoc] = useState(today); // ngày neo cho tháng/tuần đang xem
  const locBanDau = params.get("loc");
  const [loc, setLoc] = useState<BoLoc>(CHIP.some((c) => c.value === locBanDau) ? (locBanDau as BoLoc) : "tat-ca");
  const [summary, setSummary] = useState<Map<string, JournalDay>>(new Map());
  const [logDays, setLogDays] = useState<string[]>([]);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [dangTai, setDangTai] = useState(true);

  const cells = useMemo<(string | null)[]>(() => {
    if (cheDo === "thang") return oThang(moc);
    if (cheDo === "tuan") return Array.from({ length: 7 }, (_, i) => congNgay(dauTuan(moc), i));
    return [];
  }, [cheDo, moc]);

  // Tải tóm tắt cho khoảng đang hiển thị (đổi ngày chọn trong cùng tháng không tải lại)
  const ngayHienThi = cells.filter((c): c is string => !!c);
  const from = ngayHienThi[0] ?? chon;
  const to = ngayHienThi[ngayHienThi.length - 1] ?? chon;
  useEffect(() => {
    homeApi
      .journalDays(from, to)
      .then((r) => (setSummary(new Map(r.days.map((d) => [d.day, d]))), setLogDays(r.logDays)))
      .catch(() => setSummary(new Map()));
  }, [from, to]);

  useEffect(() => {
    setDangTai(true);
    homeApi
      .journalEvents(chon)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]))
      .finally(() => setDangTai(false));
  }, [chon]);

  const loc_ = loc === "tat-ca" ? events : events.filter((e) => e.type === loc);
  const d = tuKhoaNgay(moc);
  const tieuDe =
    cheDo === "thang"
      ? `Tháng ${d.getMonth() + 1} / ${d.getFullYear()}`
      : cheDo === "tuan"
        ? `Tuần ${dauTuan(moc).slice(8)}/${dauTuan(moc).slice(5, 7)} – ${congNgay(dauTuan(moc), 6).slice(8)}/${congNgay(dauTuan(moc), 6).slice(5, 7)}`
        : ngayDayDu(tuKhoaNgay(chon));

  const lui = (huong: 1 | -1) => {
    if (cheDo === "ngay") {
      const n = congNgay(chon, huong);
      setChon(n);
      setMoc(n);
    } else if (cheDo === "tuan") setMoc(congNgay(moc, 7 * huong));
    else setMoc(khoaNgay(new Date(d.getFullYear(), d.getMonth() + huong, 1)));
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-6">
      <WarmPageTitle eyebrow="Lịch sử" title="Nhật ký" />
      <SegmentedTabs
        options={[{ value: "thang", label: "Tháng" }, { value: "tuan", label: "Tuần" }, { value: "ngay", label: "Ngày" }]}
        value={cheDo}
        onChange={(v) => (setCheDo(v), setMoc(chon))}
      />

      <div className="warm-card p-4">
        <div className="mb-3 flex items-center justify-between text-[14px]">
          <button type="button" onClick={() => lui(-1)} className="font-medium text-ink-soft hover:text-ink">‹ Trước</button>
          <b className="text-[15.5px] text-ink">{tieuDe}</b>
          <button type="button" onClick={() => lui(1)} className="font-medium text-ink-soft hover:text-ink">Sau ›</button>
        </div>
        {cheDo !== "ngay" ? (
          <JournalCalendar cells={cells} summary={summary} selected={chon} today={today} onSelect={setChon} />
        ) : (
          <p className="text-center text-[13px] text-ink-soft">Dùng ‹ Trước / Sau › để chuyển ngày</p>
        )}
      </div>

      <div className="mb-2.5 mt-6 flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-tight text-ink">{ngayDayDu(tuKhoaNgay(chon))}</h2>
        <span className="shrink-0 rounded-full bg-tile px-3 py-1 text-[13px] text-ink-soft">{loc_.length} sự kiện</span>
      </div>
      <JournalFilterChips value={loc} onChange={setLoc} />
      <JournalEventList events={loc_} loading={dangTai} />

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
        Chấm vàng là mục cần chú ý, chấm đỏ là sự cố. Tin nhắn, liên hệ, lịch hẹn lưu lâu dài; cảnh báo/lỗi lấy từ file
        log nên chỉ còn {logDays.length > 0 ? `từ ${logDays[0]!.slice(8)}/${logDays[0]!.slice(5, 7)}` : "trong vài ngày gần nhất"}.
      </p>
    </div>
  );
}
