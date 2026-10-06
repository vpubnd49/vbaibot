import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { AccountInfo } from "./dashboard-api-client";
import { api } from "./dashboard-api-client";
import { coCanHoiTruocKhiRoi, xinPhepRoiTrang } from "./shared/unsaved-changes-guard";
import { SidebarNav } from "./layout/sidebar-nav";
import { AccountsPage } from "./pages/accounts-page";
import { AgentCreatePage } from "./pages/agent-create-page";
import { AgentDetailPage } from "./pages/agent-detail-page";
import { DUONG_DAN_TAO } from "./pages/agent-draft";
import { AgentsPage } from "./pages/agents-page";
import { ContactsPage } from "./pages/contacts-page";
import { LoginPage } from "./pages/login-page";
import { MemoryPage } from "./pages/memory-page";
import { KnowledgePage } from "./pages/knowledge-page";
import { OverviewPage } from "./pages/overview-page";
import { SchedulePage } from "./pages/schedule-page";
import { SessionsPage } from "./pages/sessions-page";
import { BroadcastPage } from "./pages/broadcast-page";
import { LogsPage } from "./pages/logs-page";
import { TracePage } from "./pages/trace-page";
import { TuningPage } from "./pages/tuning-page";
import { ToolsPage } from "./pages/tools-page";
import { VpsMonitorPage } from "./pages/vps-monitor-page";
import { anhNen } from "./shared/background-image";
import { IconBot, IconChat, IconCpu, IconGear, IconGrid, IconMenu } from "./shared/dashboard-icons";
import { useTheme } from "./shared/use-theme";

/**
 * Khung chính sau đăng nhập. Không có "account đang chọn" toàn cục - các trang
 * dữ liệu mặc định xem trộn mọi account, lọc bằng dropdown ngay trong trang
 * (theo pattern GoClaw); sidebar chỉ còn điều hướng.
 */
function DashboardShell() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Chỉ cần ĐỌC theme ở đây để chọn ảnh nền - nút chuyển nằm trong SidebarNav
  const { theme } = useTheme();

  useEffect(() => {
    api
      .overview()
      .then((data) => {
        setAccounts(data.accounts);
        setChecked(true);
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  const logout = useCallback(async () => {
    // Đăng xuất cũng là RỜI TRANG - trước đó nó lách qua chốt "chưa lưu", nên
    // bấm nhầm giữa lúc đang soạn persona là mất trắng, không hỏi câu nào
    if (!(await xinPhepRoiTrangNeuCan())) return;
    await api.logout().catch(() => undefined);
    navigate("/login");
  }, [navigate]);

  if (!checked) return null;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-canvas">
      <SidebarNav
        online={accounts.some((a) => a.online)}
        onLogout={logout}
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col h-full max-h-full w-full max-w-full overflow-hidden">
        {/* Topbar cố định tuyệt đối ở mobile - không trượt lên/xuống khi vuốt nội dung */}
        <header className="flex-shrink-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-3.5 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md lg:hidden pt-[max(0.5rem,env(safe-area-inset-top))] select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Mở menu"
              className="rounded-xl p-2 text-ink-soft hover:bg-tile hover:text-ink active:scale-95 transition-all"
            >
              <IconMenu size={20} />
            </button>
            <Link
              to="/"
              onClick={(e) => {
                if (!coCanHoiTruocKhiRoi()) return;
                e.preventDefault();
                void xinPhepRoiTrang().then((ok) => ok && navigate("/"));
              }}
              className="flex items-center gap-2 min-w-0"
              title="Về trang chính"
            >
              <img
                src="/apple-touch-icon.png"
                alt="VBAIBot"
                width={32}
                height={32}
                className="h-7 w-7 rounded-lg shadow-xs"
              />
              <span className="truncate text-[15px] font-bold tracking-tight text-ink font-heading">VBAIBot</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/vps"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>VPS</span>
            </Link>
          </div>
        </header>

        {/*
          Ảnh nền phủ vùng NỘI DUNG, cuộn độc lập bên trong mà không làm xê dịch Topbar và Bottombar.
          Tối ưu padding co giãn cho Samsung Z Fold (màn gập 360px -> mở 890px):
          - Cover screen hẹp: px-2.5 py-3.5
          - Fold mở / Tablet: sm:px-5 sm:py-5
          - Desktop: lg:px-8 lg:py-7
        */}
        <main
          className="min-w-0 flex-1 h-full w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-canvas bg-cover bg-fixed bg-center px-2.5 py-3.5 sm:px-5 sm:py-5 lg:px-8 lg:py-7"
          style={{ backgroundImage: `url(${anhNen(theme)})` }}
        >
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/vps" element={<VpsMonitorPage />} />
            <Route path="/sessions" element={<SessionsPage accounts={accounts} />} />
            <Route path="/broadcast" element={<BroadcastPage accounts={accounts} />} />
            <Route path="/schedule" element={<SchedulePage accounts={accounts} />} />
            <Route path="/contacts" element={<ContactsPage accounts={accounts} />} />
            <Route path="/memory" element={<MemoryPage accounts={accounts} />} />
            <Route path="/knowledge" element={<KnowledgePage accounts={accounts} />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            {/* Phải đứng TRƯỚC "/agents/:id" - và đường dẫn mở đầu bằng gạch
                dưới nên không id agent hợp lệ nào che được nó, xem `agent-draft.ts` */}
            <Route path={DUONG_DAN_TAO} element={<AgentCreatePage />} />
            <Route path="/agents/:id" element={<AgentDetailPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/trace" element={<TracePage />} />
            {/* Nhóm nằm trên URL để link thẳng vào được (banner "Chưa cấu hình
                LLM" ở Overview trỏ tới /tuning/providers). Không có :nhom thì
                TuningPage tự đưa về nhóm đầu tiên. */}
            <Route path="/tuning" element={<TuningPage />} />
            <Route path="/tuning/:nhom" element={<TuningPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* ── Mobile Bottom Navigation Bar (Cố định khóa cứng dưới đáy, không trôi) ── */}
        <nav className="flex-shrink-0 z-30 flex items-center justify-around border-t border-line bg-surface/95 px-2 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden select-none">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all active:scale-95 ${
                isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            <IconGrid size={19} />
            <span className="text-[10px]">Tổng quan</span>
          </NavLink>
          <NavLink
            to="/vps"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all active:scale-95 ${
                isActive ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            <div className="relative">
              <IconCpu size={19} />
              <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px]">VPS Live</span>
          </NavLink>
          <NavLink
            to="/sessions"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all active:scale-95 ${
                isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            <IconChat size={19} />
            <span className="text-[10px]">Phiên chat</span>
          </NavLink>
          <NavLink
            to="/agents"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all active:scale-95 ${
                isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            <IconBot size={19} />
            <span className="text-[10px]">Agents</span>
          </NavLink>
          <NavLink
            to="/tuning"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all active:scale-95 ${
                isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            <IconGear size={19} />
            <span className="text-[10px]">Cài đặt</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}


/**
 * Hỏi trước khi rời trang cho các đường KHÔNG phải `<Link>` (đăng xuất).
 * `sidebar-nav.tsx` có bản riêng vì nó phải `preventDefault` trên sự kiện click.
 */
async function xinPhepRoiTrangNeuCan(): Promise<boolean> {
  if (!coCanHoiTruocKhiRoi()) return true;
  return xinPhepRoiTrang();
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<DashboardShell />} />
      </Routes>
    </BrowserRouter>
  );
}
