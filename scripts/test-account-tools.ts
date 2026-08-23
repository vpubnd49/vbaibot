import { listAccounts } from "../src/config/account-store.js";
import { listAgents } from "../src/config/agent-store.js";
import { listAvailableTools } from "../src/agent/tools/tool-registry.js";
import { buildSystemPrompt } from "../src/agent/persona-prompt.js";

import { getTtsSettings, isTtsConfigured } from "../src/config/runtime-tts-settings.js";
import { getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";

const accounts = listAccounts();
const agents = listAgents();
import { db } from "../src/conversation/database.js";
import { decryptSecret } from "../src/config/secret-cipher.js";

const rows = db.prepare("SELECT key, value FROM runtime_settings").all() as any[];
for (const r of rows) {
  let val = r.value;
  if (r.key.includes("key") && val) {
    try {
      const dec = decryptSecret(val);
      val = dec.slice(0, 8) + "..." + dec.slice(-4);
    } catch {
      val = "[DECRYPT_FAILED]";
    }
  }
  console.log(`Setting: ${r.key} = ${val}`);
}

const llm = getEffectiveLlmSettings();
console.log("LLM Settings:", llm.provider, llm.baseUrl, llm.model);

if (llm.baseUrl && llm.apiKey) {
  try {
    const res = await fetch(`${llm.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${llm.apiKey}` }
    });
    const data = await res.json() as any;
    const ids = (data.data || []).map((m: any) => m.id);
    console.log("Router models count:", ids.length);
    console.log("Router TTS/Audio models:", ids.filter((id: string) => /tts|speech|audio/i.test(id)));
    console.log("Router Gemini models:", ids.filter((id: string) => /gemini/i.test(id)));
  } catch (e: any) {
    console.log("Router fetch error:", e.message);
  }
}
