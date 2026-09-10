import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { ThreadType, type API } from "zca-js";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";
import { thanhKetQuaStream, type KetQuaGenerate } from "../agent/streaming-model-test-helper.js";
import type { AccountConfig } from "../config/account-store.js";
import type { ParsedMessage } from "./zalo-message-parser.js";

/**
 * Test DÂY NỐI của việc tiêm tin giữa lượt vào đường chat thật.
 *
 * `agent-loop` có test riêng cho phần đưa tin chen vào ngữ cảnh model, nhưng
 * những HỆ QUẢ PHỤ - ghi history, báo "đã xem" - nằm ở `message-turn-processor`
 * và chỉ đo được ở đây. Đúng lớp lỗi từng dính hai lần trong dự án này: hàm
 * viết đúng, không ai nối, mà toàn bộ test vẫn xanh.
 *
 * Thiếu phần ghi history là bot quên sạch câu người ta vừa nói giữa chừng -
 * cùng một lỗ hổng với ca tin bị bỏ ở trần hàng chờ.
 */

let dataDir: string;
let processor: typeof import("./message-turn-processor.js");
let batcher: typeof import("../middleware/message-batcher.js");
let accountStore: typeof import("../config/account-store.js");
let historyStore: typeof import("../conversation/history-store.js");
let database: typeof import("../conversation/database.js");

const ACC = "acc-chen";
const THREAD = "t-chen";
const THREAD_KEY = `${ACC}:${THREAD}`;

before(async () => {
  dataDir = setupTestEnv();
  processor = await import("./message-turn-processor.js");
  batcher = await import("../middleware/message-batcher.js");
  accountStore = await import("../config/account-store.js");
  historyStore = await import("../conversation/history-store.js");
  database = await import("../conversation/database.js");
  accountStore.createAccount({ id: ACC, label: "Test" });
});

after(() => {
  batcher.clearPendingBatches();
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

let daGui: string[] = [];
let daBaoDaXem: number;
beforeEach(() => {
  daGui = [];
  daBaoDaXem = 0;
  batcher.clearPendingBatches();
  database.db.prepare("DELETE FROM messages WHERE thread_id = ?").run(THREAD);
});

const config: AccountConfig = {
  id: ACC,
  label: "Test",
  enabled: true,
  agentId: "khong-co-agent-nay",
  allowlist: { mode: "all", userIds: [] },
  groupRequireMention: true,
  respondToGroups: true,
  groupPassiveListen: true,
  autoReactEnabled: false,
  autoReactIcon: "heart",
  typingIndicatorEnabled: false,
  disabledTools: [],
};

const api = {
  getOwnId: () => "self-1",
  sendMessage: async (payload: { msg: string }) => {
    daGui.push(payload.msg);
    return { msgId: `m-${daGui.length}` };
  },
  sendTypingEvent: async () => ({}),
  addReaction: async () => ({}),
  sendSeenEvent: async () => {
    daBaoDaXem++;
    return {};
  },
} as unknown as API;

function tinNhan(text: string, msgId: string): ParsedMessage {
  return {
    accountId: ACC,
    threadId: THREAD,
    threadType: ThreadType.User,
    isGroup: false,
    senderId: "user-1",
    senderName: "Hải",
    text,
    images: [],
    msgId,
    cliMsgId: `c-${msgId}`,
    isSelf: false,
    mentionsMe: false,
    // `toReceiptParams` (message-receipts.ts) đọc từ ĐÂY chứ không đọc các
    // trường cấp trên. Để rỗng thì mọi biên nhận bị bỏ lặng lẽ và test "đã
    // xem" sẽ xanh giả - nó đo 0 lần gọi và tưởng là đúng.
    rawData: { msgId, cliMsgId: `c-${msgId}`, uidFrom: "user-1", idTo: "self-1" },
  };
}

const traLoi = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: "stop" as const,
  usage: {
    inputTokens: { total: 60, noCache: 60, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 15, text: 15, reasoning: 0 },
  },
  warnings: [],
});

const noiDungHistory = (): string[] =>
  historyStore.getRecentMessages(ACC, THREAD).map((m) => m.content);

/**
 * Đặt một tin vào trạng thái ĐỖ trong hàng chờ, y như đời thật.
 *
 * Phải chiếm khoá thread TRƯỚC: không có ai giữ khoá thì `flush` chốt batch
 * ngay và chạy nó bằng handler rỗng - tin biến mất trước khi lượt kịp bắt đầu,
 * và test sẽ đo nhầm rằng đường tiêm không hoạt động.
 *
 * Ngoài đời chính lượt agent giữ khoá đó (bộ gộp gọi `processBatch` qua
 * `runOnThreadChain`); ở đây `processBatch` được gọi thẳng nên phải tự dựng.
 */
async function doTinVaoHangCho(
  text: string,
  msgId: string,
  extra: Partial<ParsedMessage> = {},
): Promise<() => void> {
  let nhaKhoa!: () => void;
  const bịChặn = new Promise<void>((resolve) => {
    nhaKhoa = resolve;
  });
  void batcher.runOnThreadChain(THREAD_KEY, () => bịChặn);

  const msg = { ...tinNhan(text, msgId), ...extra };
  batcher.enqueueMessage(THREAD_KEY, msg, async () => {}, 0);
  await new Promise((r) => setTimeout(r, 10)); // hết cửa sổ gộp -> đỗ lại
  return nhaKhoa;
}

