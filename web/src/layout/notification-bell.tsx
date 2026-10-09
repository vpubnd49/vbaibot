import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { homeApi } from "../home-api-client";
import { IconBell } from "../shared/warm-icons";

/**
 * Chuông thông báo: đếm LỖI (error) mới kể từ lần cuối bấm chuông.
 * Mốc "đã xem" lưu localStorage theo trình duyệt - không cần bảng DB riêng.
 * Bấm -> Nhật ký lọc sẵn Cảnh báo.
 */

const KHOA = "vbai-bell-seen";
const CHU_KY_MS = 60_000;

export function NotificationBell() {
  const navigate = useNavigate();
  const [soMoi, setSoMoi] = useState(0);

  useEffect(() => {
    let huy = false;
    const tai = () => {
      if (document.hidden) return;
      const daXem = Number(localStorage.getItem(KHOA) ?? 0);
      homeApi
        .home()
        .then((d) => !huy && setSoMoi(d.recentIncidents.filter((i) => i.time > daXem).length))
        .catch(() => undefined);
    };
    tai();
    const t = setInterval(tai, CHU_KY_MS);
    return () => {
      huy = true;
      clearInterval(t);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label={soMoi ? `${soMoi} lỗi mới` : "Thông báo"}
      onClick={() => {
        localStorage.setItem(KHOA, String(Date.now()));
        setSoMoi(0);
        navigate("/journal?loc=canh-bao");
      }}
      className="relative rounded-xl p-2 text-ink-soft transition-all hover:bg-tile hover:text-ink active:scale-95"
    >
      <IconBell size={21} />
      {soMoi > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10.5px] font-bold text-white">
          {soMoi > 9 ? "9+" : soMoi}
        </span>
      )}
    </button>
  );
}
