import { parseDisabledTools } from "../config/parse-disabled-tools.js";
import { db } from "./database.js";
import { setBotEnabled } from "./thread-store.js";

export type ThreadSettings = {
  accountId: string;
  threadId: string;
  botEnabled: boolean;
  disabledTools: string[];
  customModel: string | null;
  isVip: boolean;
  notes: string;
  updatedAt: string;
};

type Row = {
  account_id: string;
  thread_id: string;
  bot_enabled: number;
  disabled_tools: string;
  custom_model: string | null;
  is_vip: number;
  notes: string;
  updated_at: string;
};

const getStmt = db.prepare(`
  SELECT account_id, thread_id, bot_enabled, disabled_tools, custom_model, is_vip, notes, updated_at
  FROM thread_settings
  WHERE account_id = ? AND thread_id = ?
`);

const upsertStmt = db.prepare(`
  INSERT INTO thread_settings (account_id, thread_id, bot_enabled, disabled_tools, custom_model, is_vip, notes, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (account_id, thread_id) DO UPDATE SET
    bot_enabled = excluded.bot_enabled,
    disabled_tools = excluded.disabled_tools,
    custom_model = excluded.custom_model,
    is_vip = excluded.is_vip,
    notes = excluded.notes,
    updated_at = excluded.updated_at
`);

/** Lấy cấu hình riêng của 1 thread (kết hợp dữ liệu từ threads và thread_settings) */
export function getThreadSettings(accountId: string, threadId: string): ThreadSettings {
  const row = getStmt.get(accountId, threadId) as Row | undefined;
  if (!row) {
    // Nếu chưa có trong thread_settings, lấy trạng thái bot_enabled từ bảng threads
    const thRow = db
      .prepare("SELECT bot_enabled FROM threads WHERE account_id = ? AND thread_id = ?")
      .get(accountId, threadId) as { bot_enabled: number } | undefined;
    const botEnabled = thRow === undefined || thRow.bot_enabled === 1;

    return {
      accountId,
      threadId,
      botEnabled,
      disabledTools: [],
      customModel: null,
      isVip: false,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    accountId: row.account_id,
    threadId: row.thread_id,
    botEnabled: row.bot_enabled === 1,
    disabledTools: parseDisabledTools(row.disabled_tools),
    customModel: row.custom_model || null,
    isVip: row.is_vip === 1,
    notes: row.notes || "",
    updatedAt: row.updated_at,
  };
}

/** Cập nhật cấu hình riêng của 1 thread */
export function updateThreadSettings(
  accountId: string,
  threadId: string,
  patch: Partial<Omit<ThreadSettings, "accountId" | "threadId" | "updatedAt">>,
): ThreadSettings {
  const current = getThreadSettings(accountId, threadId);
  const next = { ...current, ...patch };

  upsertStmt.run(
    accountId,
    threadId,
    next.botEnabled ? 1 : 0,
    JSON.stringify(next.disabledTools),
    next.customModel ? next.customModel.trim() : null,
    next.isVip ? 1 : 0,
    next.notes,
  );

  // Đồng bộ sang bảng threads nếu botEnabled thay đổi
  if (patch.botEnabled !== undefined) {
    setBotEnabled(accountId, threadId, patch.botEnabled);
  }

  return getThreadSettings(accountId, threadId);
}

/** Kiểm tra nhanh cuộc trò chuyện có phải khách/nhóm VIP không */
export function isThreadVip(accountId: string, threadId: string): boolean {
  const row = db
    .prepare("SELECT is_vip FROM thread_settings WHERE account_id = ? AND thread_id = ?")
    .get(accountId, threadId) as { is_vip: number } | undefined;
  return row?.is_vip === 1;
}

/** Lấy model override cho thread (nếu có) */
export function getThreadCustomModel(accountId: string, threadId: string): string | null {
  const row = db
    .prepare("SELECT custom_model FROM thread_settings WHERE account_id = ? AND thread_id = ?")
    .get(accountId, threadId) as { custom_model: string | null } | undefined;
  return row?.custom_model?.trim() || null;
}
