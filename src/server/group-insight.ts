import { db } from "../conversation/database.js";



export interface ThreadInsight {
  threadId: string;
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
 * Phân tích tổng quan hoạt động bot theo account.
 */
export function getAccountInsight(accountId: string, days = 30): OverallInsight {
  const sinceDate = new Date(Date.now() - days * 86400_000).toISOString();

  // Tổng thread + turn
  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT thread_id) as total_threads,
      COUNT(*) as total_turns,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(AVG(NULLIF(response_time_ms, 0)), 0) as avg_response_ms
    FROM agent_turns
    WHERE account_id = ? AND created_at >= ?
  `).get(accountId, sinceDate) as {
    total_threads: number;
    total_turns: number;
    total_tokens: number;
    avg_response_ms: number;
  };

  // Top threads theo lượng tin
  const topThreads = db.prepare(`
    SELECT
      thread_id,
      COUNT(*) as total_turns,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(ROUND(AVG(total_tokens)), 0) as avg_tokens,
      MIN(created_at) as first_activity,
      MAX(created_at) as last_activity,
      COUNT(DISTINCT DATE(created_at)) as active_days
    FROM agent_turns
    WHERE account_id = ? AND created_at >= ?
    GROUP BY thread_id
    ORDER BY total_turns DESC
    LIMIT 10
  `).all(accountId, sinceDate) as {
    thread_id: string;
    total_turns: number;
    total_tokens: number;
    avg_tokens: number;
    first_activity: string;
    last_activity: string;
    active_days: number;
  }[];

  // Turns per day
  const turnsByDay = db.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM agent_turns
    WHERE account_id = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY day DESC
    LIMIT 30
  `).all(accountId, sinceDate) as { day: string; count: number }[];

  return {
    totalThreads: summary.total_threads,
    totalTurns: summary.total_turns,
    totalTokens: summary.total_tokens,
    averageResponseTimeMs: Math.round(summary.avg_response_ms),
    topThreads: topThreads.map((t) => ({
      threadId: t.thread_id,
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
