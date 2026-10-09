import { useCallback, useEffect, useState } from "react";
import type { VpsMetrics } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import {
  IconBolt,
  IconClock,
  IconCpu,
  IconDatabase,
  IconGear,
  IconRefresh,
  IconSignal,
  IconX,
} from "../shared/dashboard-icons";

export function VpsMonitorPage() {
  const [metrics, setMetrics] = useState<VpsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal reboot states
  const [showRebootModal, setShowRebootModal] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [rebootCountdown, setRebootCountdown] = useState(45);
  const [rebootStatusText, setRebootStatusText] = useState("");

  const fetchMetrics = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const data = await api.vps.metrics();
      setMetrics(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không kết nối được tới VPS";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics(true);
  }, [fetchMetrics]);

  // Polling auto-refresh every 4 seconds
  useEffect(() => {
    if (!autoRefresh || rebooting) return;
    const interval = setInterval(() => {
      void fetchMetrics(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics, rebooting]);

  const handleRestartService = async (serviceName: string) => {
    if (!confirm(`Bạn có chắc muốn khởi động lại dịch vụ "${serviceName}"?`)) return;
    setActionLoading(serviceName);
    setActionMessage(null);
    try {
      const res = await api.vps.restartService(serviceName);
      setActionMessage({ text: res.message, ok: res.ok });
      await fetchMetrics(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thất bại";
      setActionMessage({ text: `Lỗi: ${msg}`, ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartBot = async () => {
    if (!confirm("Khởi động lại toàn bộ tiến trình bot?")) return;
    setActionLoading("bot");
    try {
      const res = await api.restartBot();
      setActionMessage({ text: res.message, ok: true });
      setTimeout(() => void fetchMetrics(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi";
      setActionMessage({ text: `Lỗi: ${msg}`, ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerReboot = async () => {
    setShowRebootModal(false);
    setRebooting(true);
    setRebootCountdown(45);
    setRebootStatusText("Đang gửi lệnh khởi động lại hệ thống...");

    try {
      await api.vps.reboot();
      setRebootStatusText("VPS đang khởi động lại. Đang chờ máy chủ trực tuyến trở lại...");
    } catch (err) {
      // Reboot command might abruptly drop network connection, which is normal
      setRebootStatusText("VPS đã bắt đầu chu trình khởi động lại...");
    }

    // Countdown and reconnect probe
    let count = 45;
    const cdInterval = setInterval(() => {
      count -= 1;
      setRebootCountdown(count);
      if (count <= 25) {
        // Start probing health
        fetch("/api/health")
          .then((r) => {
            if (r.ok) {
              clearInterval(cdInterval);
              setRebootStatusText("Máy chủ đã trực tuyến trở lại! Đang tải dữ liệu...");
              setTimeout(() => {
                setRebooting(false);
                void fetchMetrics(true);
              }, 2000);
            }
          })
          .catch(() => {});
      }
      if (count <= 0) {
        clearInterval(cdInterval);
        setRebootStatusText("Vui lòng tải lại trang nếu hệ thống đã sẵn sàng.");
        setTimeout(() => setRebooting(false), 5000);
      }
    }, 1000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getUsageColor = (pct: number) => {
    if (pct < 60) return "bg-emerald-500 text-emerald-500";
    if (pct < 85) return "bg-amber-500 text-amber-500";
    return "bg-rose-500 text-rose-500";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ── Top Header & Action Controls ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Giám sát & Quản trị VPS
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Realtime
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Theo dõi trạng thái tài nguyên, vi xử lý, bộ nhớ, ổ đĩa và điều khiển máy chủ trực tiếp.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              autoRefresh
                ? "border-zalo-500/40 bg-zalo-500/10 text-zalo-600 dark:text-zalo-400"
                : "border-line bg-surface text-ink-soft hover:bg-tile"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-zalo-500" : "bg-slate-400"}`}
            />
            <span>{autoRefresh ? "Tự động: Bật" : "Tự động: Tắt"}</span>
          </button>

          <button
            onClick={() => void fetchMetrics(true)}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-tile transition-all active:scale-95 disabled:opacity-50"
          >
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleRestartBot}
            disabled={actionLoading === "bot"}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 transition-all active:scale-95 disabled:opacity-50"
          >
            <IconBolt size={14} />
            <span>Khởi động Bot</span>
          </button>

          <button
            onClick={() => setShowRebootModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 transition-all active:scale-95"
          >
            <IconGear size={14} />
            <span>Reboot VPS</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
            actionMessage.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          <p className="font-semibold">Lỗi kết nối máy chủ:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* ── Metric Cards Grid ── */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: CPU */}
          <div className="gc-card p-5 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  CPU Vi xử lý
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-ink">
                    {metrics.cpu.usagePercent}%
                  </span>
                  <span className="text-xs font-medium text-ink-soft">
                    {metrics.cpu.cores} Cores
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-tile/70 p-2.5 text-blue-500">
                <IconCpu size={22} />
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-tile overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getUsageColor(metrics.cpu.usagePercent).split(" ")[0]}`}
                  style={{ width: `${Math.min(100, Math.max(2, metrics.cpu.usagePercent))}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-ink-soft">
                <span>Load Avg:</span>
                <span className="font-mono font-medium text-ink">
                  {metrics.cpu.loadAvg.map((l) => l.toFixed(2)).join(" · ")}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: RAM */}
          <div className="gc-card p-5 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Bộ nhớ RAM
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-ink">
                    {metrics.memory.usagePercent}%
                  </span>
                  <span className="text-xs font-medium text-ink-soft">
                    {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-tile/70 p-2.5 text-indigo-500">
                <IconDatabase size={22} />
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-tile overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getUsageColor(metrics.memory.usagePercent).split(" ")[0]}`}
                  style={{ width: `${Math.min(100, Math.max(2, metrics.memory.usagePercent))}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-ink-soft">
                <span>Khả dụng:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatBytes(metrics.memory.availableBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Disk */}
          <div className="gc-card p-5 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Dung lượng đĩa (SSD)
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-ink">
                    {metrics.disk.usagePercent}%
                  </span>
                  <span className="text-xs font-medium text-ink-soft">
                    {formatBytes(metrics.disk.usedBytes)} / {formatBytes(metrics.disk.totalBytes)}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-tile/70 p-2.5 text-emerald-500">
                <IconDatabase size={22} />
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-tile overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getUsageColor(metrics.disk.usagePercent).split(" ")[0]}`}
                  style={{ width: `${Math.min(100, Math.max(2, metrics.disk.usagePercent))}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-ink-soft">
                <span>Còn trống:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatBytes(metrics.disk.availableBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Uptime & OS */}
          <div className="gc-card p-5 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Thời gian hoạt động
                </span>
                <div className="mt-2">
                  <div className="text-lg font-bold tracking-tight text-ink truncate">
                    {metrics.system.uptimeFormatted}
                  </div>
                  <span className="text-xs font-medium text-ink-soft">
                    Host: {metrics.system.hostname}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-tile/70 p-2.5 text-amber-500">
                <IconClock size={22} />
              </div>
            </div>

            <div className="mt-4 border-t border-line/60 pt-2.5 flex items-center justify-between text-[11.5px] text-ink-soft">
              <span>HĐH:</span>
              <span className="font-mono text-ink truncate max-w-[130px]" title={metrics.system.release}>
                Linux {metrics.system.release.split("-")[0]} ({metrics.system.arch})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Services & Processes Grid ── */}
      {metrics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Cột 1 & 2: Danh sách dịch vụ cốt lõi (PM2 + Docker + Web) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <IconBolt size={18} className="text-zalo-500" />
                Các dịch vụ hoạt động ({metrics.services.length})
              </h2>
              <span className="text-xs text-ink-soft">
                Tự phục hồi qua PM2 Daemon & Docker Engine
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {metrics.services.map((svc) => (
                <div
                  key={svc.name}
                  className="gc-card p-4.5 flex flex-col justify-between hover:border-zalo-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            svc.status === "online"
                              ? "bg-emerald-500 pulse-online"
                              : "bg-rose-500"
                          }`}
                        />
                        <span className="font-bold text-[15px] text-ink">{svc.name}</span>
                        <span className="rounded-md border border-line bg-tile px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                          {svc.type}
                        </span>
                      </div>

                      <span
                        className={`text-xs font-semibold capitalize ${
                          svc.status === "online"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {svc.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-soft">
                      {svc.pid && (
                        <div>
                          PID: <span className="font-mono text-ink font-medium">{svc.pid}</span>
                        </div>
                      )}
                      {svc.memoryBytes !== undefined && svc.memoryBytes > 0 && (
                        <div>
                          RAM:{" "}
                          <span className="font-mono text-ink font-medium">
                            {formatBytes(svc.memoryBytes)}
                          </span>
                        </div>
                      )}
                      {svc.cpu !== undefined && (
                        <div>
                          CPU:{" "}
                          <span className="font-mono text-ink font-medium">{svc.cpu}%</span>
                        </div>
                      )}
                      {svc.restarts !== undefined && (
                        <div>
                          Restarts:{" "}
                          <span className="font-mono text-ink font-medium">{svc.restarts}</span>
                        </div>
                      )}
                    </div>

                    {svc.extra && (
                      <p className="mt-2 text-[11px] text-ink-soft/80 truncate" title={svc.extra}>
                        {svc.extra}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-end">
                    <button
                      onClick={() => handleRestartService(svc.name)}
                      disabled={actionLoading === svc.name}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-tile hover:text-blue-500 transition-all disabled:opacity-50"
                    >
                      <IconRefresh
                        size={12}
                        className={actionLoading === svc.name ? "animate-spin" : ""}
                      />
                      Khởi động lại
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cột 3: Top Tiến trình chiếm RAM / CPU */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <IconSignal size={18} className="text-indigo-500" />
              Tiến trình hàng đầu
            </h2>

            <div className="gc-card divide-y divide-line/60 overflow-hidden">
              <div className="bg-tile/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft grid grid-cols-12">
                <span className="col-span-3">PID</span>
                <span className="col-span-5">Tiến trình</span>
                <span className="col-span-2 text-right">RAM</span>
                <span className="col-span-2 text-right">CPU</span>
              </div>

              {metrics.topProcesses.length > 0 ? (
                metrics.topProcesses.map((proc) => (
                  <div
                    key={proc.pid}
                    className="px-4 py-2.5 text-xs grid grid-cols-12 items-center hover:bg-tile/40 transition-colors"
                  >
                    <span className="col-span-3 font-mono text-ink-soft">{proc.pid}</span>
                    <span className="col-span-5 font-medium text-ink truncate" title={proc.name}>
                      {proc.name}
                    </span>
                    <span className="col-span-2 text-right font-mono font-medium text-indigo-500">
                      {typeof proc.memPercent === "number" && !isNaN(proc.memPercent) ? proc.memPercent : 0}%
                    </span>
                    <span className="col-span-2 text-right font-mono font-medium text-blue-500">
                      {typeof proc.cpuPercent === "number" && !isNaN(proc.cpuPercent) ? proc.cpuPercent : 0}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-ink-soft">
                  Đang cập nhật danh sách tiến trình...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Xác Nhận Reboot VPS ── */}
      {showRebootModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <IconGear size={24} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Xác nhận Reboot VPS</h3>
                <p className="text-xs text-ink-soft">Hành động quản trị cấp cao</p>
              </div>
            </div>

            <p className="text-sm text-ink-soft leading-relaxed">
              Bạn có chắc chắn muốn khởi động lại toàn bộ máy chủ VPS không? Toàn bộ kết nối Zalo
              Bot, 9Router và các trang web sẽ tạm thời ngắt kết nối trong khoảng <strong>30 đến 60 giây</strong>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRebootModal(false)}
                className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink hover:bg-tile"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleTriggerReboot}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-md shadow-rose-600/20"
              >
                Xác nhận Khởi động lại VPS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Màn hình Reconnecting Overlay khi Reboot ── */}
      {rebooting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas/95 backdrop-blur-md p-6 text-center animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full border-4 border-zalo-500 border-t-transparent animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-ink mb-2">Đang khởi động lại VPS...</h2>
          <p className="text-sm text-ink-soft max-w-md mb-6">{rebootStatusText}</p>

          <div className="rounded-xl border border-line bg-surface px-6 py-3 shadow-lg">
            <span className="text-xs text-ink-soft uppercase tracking-wider font-semibold">
              Ước tính thời gian
            </span>
            <div className="text-3xl font-mono font-bold text-zalo-500 mt-1">
              {rebootCountdown}s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
