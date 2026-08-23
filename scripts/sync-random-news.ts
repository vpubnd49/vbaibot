import { db } from "../src/conversation/database.js";
import { syncAllAccountsRandomNews, isRandomNewsBroadcastEnabled } from "../src/scheduler/random-news-broadcast.js";

console.log("isRandomNewsBroadcastEnabled:", isRandomNewsBroadcastEnabled());
syncAllAccountsRandomNews();

const jobs = db.prepare(
  "SELECT id, account_id, thread_id, name, cron_expr, next_run_at, enabled FROM scheduled_jobs WHERE name LIKE 'random-news-%'"
).all();

console.log("Random News Jobs Count:", jobs.length);
console.log("Jobs detail:", JSON.stringify(jobs, null, 2));
