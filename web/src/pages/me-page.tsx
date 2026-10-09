import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  IconBolt,
  IconBot,
  IconBrain,
  IconChat,
  IconClock,
  IconCpu,
  IconDatabase,
  IconGear,
  IconLogout,
  IconMegaphone,
  IconMoon,
  IconSun,
  IconUsers,
} from "../shared/dashboard-icons";
import { useTheme } from "../shared/use-theme";
import { IconChart } from "../shared/warm-icons";
import { WarmPageTitle } from "../shared/warm-ui";

/**
 * Mục "Tôi" trên thanh điều hướng điện thoại: gom mọi trang quản trị còn lại
 * (thanh dưới chỉ đủ chỗ cho 5 mục). Trên máy tính đã có sidebar nên trang này
 * chủ yếu phục vụ mobile.
 */

type Muc = { to: string; label: string; hint: string; icon: ReactNode };

const NHOM: { title: string; items: Muc[] }[] = [
  {
    title: "Hội thoại",
    items: [
      { to: "/sessions", label: "Phiên trò chuyện", hint: "Xem và tạm dừng bot từng cuộc chat", icon: <IconChat size={19} /> },
      { to: "/broadcast", label: "Gửi thông báo", hint: "Nhắn hàng loạt tới nhóm/khách", icon: <IconMegaphone size={19} /> },
      { to: "/schedule", label: "Lịch hẹn & Cron", hint: "Nhắc việc, báo cáo định kỳ", icon: <IconClock size={19} /> },
      { to: "/contacts", label: "Danh bạ Zalo", hint: "Khách đã nhắn với bot", icon: <IconUsers size={19} /> },
    ],
  },
  {
    title: "Thống kê",
    items: [
      { to: "/reports", label: "Báo cáo", hint: "Tổng hợp 7 / 30 ngày", icon: <IconChart size={19} /> },
      { to: "/insights", label: "Phân tích Insight", hint: "Thống kê chiều sâu các cuộc hội thoại", icon: <IconBrain size={19} /> },
      { to: "/usage", label: "Mức sử dụng token", hint: "Token theo ngày, tuần, tháng, năm", icon: <IconBolt size={19} /> },
      { to: "/trace", label: "Trace Agent", hint: "Xem từng bước bot suy nghĩ", icon: <IconCpu size={19} /> },
      { to: "/logs", label: "Log hệ thống", hint: "Log kỹ thuật thời gian thực", icon: <IconDatabase size={19} /> },
    ],
  },
  {
    title: "Cấu hình",
    items: [
      { to: "/agents", label: "Trợ lý Agent", hint: "Persona, model, công cụ", icon: <IconBot size={19} /> },
      { to: "/tools", label: "Công cụ & Skill", hint: "Bật/tắt và cấu hình tool", icon: <IconBolt size={19} /> },
      { to: "/memory", label: "Trí nhớ bền vững", hint: "Điều bot nhớ về khách", icon: <IconBrain size={19} /> },
      { to: "/knowledge", label: "Kho tri thức", hint: "Tri thức chung đã duyệt", icon: <IconDatabase size={19} /> },
      { to: "/tuning", label: "Cấu hình AI", hint: "Model, giới hạn, lịch, an toàn", icon: <IconGear size={19} /> },
    ],
  },
];

export function MePage({ onLogout }: { onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="mx-auto w-full max-w-3xl pb-6">
      <WarmPageTitle eyebrow="Tài khoản quản trị" title="Tôi" />
      {NHOM.map((g) => (
        <section key={g.title} className="mb-5">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{g.title}</h2>
          <div className="warm-card divide-y divide-line overflow-hidden">
            {g.items.map((m) => (
              <Link key={m.to} to={m.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-tile/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zalo-50 text-zalo-600">{m.icon}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] text-ink">{m.label}</b>
                  <span className="block truncate text-[12.5px] text-ink-soft">{m.hint}</span>
                </span>
                <span className="text-ink-soft">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <div className="warm-card divide-y divide-line overflow-hidden">
        <button type="button" onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-tile/60">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tile text-ink">{theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}</span>
          <b className="flex-1 text-[15px] text-ink">{theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}</b>
        </button>
        <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-3 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/15"><IconLogout size={19} /></span>
          <b className="flex-1 text-[15px]">Đăng xuất</b>
        </button>
      </div>
    </div>
  );
}
