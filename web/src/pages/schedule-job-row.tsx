import { useState } from "react";
import { ApiError } from "../dashboard-api-client";
import type { ScheduledJobItem, ScheduledJobRunItem } from "../dashboard-api-client";
import { formatBotTime } from "../shared/format-bot-time";
import { Badge, ToggleKnob } from "../shared/ui-bits";

/** Nhãn kiểu lịch đọc được, không phải mã kỹ thuật */
function scheduleLabel(job: ScheduledJobItem): string {
  if (job.scheduleKind === "once") return "Một lần";
  if (job.scheduleKind === "every") return `Mỗi ${job.everyMinutes} phút`;
  return `Cron: ${job.cronExpr}`;
}

/**
 * Badge trạng thái lần chạy cuối. `blocked` (job bị chặn ở preflight - account
 * rớt phiên, bot tắt cho thread) là đường DUY NHẤT người dùng biết job đang
 * hỏng vì job lỗi cố ý không nhắn gì - PHẢI hiện rõ, không phải trang trí.
 */
function statusBadge(status: string | null): { tone: "blue" | "gray" | "green" | "red" | "amber"; text: string } {
  switch (status) {
    case "ok":
      return { tone: "green", text: "Thành công" };
    case "silent":
      return { tone: "blue", text: "Im lặng (agent chọn không báo)" };
    case "skipped":
      return { tone: "amber", text: "Bị bỏ lượt" };
    case "error":
      return { tone: "red", text: "Lỗi" };
    case "interrupted":
      return { tone: "amber", text: "Bị ngắt giữa chừng" };
    case "blocked":
      return { tone: "red", text: "Đang bị chặn" };
    default:
      return { tone: "gray", text: "Chưa chạy lần nào" };
  }
}

export function ScheduleJobRow({
  job,
  accountName,
  threadName,
  timezone,
  onToggle,
  onRun,
  onEdit,
  onHistory,
  onDelete,
}: {
  job: ScheduledJobItem;
  accountName?: string;
  threadName: string;
  timezone: string;
  onToggle: () => void;
  onRun: () => Promise<ScheduledJobRunItem | null>;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const status = statusBadge(job.lastStatus);
  const canShowError = (job.lastStatus === "error" || job.lastStatus === "blocked") && job.lastError;

  // Job chạy đủ suất thì `markRun` TỰ đặt enabled=0 + next_run_at=NULL
  // (scheduled-job-store.ts) - không phải người dùng tắt. Trước đây cả hai ca
  // cùng hiện "Đã tắt", đọc lên như thể ai đó vừa tắt một lịch còn hiệu lực.
  const finished = !job.enabled && job.nextRunAt === null && job.maxRuns !== null && job.runCount >= job.maxRuns;

  // Bật lại job không còn mốc chạy kế là một công tắc RỖNG: `listDueJobs` lọc
  // `next_run_at IS NOT NULL` nên không tick nào thấy job đó nữa. Chặn ngay ở
  // nút thay vì để người dùng bật rồi ngồi đợi một lượt không bao giờ tới.
  const toggleDisabled = !job.enabled && job.nextRunAt === null;

  async function handleRun() {
    setRunning(true);
    setRunResult(null);
    try {
      const run = await onRun();
      setRunResult(run ? `Kết quả chạy thử: ${run.status} - ${run.detail || "(không có mô tả)"}` : "Không ghi nhận được kết quả");
    } catch (err) {
      setRunResult(err instanceof ApiError ? err.message : "Chạy thử thất bại - xem log để biết chi tiết");
    } finally {
      setRunning(false);
    }
  }

  return (
    // KHÔNG đè `bg-tile/30` lên `.gc-card` như trước: lớp xám mờ đó cộng với
    // nền trắng 95% của card làm cả thẻ chìm hẳn vào ảnh nền, đọc rất mệt.
    // Để card giữ đúng nền của design system, giống hệt trang Cấu hình.
    <div className="gc-card-hover space-y-3 rounded-2xl p-5 relative overflow-hidden group">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink">{job.name}</span>
        <Badge tone={job.kind === "agent" ? "blue" : "gray"} dot={false}>
          {job.kind === "agent" ? "⚡ Agent" : "💬 Nhắn tin"}
        </Badge>
        <Badge tone="gray" dot={false}>
          {scheduleLabel(job)}
        </Badge>
        <Badge tone={status.tone} dot>{status.text}</Badge>
        {!job.enabled &&
          (finished ? (
            <Badge tone="gray" dot={false}>
              Đã xong (chạy đủ {job.maxRuns} lần)
            </Badge>
          ) : (
            <Badge tone="gray" dot={false}>
              Đã tắt
            </Badge>
          ))}
      </div>

      <div className="text-xs text-ink-soft flex flex-wrap items-center gap-2.5">
        <span>Gửi tới: <strong className="text-ink font-semibold">{threadName}</strong> {accountName ? `(${accountName})` : ""}</span>
        <span>•</span>
        <span>Lần kế tiếp:{" "}
          <strong className="text-ink font-semibold font-mono">
            {job.enabled ? formatBotTime(job.nextRunAt, timezone) : finished ? "không còn lần nào" : "-"}
          </strong>
        </span>
        {job.lastRunAt && (
          <>
            <span>•</span>
            <span>Chạy gần nhất: <span className="font-mono">{formatBotTime(job.lastRunAt, timezone)}</span></span>
          </>
        )}
      </div>

      {canShowError && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
          Lỗi lần gần nhất: {job.lastError}
        </div>
      )}

      {runResult && (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
          {runResult}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line/60">
        <button
          onClick={onToggle}
          disabled={toggleDisabled}
          className={`flex items-center gap-1.5 ${toggleDisabled ? "cursor-not-allowed opacity-40" : ""}`}
          title={
            toggleDisabled
              ? "Lịch này không còn mốc chạy nào - bật lại cũng không chạy nữa. Bấm Sửa để đặt lịch mới."
              : job.enabled
                ? "Đang bật - bấm để tắt"
                : "Đang tắt - bấm để bật"
          }
        >
          <ToggleKnob on={job.enabled} />
        </button>
        <button
          onClick={handleRun}
          disabled={running}
          className="gc-button-primary text-xs py-1.5 px-3"
        >
          {running ? "Đang chạy..." : "▶ Chạy thử"}
        </button>
        <button
          onClick={onHistory}
          className="gc-button-secondary text-xs py-1.5 px-3 font-semibold"
        >
          Lịch sử
        </button>
        <button
          onClick={onEdit}
          className="gc-button-secondary text-xs py-1.5 px-3 font-semibold"
        >
          Sửa
        </button>
        <button
          onClick={onDelete}
          className="rounded-xl border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
