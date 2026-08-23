import { listAccounts } from "../src/config/account-store.js";
import { listAgents } from "../src/config/agent-store.js";
import { listAvailableTools } from "../src/agent/tools/tool-registry.js";
import { buildSystemPrompt } from "../src/agent/persona-prompt.js";

import { getTtsSettings, isTtsConfigured } from "../src/config/runtime-tts-settings.js";
import { getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";

const accounts = listAccounts();
const agents = listAgents();
console.log("LLM Settings:", getEffectiveLlmSettings());
console.log("TTS Settings:", getTtsSettings());
console.log("isTtsConfigured:", isTtsConfigured());
if (accounts.length && agents.length) {
  const tools = listAvailableTools({ account: accounts[0], agent: agents[0] });
  console.log("Available tools (" + tools.length + "):", tools.map(t => t.key));
}
