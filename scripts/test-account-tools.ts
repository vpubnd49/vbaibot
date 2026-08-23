import { getAccounts } from "../src/config/account-store.js";
import { getAgents } from "../src/config/agent-store.js";
import { listAvailableTools } from "../src/agent/tools/tool-registry.js";
import { buildSystemPrompt } from "../src/agent/persona-prompt.js";

const accounts = getAccounts();
const agents = getAgents();
console.log("Accounts:", JSON.stringify(accounts, null, 2));
console.log("Agents:", JSON.stringify(agents, null, 2));
if (accounts.length && agents.length) {
  const tools = listAvailableTools({ account: accounts[0], agent: agents[0] });
  console.log("Available tools (" + tools.length + "):", tools.map(t => t.key));
  const prompt = buildSystemPrompt({
    account: accounts[0],
    agent: agents[0],
    memories: { facts: { user: [], group: [] }, summary: null },
    sharedKnowledge: [],
  });
  console.log("--- SYSTEM PROMPT (first 2000 chars) ---");
  console.log(prompt.slice(0, 2000));
}
