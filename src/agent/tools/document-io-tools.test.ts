import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";
import { fakeAgentProfile } from "../../shared/fake-agent-profile.js";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { ketQuaThanhCong, loiCuaTool } from "./tool-failure-result-test-helper.js";

/**
 * read_document + create_text_document: chọn file theo tên, rào đường dẫn,
 * bọc nội dung ngoài, và nhánh nội dung rỗng không gửi file.
 */

let dataDir: string;
let database: typeof import("../../conversation/database.js");
let readDoc: typeof import("./read-document-tool.js");
let textDoc: typeof import("./create-text-document-tool.js");
type ToolContext = import("./tool-registry.js").ToolContext;

before(async () => {
  dataDir = setupTestEnv();
  database = await import("../../conversation/database.js");
  readDoc = await import("./read-document-tool.js");
  textDoc = await import("./create-text-document-tool.js");
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

type F = { fileName: string; localPath: string };

function ctxOf(threadId: string, files: F[] = [], api: Record<string, unknown> = {}): ToolContext {
  const m = {
    accountId: "acc-doc", threadId, threadType: 0, isGroup: false,
    senderId: "u1", senderName: "Hải", text: "đọc file", images: [], msgId: "m1", cliMsgId: "c1",
    isSelf: false, mentionsMe: false, rawData: {},
    files: files.map((f) => ({ ...f, extension: path.extname(f.fileName), url: "http://x/f" })),
  } as ParsedMessage;
  return {
    api: api as never,
    account: { id: "acc-doc", disabledTools: [] } as never,
    agent: fakeAgentProfile(),
    message: m,
    batch: [m],
  };
}

function writeData(rel: string, content: string): string {
  const abs = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return rel;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const run = (t: any, input: Record<string, unknown>) =>
  t.execute(input, { toolCallId: "tc", messages: [], context: {} as never });

describe("read_document", () => {
  it("không có file → ketQuaLoi", async () => {
    const r = await run(readDoc.createReadDocumentTool(ctxOf("t-d0")), { fileIndex: 0 });
    assert.match(loiCuaTool(r), /Không có file tài liệu nào/);
  });

  it("chọn theo tên gốc không dấu, đọc .txt, nội dung được bọc và kèm danh sách file khác", async () => {
    const mau = writeData("media/acc-doc/t-d1/mau.txt", "MẪU BÁO CÁO TUẦN");
    const khac = writeData("media/acc-doc/t-d1/khac.txt", "nội dung khác");
    const ctx = ctxOf("t-d1", [
      { fileName: "Ghi chú.txt", localPath: khac },
      { fileName: "Mẫu báo cáo.txt", localPath: mau },
    ]);
    const r = ketQuaThanhCong(await run(readDoc.createReadDocumentTool(ctx), { fileName: "mau bao cao", fileIndex: 0 }));
    assert.match(r, /MẪU BÁO CÁO TUẦN/);
    assert.doesNotMatch(r, /nội dung khác/);
    assert.match(r, /Mẫu báo cáo\.txt/);
    assert.match(r, /Các file khác đang có/);
  });

  it("tên không khớp → ketQuaLoi kèm danh sách", async () => {
    const p = writeData("media/acc-doc/t-d2/a.txt", "a");
    const r = await run(readDoc.createReadDocumentTool(ctxOf("t-d2", [{ fileName: "Kế hoạch.txt", localPath: p }])), {
      fileName: "quyet dinh", fileIndex: 0,
    });
    assert.match(loiCuaTool(r), /0: Kế hoạch\.txt/);
  });

  it("file ngoài dataDir → ketQuaLoi, không đọc", async () => {
    const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ngoai-")), "secret.txt");
    fs.writeFileSync(outside, "BÍ MẬT");
    const r = await run(readDoc.createReadDocumentTool(ctxOf("t-d3", [{ fileName: "secret.txt", localPath: outside }])), { fileIndex: 0 });
    assert.doesNotMatch(loiCuaTool(r), /BÍ MẬT/);
    fs.rmSync(path.dirname(outside), { recursive: true, force: true });
  });
});

describe("create_text_document", () => {
  it("nội dung rỗng → ketQuaLoi, không gửi gì", async () => {
    let sent = 0;
    const api = { sendMessage: async () => { sent += 1; return {}; } };
    const r = await run(textDoc.createTextDocumentTool(ctxOf("t-x0", [], api)), { format: "md", fileName: "a.md", content: "  " });
    assert.match(loiCuaTool(r), /không được để trống/);
    assert.equal(sent, 0);
  });

  it("API gửi lỗi → ketQuaLoi, không báo đã gửi", async () => {
    const api = { sendMessage: async () => { throw new Error("mất mạng"); } };
    let ghiNhan = 0;
    const ctx = { ...ctxOf("t-x1", [], api), ghiNhanDaGui: () => { ghiNhan += 1; } };
    const r = await run(textDoc.createTextDocumentTool(ctx), { format: "csv", fileName: "ds.csv", content: "a,b\n1,2" });
    assert.match(loiCuaTool(r), /Không tạo được file/);
    assert.equal(ghiNhan, 0);
  });
});
