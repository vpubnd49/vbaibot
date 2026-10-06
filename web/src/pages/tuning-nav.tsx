import type { TuningGroup } from "../dashboard-api-client";
import { IconChevronRight } from "../shared/dashboard-icons";
import { GroupIconBox } from "./tuning-group-icon";

/**
 * Danh sách nhóm bên trái - CHỌN 1 lúc, không phải accordion mở-nhiều. Bấm
 * vào nhóm nào thì panel phải chỉ hiện đúng nhóm đó (`tuning-page.tsx`), nên ở
 * đây chỉ cần vẽ danh sách + trạng thái đang chọn, không tự quản state mở/đóng.
 *
 * MỘT card bọc ngoài, các mục ngăn nhau bằng đường kẻ mảnh - không phải 9 card
 * rời: danh sách rời tạo 9 khối viền + 9 bóng đổ chồng nhau, mắt phải nhảy qua
 * từng cái thay vì đọc trôi một mạch từ trên xuống.
 */
export function TuningNav({
  groups,
  dangChon,
  onChon,
}: {
  groups: TuningGroup[];
  dangChon: string;
  onChon: (groupId: string) => void;
}) {
  return (
    <nav aria-label="Danh mục cấu hình" className="w-full shrink-0 lg:w-[20rem]">
      <div className="gc-card p-2">
        {groups.map((g, i) => {
          const active = dangChon === g.id;
          const keNgan = i > 0 && !active && dangChon !== groups[i - 1]?.id;
          return (
            <div key={g.id} className={keNgan ? "border-t border-line/50" : undefined}>
              <NavItem
                active={active}
                icon={<GroupIconBox groupId={g.id} size={20} />}
                title={g.title}
                hint={g.navHint}
                onClick={() => onChon(g.id)}
              />
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function NavItem({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all ${
        active
          ? "bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-transparent border border-blue-500/25 shadow-xs"
          : "hover:bg-tile/60 border border-transparent"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-blue-600 dark:text-blue-400" : "text-ink-soft"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-bold ${active ? "text-blue-600 dark:text-blue-400" : "text-ink"}`}>
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-soft">{hint}</span>
      </span>
      <IconChevronRight size={16} className={active ? "text-blue-600 dark:text-blue-400" : "text-ink-soft/40"} />
    </button>
  );
}