describe("tiêm tin nhắn giữa lượt (message-turn-processor wire)", () => {
  it("người dùng nhắn thêm trong lúc agent đang chạy: tin chen được ghi vào history", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => thanhKetQuaStream(traLoi("đã rõ") as unknown as KetQuaGenerate),
    });

    const nhaKhoa = await doTinVaoHangCho("nhắn thêm giữa chừng", "m2");

    await processor.processBatch(config, api, [tinNhan("câu hỏi đầu", "m1")], {
      resolveModel: () => model,
    });
    nhaKhoa();

    const history = noiDungHistory();
    assert.equal(history.filter((c) => c.includes("câu hỏi đầu")).length, 1, "phải có tin đầu");
    assert.equal(history.filter((c) => c.includes("nhắn thêm giữa chừng")).length, 1, "phải có tin chen");
    assert.equal(history.length, 3, "2 tin user + 1 tin assistant");
    assert.deepEqual(daGui, ["đã rõ"]);
  });

  it("tin chen cũng được báo ĐÃ XEM xuống Zalo để người nhắn không tưởng tin bị rơi", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => thanhKetQuaStream(traLoi("xong") as unknown as KetQuaGenerate),
    });

    const nhaKhoa = await doTinVaoHangCho("nhắn thêm nè", "m2");

    await processor.processBatch(config, api, [tinNhan("tin 1", "m1")], {
      resolveModel: () => model,
    });
    nhaKhoa();

    // 1 lần cho batch mở đầu + 1 lần cho tin chen
    assert.equal(daBaoDaXem, 2, `mong 2 lần báo đã xem, nhận ${daBaoDaXem}`);
  });

  it("ảnh của tin chen cũng được lưu xuống đĩa như tin mở đầu", async () => {
    // Thiếu bước này thì history chỉ còn dòng chữ "[gửi kèm N ảnh]" mà không
    // đường dẫn nào: lượt sau bot không nạp lại được ảnh, sidecar phải mô tả
    // lại từ đầu mỗi lần (cache khóa theo chính `localPath`), và ảnh mất hẳn
    // khi URL Zalo hết hạn. Mất dữ liệu, không tự phục hồi được.
    const model = new MockLanguageModelV4({
      doStream: async () => thanhKetQuaStream(traLoi("ok") as unknown as KetQuaGenerate),
    });

    const daLuu: string[][] = [];
    const nhaKhoa = await doTinVaoHangCho("xem ảnh này giúp mình", "m2");

    await processor.processBatch(config, api, [tinNhan("câu hỏi đầu", "m1")], {
      resolveModel: () => model,
      persistImages: async (_acc, messages) => {
        daLuu.push(messages.map((m) => m.msgId ?? ""));
      },
    });
    nhaKhoa();

    assert.equal(daLuu.length, 2, `mong 2 lần lưu (batch mở đầu + tin chen), nhận ${daLuu.length}`);
    assert.deepEqual(daLuu[0], ["m1"], "lần đầu là batch mở đầu");
    assert.deepEqual(daLuu[1], ["m2"], "lần hai PHẢI là tin chen");
  });

  it("file tài liệu của tin chen cũng được lưu xuống đĩa như tin mở đầu", async () => {
    // Thiếu bước này thì model sẽ thấy `localPath: undefined` và báo lỗi không tải được file,
    // đồng thời history sẽ mất thông tin file khi URL Zalo hết hạn.
    const model = new MockLanguageModelV4({
      doStream: async () => thanhKetQuaStream(traLoi("ok") as unknown as KetQuaGenerate),
    });

    const daLuuFiles: string[][] = [];
    const nhaKhoa = await doTinVaoHangCho("xem file này giúp mình", "m2", {
      files: [{ fileName: "403-bao-cao.pdf", url: "https://example.com/403.pdf", extension: ".pdf" }],
    });

    await processor.processBatch(
      config,
      api,
      [{ ...tinNhan("câu hỏi đầu", "m1"), files: [{ fileName: "04-bao-cao.pdf", url: "https://example.com/04.pdf", extension: ".pdf" }] }],
      {
        resolveModel: () => model,
        persistFiles: async (_acc, messages) => {
          daLuuFiles.push(messages.map((m) => m.msgId ?? ""));
        },
      },
    );
    nhaKhoa();

    assert.equal(daLuuFiles.length, 2, `mong 2 lần lưu file (batch mở đầu + tin chen), nhận ${daLuuFiles.length}`);
    assert.deepEqual(daLuuFiles[0], ["m1"], "lần đầu là batch mở đầu");
    assert.deepEqual(daLuuFiles[1], ["m2"], "lần hai PHẢI là tin chen");
  });

  it("hàng chờ rỗng thì mọi thứ y như cũ - đối chứng", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => thanhKetQuaStream(traLoi("chào anh") as unknown as KetQuaGenerate),
    });

    await processor.processBatch(config, api, [tinNhan("chào bot", "m1")], {
      resolveModel: () => model,
    });

    const history = noiDungHistory();
    assert.equal(history.filter((c) => c.includes("chào bot")).length, 1, "không được ghi trùng");
    assert.equal(daBaoDaXem, 1, "không có tin chen thì chỉ 1 lần báo đã xem");
    assert.deepEqual(daGui, ["chào anh"]);
  });
});
