import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../dashboard-api-client";
import { anhNen } from "../shared/background-image";
import { SecretInput } from "../shared/secret-input";
import { useTheme } from "../shared/use-theme";
import { IconMoon, IconSun } from "../shared/dashboard-icons";

export function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không kết nối được server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center bg-canvas bg-cover bg-center px-4 py-8 overflow-hidden"
      style={{ backgroundImage: `url(${anhNen(theme)})` }}
    >
      {/* Nút chuyển đổi giao diện Sáng / Tối góc trên */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line/80 bg-surface/80 text-ink-soft backdrop-blur-md hover:bg-tile hover:text-ink transition-all shadow-xs"
          title={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
        >
          {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
      </div>

      {/* Hiệu ứng hào quang trang trí phía sau (Ambient glow) */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="w-full max-w-[420px] z-10">
        <form
          onSubmit={submit}
          className="gc-card p-5 sm:p-8 shadow-2xl border-line/90 backdrop-blur-xl relative overflow-hidden"
        >
          {/* Đường viền ánh sáng gradient trên đầu card */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80" />

          <div className="mb-7 flex flex-col items-center text-center">
            <div className="relative mb-3 group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-sm group-hover:opacity-40 transition-opacity" />
              <img
                src="/zalo-agent-logo.webp"
                alt="VBAI Bot"
                width={384}
                height={368}
                className="relative h-28 w-auto drop-shadow-md"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11.5px] font-semibold text-blue-600 dark:text-blue-400 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Hệ thống Quản trị & Điều hành Bot AI</span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
              Đăng nhập Dashboard
            </h1>
            <p className="mt-1 text-xs text-ink-soft">
              Nhập mật khẩu quản trị hệ thống để tiếp tục
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Mật khẩu quản trị
              </label>
              <SecretInput
                value={password}
                onChange={setPassword}
                autoFocus
                className="w-full"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || password.length === 0}
              className="gc-button-primary w-full py-3 text-sm mt-2"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang xác thực...</span>
                </div>
              ) : (
                "Đăng nhập hệ thống"
              )}
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-line/60 text-center text-[11.5px] text-ink-soft/70">
            <span>Phiên bản số hóa Hành chính công • 2026</span>
          </div>
        </form>
      </div>
    </div>
  );
}
