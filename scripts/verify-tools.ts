import { listAccounts } from "../src/config/account-store.js";
import { listAgents } from "../src/config/agent-store.js";
import { listAvailableTools } from "../src/agent/tools/tool-registry.js";
import { isTtsConfigured } from "../src/config/runtime-tts-settings.js";

const a = listAccounts()[0]!;
const g = listAgents()[0]!;
const tools = listAvailableTools({ account: a, agent: g });

console.log("isTtsConfigured:", isTtsConfigured());
console.log("Total tools count:", tools.length);
console.log("create_voice_summary present:", tools.some(t => t.key === "create_voice_summary"));
console.log("All tool keys:", tools.map(t => t.key));
