import { exec } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("antigravity-bridge");
const execAsync = promisify(exec);

export type AntigravityTaskType = "cmd" | "agy";

export interface AntigravityTask {
  id: string;
  type: AntigravityTaskType;
  command?: string;
  prompt?: string;
  createdAt: number;
  timeoutMs: number;
}

export interface AntigravityResult {
  id: string;
  source: "pc" | "vps";
  success: boolean;
  output: string;
  exitCode?: number;
  durationMs: number;
  error?: string;
}

interface PendingTask {
  task: AntigravityTask;
  resolve: (res: AntigravityResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface LocalPcClientInfo {
  os: string;
  hostname: string;
  cwd: string;
  ip?: string;
  nodeVersion?: string;
}

class AntigravityBridge {
  private lastSeenLocalPcMs = 0;
  private localPcInfo: LocalPcClientInfo | null = null;
  private taskQueue: AntigravityTask[] = [];
  private pendingTasks = new Map<string, PendingTask>();
  private waitingPollResolvers: Array<(task: AntigravityTask | null) => void> = [];

  /**
   * Kiểm tra máy tính cá nhân (Local PC Windows) có đang kết nối và online không.
   * Nếu gửi tín hiệu trong vòng 35 giây qua -> coi là Online.
   */
  public isLocalPcOnline(): boolean {
    return Date.now() - this.lastSeenLocalPcMs < 35_000;
  }

  public getLocalPcInfo(): LocalPcClientInfo | null {
    return this.isLocalPcOnline() ? this.localPcInfo : null;
  }

  public getLastSeen(): number {
    return this.lastSeenLocalPcMs;
  }

  /**
   * Kiểm tra xem Zalo user ID có quyền chạy lệnh quản trị / Antigravity không.
   */
  public isAuthorizedAdmin(senderId: string): boolean {
    if (!senderId) return false;
    const allowed = (env.ANTIGRAVITY_ADMIN_USER_IDS || "1049933544839800796")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return allowed.includes(senderId.trim());
  }

  /**
   * Local PC gửi Long-Poll lên VPS để nhận việc.
   */
  public async handleClientPoll(
    clientInfo: LocalPcClientInfo,
    relayKey: string,
    waitMs = 20_000,
  ): Promise<AntigravityTask | null> {
    if (!this.verifyRelayKey(relayKey)) {
      throw new Error("Mã xác thực relay key không hợp lệ");
    }

    this.lastSeenLocalPcMs = Date.now();
    this.localPcInfo = clientInfo;

    // Nếu đã có task đang đợi sẵn trong hàng đợi
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      log.info({ taskId: task.id, type: task.type }, "Giao task ngay cho Local PC");
      return task;
    }

    // Nếu chưa có task, giữ kết nối long-poll tối đa waitMs
    return new Promise<AntigravityTask | null>((resolve) => {
      let timer: NodeJS.Timeout;

      const resolver = (task: AntigravityTask | null) => {
        clearTimeout(timer);
        resolve(task);
      };

      this.waitingPollResolvers.push(resolver);

      timer = setTimeout(() => {
        const idx = this.waitingPollResolvers.indexOf(resolver);
        if (idx !== -1) {
          this.waitingPollResolvers.splice(idx, 1);
        }
        resolve(null);
      }, Math.min(waitMs, 25_000));
    });
  }

  /**
   * Local PC gửi kết quả thực thi task về cho VPS.
   */
  public handleClientResult(
    result: {
      taskId: string;
      success: boolean;
      output: string;
      exitCode?: number;
      durationMs?: number;
      error?: string;
    },
    relayKey: string,
  ): boolean {
    if (!this.verifyRelayKey(relayKey)) {
      throw new Error("Mã xác thực relay key không hợp lệ");
    }

    this.lastSeenLocalPcMs = Date.now();
    const pending = this.pendingTasks.get(result.taskId);
    if (!pending) {
      log.warn({ taskId: result.taskId }, "Nhận kết quả cho task không còn chờ (hoặc đã timeout)");
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingTasks.delete(result.taskId);

    pending.resolve({
      id: result.taskId,
      source: "pc",
      success: result.success,
      output: result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs ?? 0,
      error: result.error,
    });
    return true;
  }

  /**
   * Điều phối thực thi task: Ưu tiên Local PC nếu đang online, tự động Fallback sang VPS nếu PC offline/timeout.
   */
  public async dispatch(
    params: {
      type: AntigravityTaskType;
      command?: string;
      prompt?: string;
      forceVps?: boolean;
    },
  ): Promise<AntigravityResult> {
    const taskId = `agy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const task: AntigravityTask = {
      id: taskId,
      type: params.type,
      command: params.command,
      prompt: params.prompt,
      createdAt: Date.now(),
      timeoutMs: env.ANTIGRAVITY_PC_TIMEOUT_MS,
    };

    // 1. Nếu PC đang online và không bị ép chạy trên VPS -> thử gửi cho PC
    if (!params.forceVps && this.isLocalPcOnline()) {
      try {
        log.info({ taskId, type: task.type }, "PC đang online -> Gửi task cho Local PC thực thi");
        const pcResult = await this.dispatchToPcWithTimeout(task);
        return pcResult;
      } catch (err) {
        log.warn({ err, taskId }, "Local PC thực thi lỗi hoặc quá giờ -> Tự động chuyển tiếp sang VPS (Fallback)");
      }
    }

    // 2. Chạy trên VPS (Fallback hoặc khi PC offline)
    log.info({ taskId, type: task.type }, "Thực thi trực tiếp trên VPS Server");
    return this.executeOnVps(task);
  }

  private dispatchToPcWithTimeout(task: AntigravityTask): Promise<AntigravityResult> {
    return new Promise<AntigravityResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(task.id);
        const idx = this.taskQueue.findIndex((t) => t.id === task.id);
        if (idx !== -1) this.taskQueue.splice(idx, 1);
        reject(new Error(`Local PC không phản hồi sau ${task.timeoutMs / 1000}s`));
      }, task.timeoutMs);

      this.pendingTasks.set(task.id, {
        task,
        resolve,
        reject,
        timer,
      });

      // Nếu có client poll đang chờ -> giao luôn
      const waiting = this.waitingPollResolvers.shift();
      if (waiting) {
        waiting(task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Thực thi trực tiếp trên VPS Server (trong thư mục /var/www/vbaibot)
   */
  public async executeOnVps(task: AntigravityTask): Promise<AntigravityResult> {
    const start = Date.now();
    const cwd = process.cwd();

    if (task.type === "cmd") {
      const cmd = task.command ?? "";
      if (!cmd.trim()) {
        return {
          id: task.id,
          source: "vps",
          success: false,
          output: "Lỗi: Lệnh rỗng",
          durationMs: 0,
        };
      }

      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd,
          timeout: 60_000,
          maxBuffer: 1024 * 1024 * 5, // 5MB
          env: { ...process.env, PATH: process.env.PATH },
        });

        const output = (stdout || stderr || "(Không có đầu ra)").trim();
        const durationMs = Date.now() - start;

        return {
          id: task.id,
          source: "vps",
          success: true,
          output: output.slice(0, 10_000), // giới hạn cho tin nhắn
          exitCode: 0,
          durationMs,
        };
      } catch (err: any) {
        const durationMs = Date.now() - start;
        const errOutput = (err.stdout ? `${err.stdout}\n` : "") + (err.stderr || err.message || String(err));
        return {
          id: task.id,
          source: "vps",
          success: false,
          output: errOutput.trim().slice(0, 10_000),
          exitCode: err.code ?? 1,
          durationMs,
          error: err.message,
        };
      }
    }

    // Nếu task là prompt agent
    return {
      id: task.id,
      source: "vps",
      success: true,
      output: `[VPS Antigravity Runner]\nĐã nhận yêu cầu: "${task.prompt}"\nMôi trường: ${cwd}\n(Để chạy lệnh trực tiếp, hãy dùng cú pháp: /cmd <lệnh>)`,
      durationMs: Date.now() - start,
    };
  }

  private verifyRelayKey(key: string): boolean {
    const expected = env.ANTIGRAVITY_RELAY_KEY || "vbai-antigravity-relay-2026-secret";
    return key.trim() === expected.trim();
  }
}

export const antigravityBridge = new AntigravityBridge();
