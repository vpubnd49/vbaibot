import { db } from "../src/conversation/database.js";
import { getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";
import { getMusicSettings, isMusicGenConfigured } from "../src/config/runtime-music-settings.js";
import { listAvailableTools } from "../src/agent/tools/tool-registry.js";
import { getAgent } from "../src/config/agent-store.js";
import { getAccount } from "../src/config/account-store.js";

console.log("=== LLM Settings ===");
const llm = getEffectiveLlmSettings();
console.log({
  provider: llm.provider,
  model: llm.model,
  baseUrl: llm.baseUrl,
  hasApiKey: Boolean(llm.apiKey),
  apiKeyPrefix: llm.apiKey.slice(0, 10),
});

console.log("\n=== Music Settings ===");
const music = getMusicSettings();
console.log({
  model: music.model,
  hasApiKey: Boolean(music.apiKey),
  apiKeyPrefix: music.apiKey.slice(0, 10),
  configured: isMusicGenConfigured(),
});

console.log("\n=== Available Tools for Agent ===");
const agent = getAgent("default") ?? { id: "default", name: "Default", disabledTools: [] };
const account = getAccount("acc-0984310011") ?? { id: "acc-0984310011", disabledTools: [] };
const available = listAvailableTools({ agent: agent as any, account: account as any });
console.log("Available tools:", available.map(t => t.key));

console.log("\n=== Last Turn Traces ===");
const maxTurn = db.prepare("SELECT MAX(turn_id) as turnId FROM message_history").get() as any;
console.log("Max turn ID in message_history:", maxTurn);

const steps = db.prepare("SELECT step_order, kind, tool_name, tool_input, substr(tool_output, 1, 200) as output_sample, substr(thought, 1, 200) as thought_sample FROM agent_traces WHERE turn_id = (SELECT MAX(turn_id) FROM message_history) ORDER BY step_order").all();
console.log("Last turn steps:", steps);

const msg = db.prepare("SELECT id, sender_name, text FROM message_history WHERE turn_id = (SELECT MAX(turn_id) FROM message_history)").all();
console.log("Last turn user messages:", msg);

