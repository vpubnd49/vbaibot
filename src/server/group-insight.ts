import { db } from "../conversation/database.js";

export interface ThreadInsight {
  threadId: string;
  threadName: string;
  threadType: number; // 0: cá nhân, 1: nhóm
  totalTurns: number;
  totalTokens: number;
  avgTokensPerTurn: number;
  firstActivity: string;
  lastActivity: string;
  activeDays: number;
}

export interface OverallInsight {
  totalThreads: number;
  totalTurns: number;
  totalTokens: number;
  topThreads: ThreadInsight[];
  turnsByDay: { day: string; count: number }[];
  averageResponseTimeMs: number;
}

/**
 * Phân tích tổng quan hoạt động bot theo account hoặc toàn hệ thống (all).
 */
export function getAccountInsight(accountId?: string, days = 30): OverallInsight {
  const sinceDate = new Date(Date.now() - days * 86400_000).toISOString();
  const isAll = !accountId || accountId === "all";

  // Tổng thread + turn
  const summarySql = `
    SELECT
      COUNT(DISTINCT thread_id) as total_threads,
      COUNT(*) as total_turns,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(AVG(NULLIF(response_time_ms, 0)), 0) as avg_response_ms
    FROM agent_turns
    WHERE created_at >= ? ${isAll ? "" : "AND account_id = ?"}
  `;
  const summary = (isAll
    ? db.prepare(summarySql).get(sinceDate)
    : db.prepare(summarySql).get(sinceDate, accountId)) as {
    total_threads: number;
    total_turns: number;
    total_tokens: number;
    avg_response_ms: number;
  };

  // Top threads kèm tên hiển thị từ bảng threads
  const topThreadsSql = `
    SELECT
      a.thread_id,
      COALESCE(MAX(th.display_name), a.thread_id) as thread_name,
      COALESCE(MAX(th.thread_type), 0) as thread_type,
      COUNT(*) as total_turns,
      COALESCE(SUM(a.total_tokens), 0) as total_tokens,
      COALESCE(ROUND(AVG(a.total_tokens)), 0) as avg_tokens,
      MIN(a.created_at) as first_activity,
      MAX(a.created_at) as last_activity,
      COUNT(DISTINCT DATE(a.created_at)) as active_days
    FROM agent_turns a
    LEFT JOIN threads th ON th.thread_id = a.thread_id
    WHERE a.created_at >= ? ${isAll ? "" : "AND a.account_id = ?"}
    GROUP BY a.thread_id
    ORDER BY total_turns DESC
    LIMIT 20
  `;
  const topRows = (isAll
    ? db.prepare(topThreadsSql).all(sinceDate)
    : db.prepare(topThreadsSql).all(sinceDate, accountId)) as {
    thread_id: string;
    thread_name: string;
    thread_type: number;
    total_turns: number;
    total_tokens: number;
    avg_tokens: number;
    first_activity: string;
    last_activity: string;
    active_days: number;
  }[];

  // Turns per day
  const turnsByDaySql = `
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM agent_turns
    WHERE created_at >= ? ${isAll ? "" : "AND account_id = ?"}
    GROUP BY DATE(created_at)
    ORDER BY day DESC
    LIMIT 30
  `;
  const turnsByDay = (isAll
    ? db.prepare(turnsByDaySql).all(sinceDate)
    : db.prepare(turnsByDaySql).all(sinceDate, accountId)) as { day: string; count: number }[];

  return {
    totalThreads: summary?.total_threads ?? 0,
    totalTurns: summary?.total_turns ?? 0,
    totalTokens: summary?.total_tokens ?? 0,
    averageResponseTimeMs: Math.round(summary?.avg_response_ms ?? 0),
    topThreads: topRows.map((t) => ({
      threadId: t.thread_id,
      threadName: t.thread_name || t.thread_id,
      threadType: t.thread_type,
      totalTurns: t.total_turns,
      totalTokens: t.total_tokens,
      avgTokensPerTurn: t.avg_tokens,
      firstActivity: t.first_activity,
      lastActivity: t.last_activity,
      activeDays: t.active_days,
    })),
    turnsByDay,
  };
}
