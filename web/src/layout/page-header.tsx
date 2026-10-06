import type { ReactNode, SVGProps } from "react";

type IconFn = (p: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;

/**
 * Header trang: ô icon + title + subtitle, slot phải cho action/chip.
 *
 * Ô icon là thứ neo mắt khi chuyển trang - thiếu nó thì mỗi trang mở ra chỉ có
 * một dòng chữ trơ, và trang Cấu hình (vốn tự dựng header riêng có icon) nhìn
 * lạc hẳn khỏi phần còn lại. Icon để `optional` cho tương thích ngược, nhưng
 * mọi trang hiện tại đều truyền.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  aside,
}: {
  icon?: IconFn;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10 backdrop-blur-md">
            <Icon size={22} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[26px] font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-xs lg:text-[13.5px] font-medium text-ink-soft">{subtitle}</p>
        </div>
      </div>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}
