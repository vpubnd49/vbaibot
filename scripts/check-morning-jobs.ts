import { db } from "../src/conversation/database.js";
import { syncAllAccountsMorningGreeting, isMorningGreetingEnabled } from "../src/scheduler/morning-greeting.js";

console.log("isMorningGreetingEnabled:", isMorningGreetingEnabled());
syncAllAccountsMorningGreeting();

const jobs = db.prepare(
  "SELECT id, account_id, thread_id, name, cron_expr, next_run_at, enabled FROM scheduled_jobs WHERE name LIKE 'morning-greeting-%'"
).all();

console.log("Morning Greeting Jobs Count:", jobs.length);
console.log("Jobs detail:", JSON.stringify(jobs, null, 2));
