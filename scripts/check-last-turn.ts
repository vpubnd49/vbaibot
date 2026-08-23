import { db } from "../src/conversation/database.js";

const steps = db.prepare("SELECT step_order, kind, tool_name, tool_input, tool_output, thought FROM agent_traces WHERE turn_id = (SELECT MAX(turn_id) FROM agent_traces) ORDER BY step_order").all();
console.log("Last turn steps:", JSON.stringify(steps, null, 2));

const msg = db.prepare("SELECT sender_name, text FROM message_history WHERE turn_id = (SELECT MAX(turn_id) FROM agent_traces)").all();
console.log("Last turn user messages:", JSON.stringify(msg, null, 2));
