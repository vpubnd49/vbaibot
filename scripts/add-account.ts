import { createAccount, getAccount, updateAccount } from "../src/config/account-store.js";
import { ensureDefaultAgent } from "../src/config/agent-store.js";

const accountId = "acc-0984310011";
const label = "Châu Phiên Bản Số (0984310011)";

const defaultAgent = ensureDefaultAgent();

let acc = getAccount(accountId);
if (!acc) {
  acc = createAccount({
    id: accountId,
    label,
    agentId: defaultAgent.id,
  });
  console.log(`Đã tạo mới tài khoản Zalo: [${acc.id}] - "${acc.label}"`);
} else {
  acc = updateAccount(accountId, {
    label,
    agentId: defaultAgent.id,
    enabled: true,
  })!;
  console.log(`Đã cập nhật tài khoản Zalo: [${acc.id}] - "${acc.label}"`);
}

console.log("\nThông tin tài khoản đã cấu hình:");
console.log(JSON.stringify(acc, null, 2));
