import assert from "node:assert/strict";
import { loiCuaTool } from "./tool-failure-result-test-helper.js";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";
import { fakeAgentProfile } from "../../shared/fake-agent-profile.js";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";

let dataDir: string;
let toolModule: typeof import("./read-image-tool.js");
let historyStore: typeof import("../../conversation/history-store.js");
let database: typeof import("../../conversation/database.js");
type ToolContext = import("./tool-registry.js").ToolContext;

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAABAAAAAQCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

before(async () => {
  dataDir = setupTestEnv();
  toolModule = await import("./read-image-tool.js");
  historyStore = await import("../../conversation/history-store.js");
  database = await import("../../conversation/database.js");
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

function writeMediaFile(relPath: string): string {
  const abs = path.join(dataDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, PNG_BYTES);
  return relPath;
}

function batchMsg(threadId: string, images: { url: string; localPath?: string }[]): ParsedMessage {
  return {
    accountId: "acc-ri",
    threadId,
    threadType: 0,
    isGroup: false,
    senderId: "u1",
    senderName: "Hải",
    text: "hỏi ảnh",
    images,
    msgId: "m1",
    cliMsgId: "c1",
    isSelf: false,
    mentionsMe: false,
    rawData: {},
  };
}

function makeContext(threadId: string, batch: ParsedMessage[]): ToolContext {
  return {
    api: {} as never,
    account: { id: "acc-ri", disabledTools: [] } as never,
    agent: fakeAgentProfile(),
    message: batch[batch.length - 1] ?? batchMsg(threadId, []),
    batch,
  };
}

/** Gọi execute của tool (kiểu Tool của AI SDK không lộ execute gọn) */
async function run(
  toolInstance: ReturnType<typeof toolModule.createReadImageTool>,
  input: { question: string; imageIndex?: number; imageIndexes?: number[] },
): Promise<string> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (toolInstance as any).execute({ imageIndex: 1, ...input }, {});
}

describe("collectRecentImagePaths", () => {
  it("ảnh batch hiện tại (chưa vào DB) đứng TRƯỚC ảnh history, mới nhất trước", () => {
    const t = "t-thu-tu";
    // History: tin cũ có ảnh
    historyStore.appendMessage("acc-ri", t, {
      role: "user",
      content: "cũ [gửi kèm 1 ảnh]",
      images: ["media/acc-ri/t/cu-0.png"],
    });
    const batch = [batchMsg(t, [{ url: "http://x/a.png", localPath: "media/acc-ri/t/moi-0.png" }])];

    const paths = toolModule.collectRecentImagePaths(makeContext(t, batch));
    assert.deepEqual(paths, ["media/acc-ri/t/moi-0.png", "media/acc-ri/t/cu-0.png"]);
  });

  it("ảnh batch persist lỗi (không localPath) bị bỏ qua, không làm lệch index", () => {
    const paths = toolModule.collectRecentImagePaths(
      makeContext("t-trong", [batchMsg("t-trong", [{ url: "http://x/fail.png" }])]),
    );
    assert.deepEqual(paths, []);
  });
});

describe("read_image tool", () => {
  it("trả lời câu hỏi bằng đúng ảnh mới nhất, câu hỏi đi nguyên vẹn tới sidecar", async () => {
    const t = "t-hoi";
    const relPath = writeMediaFile(`media/acc-ri/${t}/ca-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/ca.png", localPath: relPath }])];

    let receivedQuestion = "";
    let receivedBase64 = "";
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async (image, question) => {
      receivedQuestion = question;
      receivedBase64 = image.base64;
      return "Có đúng 1 con cá màu vàng, nằm mé phải bể.";
    });

    const answer = await run(instance, { question: "Đếm số cá màu vàng" });
    assert.equal(answer, "Có đúng 1 con cá màu vàng, nằm mé phải bể.");
    assert.equal(receivedQuestion, "Đếm số cá màu vàng");
    assert.equal(receivedBase64, PNG_BYTES.toString("base64"), "phải gửi đúng ảnh đã lưu");
  });

  it("imageIndex chọn được ảnh cũ hơn trong history", async () => {
    const t = "t-index";
    const oldPath = writeMediaFile(`media/acc-ri/${t}/hd-cu-0.png`);
    historyStore.appendMessage("acc-ri", t, {
      role: "user",
      content: "hóa đơn cũ [gửi kèm 1 ảnh]",
      images: [oldPath],
    });
    const newPath = writeMediaFile(`media/acc-ri/${t}/hd-moi-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/n.png", localPath: newPath }])];

    const seen: string[] = [];
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => {
      seen.push("called");
      return "ok";
    });

    await run(instance, { question: "đọc số hóa đơn", imageIndex: 2 });
    assert.equal(seen.length, 1, "index 2 = ảnh history cũ hơn vẫn gọi được sidecar");
  });

  it("không có ảnh nào -> nói thẳng, không gọi sidecar", async () => {
    let calls = 0;
    const instance = toolModule.createReadImageTool(makeContext("t-khong-anh", []), async () => {
      calls++;
      return "x";
    });
    const answer = await run(instance, { question: "ảnh gì đây" });
    assert.match(loiCuaTool(answer), /Không có ảnh nào/);
    assert.equal(calls, 0);
  });

  it("imageIndex vượt số ảnh -> báo số lượng thật", async () => {
    const t = "t-vuot";
    const relPath = writeMediaFile(`media/acc-ri/${t}/mot-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/1.png", localPath: relPath }])];
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => "x");

    const answer = await run(instance, { question: "xem ảnh 5", imageIndex: 5 });
    assert.match(loiCuaTool(answer), /chỉ còn 1 ảnh/);
  });

  it("file đã bị dọn -> báo hết hạn lưu trữ", async () => {
    const t = "t-don";
    const batch = [
      batchMsg(t, [{ url: "http://x/x.png", localPath: `media/acc-ri/${t}/da-xoa-0.png` }]),
    ];
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => "x");
    const answer = await run(instance, { question: "xem lại" });
    assert.match(loiCuaTool(answer), /đã bị dọn/);
  });

  it("sidecar lỗi (hết quota) -> thông báo trung thực cho model, không throw", async () => {
    const t = "t-loi";
    const relPath = writeMediaFile(`media/acc-ri/${t}/err-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/e.png", localPath: relPath }])];
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => {
      throw new Error("429 quota exceeded");
    });

    const answer = await run(instance, { question: "đếm cá" });
    const loi = loiCuaTool(answer);
    assert.match(loi, /Hệ thống đọc ảnh đang lỗi/);
    assert.match(loi, /429 quota exceeded/);
    assert.match(loi, /đừng đoán/);
  });
});

describe("read_image batch mode (imageIndexes)", () => {
  it("imageIndexes=[1,2,3] đọc song song 3 ảnh, trả kết quả ghép đúng thứ tự", async () => {
    const t = "t-batch";
    const paths = [
      writeMediaFile(`media/acc-ri/${t}/p1-0.png`),
      writeMediaFile(`media/acc-ri/${t}/p2-0.png`),
      writeMediaFile(`media/acc-ri/${t}/p3-0.png`),
    ];
    const batch = [
      batchMsg(t, paths.map((p) => ({ url: `http://x/${p}`, localPath: p }))),
    ];

    let callCount = 0;
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async (_image, question) => {
      callCount++;
      return `Dữ liệu bảng ảnh ${callCount}: STT | Tên | ${question}`;
    });

    const answer = await run(instance, { question: "trích xuất bảng", imageIndexes: [1, 2, 3] });
    assert.equal(callCount, 3, "phải gọi sidecar 3 lần");
    assert.match(answer, /Đã đọc thành công 3\/3/);
    assert.match(answer, /\[Ảnh 1\/3/);
    assert.match(answer, /\[Ảnh 2\/3/);
    assert.match(answer, /\[Ảnh 3\/3/);
  });

  it("1 ảnh lỗi trong batch -> ảnh đó báo lỗi, ảnh còn lại vẫn trả kết quả", async () => {
    const t = "t-batch-err";
    // Ảnh 1 tồn tại, ảnh 2 đã bị dọn (file không có trên đĩa)
    const p1 = writeMediaFile(`media/acc-ri/${t}/ok-0.png`);
    const batch = [
      batchMsg(t, [
        { url: "http://x/ok.png", localPath: p1 },
        { url: "http://x/gone.png", localPath: `media/acc-ri/${t}/gone-0.png` },
      ]),
    ];

    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => "dữ liệu OK");

    const answer = await run(instance, { question: "trích xuất", imageIndexes: [1, 2] });
    assert.match(answer, /Đọc được 1\/2/);
    assert.match(answer, /\[Ảnh 1\/2/);
    assert.match(answer, /dữ liệu OK/);
    assert.match(answer, /\[Lỗi:/);
    assert.match(answer, /đã bị dọn/);
  });

  it("imageIndexes=[] (rỗng) -> fallback về imageIndex", async () => {
    const t = "t-batch-empty";
    const relPath = writeMediaFile(`media/acc-ri/${t}/solo-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/s.png", localPath: relPath }])];

    let called = false;
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => {
      called = true;
      return "kết quả đơn lẻ";
    });

    const answer = await run(instance, { question: "đọc chữ", imageIndexes: [], imageIndex: 1 });
    assert.ok(called, "phải gọi sidecar qua single mode");
    assert.equal(answer, "kết quả đơn lẻ");
  });

  it("tất cả index vượt quá số ảnh -> báo lỗi gọn", async () => {
    const t = "t-batch-oob";
    const relPath = writeMediaFile(`media/acc-ri/${t}/one-0.png`);
    const batch = [batchMsg(t, [{ url: "http://x/1.png", localPath: relPath }])];
    const instance = toolModule.createReadImageTool(makeContext(t, batch), async () => "x");

    const answer = await run(instance, { question: "xem ảnh", imageIndexes: [5, 6, 7] });
    assert.match(loiCuaTool(answer), /chỉ còn 1 ảnh/);
  });
});

