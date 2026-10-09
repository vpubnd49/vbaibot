import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { IconCpu, IconGrid } from "../shared/dashboard-icons";
import { IconCalendar, IconPlug, IconUser } from "../shared/warm-icons";

/**
 * Thanh điều hướng dưới đáy (điện thoại): Trang chủ · VPS · Zalo · Nhật ký · Tôi
 * - đúng thứ tự chủ bot hay xem: tình trạng -> máy chủ -> nick Zalo -> sự cố -> còn lại.
 */

const MUC: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/", label: "Trang chủ", icon: <IconGrid size={21} />, end: true },
  { to: "/vps", label: "VPS", icon: <IconCpu size={21} /> },
  { to: "/accounts", label: "Zalo", icon: <IconPlug size={21} /> },
  { to: "/journal", label: "Nhật ký", icon: <IconCalendar size={21} /> },
  { to: "/me", label: "Tôi", icon: <IconUser size={21} /> },
];

export function BottomNav() {
  return (
    <nav className="z-30 flex flex-shrink-0 select-none items-stretch justify-around border-t border-line bg-surface/95 px-1 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      {MUC.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          end={m.end}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1 transition-all active:scale-95 ${
              isActive ? "font-semibold text-zalo-600" : "text-ink-soft hover:text-ink"
            }`
          }
        >
          {m.icon}
          <span className="text-[11px]">{m.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
