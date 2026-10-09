import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";
import { fakeAgentProfile } from "../../shared/fake-agent-profile.js";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { loiCuaTool } from "./tool-failure-result-test-helper.js";

/**
 * Nhánh CHẶN của các tool gửi file (video_workshop, convert_file,
 * transcribe_audio, send_file). Không chạy ffmpeg/STT/Zalo thật: chỉ kiểm việc
 * chọn file + rào đường dẫn trả `ketQuaLoi` đúng, không ném lỗi.
 */

let dataDir: string;
let database: typeof import("../../conversation/database.js");
let video: typeof import("./video-workshop-tool.js");
let convert: typeof import("./convert-file-tool.js");
let transcribe: typeof import("./transcribe-audio-tool.js");
let sendFile: typeof import("./send-file-tool.js");
type ToolContext = import("./tool-registry.js").ToolContext;

before(async () => {
  dataDir = setupTestEnv();
  database = await import("../../conversation/database.js");
  video = await import("./video-workshop-tool.js");
  convert = await import("./convert-file-tool.js");
  transcribe = await import("./transcribe-audio-tool.js");
  sendFile = await import("./send-file-tool.js");
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

function msg(threadId: string, files: { fileName: string; localPath: string }[] = []): ParsedMessage {
  return {
    accountId: "acc-fs",
    threadId,
    threadType: 0,
    isGroup: false,
    senderId: "u1",
    senderName: "Hải",
    text: "xử lý file",
    images: [],
    msgId: "m1",
    cliMsgId: "c1",
    isSelf: false,
    mentionsMe: false,
    rawData: {},
    files: files.map((f) => ({ ...f, extension: path.extname(f.fileName), url: "http://x/f" })),
  } as ParsedMessage;
}

function ctxOf(threadId: string, files: { fileName: string; localPath: string }[] = []): ToolContext {
  const m = msg(threadId, files);
  return {
    api: {} as never,
    account: { id: "acc-fs", disabledTools: [] } as never,
    agent: fakeAgentProfile(),
    message: m,
    batch: [m],
  };
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const run = (t: any, input: Record<string, unknown>) =>
  t.execute(input, { toolCallId: "tc", messages: [], context: {} as never });

describe("video_workshop", () => {
  it("không có file nào → ketQuaLoi nhờ gửi file", async () => {
    const r = await run(video.createVideoWorkshopTool(ctxOf("t-v0")), { action: "info", fileIndex: 0 });
    assert.match(loiCuaTool(r), /Chưa có file/);
  });

  it("fileName sai → ketQuaLoi kèm danh sách file hiện có", async () => {
    const ctx = ctxOf("t-v1", [{ fileName: "Họp tổ.mp4", localPath: "media/acc-fs/t-v1/hop.mp4" }]);
    const r = await run(video.createVideoWorkshopTool(ctx), { action: "info", fileName: "khong-co", fileIndex: 0 });
    assert.match(loiCuaTool(r), /0: Họp tổ\.mp4/);
  });

  it("khớp tên không dấu, file đã mất trên đĩa → báo không còn (rào path đã qua)", async () => {
    const ctx = ctxOf("t-v2", [{ fileName: "Họp tổ.mp4", localPath: "media/acc-fs/t-v2/hop.mp4" }]);
    const r = await run(video.createVideoWorkshopTool(ctx), { action: "info", fileName: "hop to", fileIndex: 0 });
    assert.match(loiCuaTool(r), /không còn trên máy chủ: hop\.mp4/);
  });

  it("đường dẫn tuyệt đối ngoài dataDir → bị chặn, không ném", async () => {
    const outside = path.join(os.tmpdir(), "khac", "secret.mp4");
    const ctx = ctxOf("t-v3", [{ fileName: "secret.mp4", localPath: outside }]);
    const r = await run(video.createVideoWorkshopTool(ctx), { action: "info", fileIndex: 0 });
    assert.match(loiCuaTool(r), /Lỗi xử lý/);
  });
});

describe("convert_file", () => {
  it("không có file nào → ketQuaLoi", async () => {
    const r = await run(convert.createConvertFileTool(ctxOf("t-c0")), { targetFormat: "pdf", fileIndex: 0 });
    assert.match(loiCuaTool(r), /Không có file nào/);
  });

  it("fileIndex vượt số file → ketQuaLoi kèm danh sách", async () => {
    const ctx = ctxOf("t-c1", [{ fileName: "Báo cáo.docx", localPath: "media/acc-fs/t-c1/bc.docx" }]);
    const r = await run(convert.createConvertFileTool(ctx), { targetFormat: "pdf", fileIndex: 5 });
    assert.match(loiCuaTool(r), /Vị trí file 5 không tồn tại[\s\S]*0: Báo cáo\.docx/);
  });

  it("collectConvertSources: file trong batch có mặt, không trùng", () => {
    const ctx = ctxOf("t-c2", [
      { fileName: "a.rar", localPath: "media/acc-fs/t-c2/a.rar" },
      { fileName: "a.rar", localPath: "media/acc-fs/t-c2/a.rar" },
    ]);
    const src = convert.collectConvertSources(ctx).filter((p) => p.includes("t-c2"));
    assert.deepEqual(src, ["media/acc-fs/t-c2/a.rar"]);
  });
});

describe("transcribe_audio", () => {
  it("không có file âm thanh → ketQuaLoi", async () => {
    const r = await run(transcribe.createTranscribeAudioTool(ctxOf("t-a0")), {});
    assert.match(loiCuaTool(r), /Không tìm thấy file âm thanh nào/);
  });

  it("tên sai → ketQuaLoi kèm danh sách", async () => {
    const ctx = ctxOf("t-a1", [{ fileName: "Bản ghi mới 11.m4a", localPath: "media/acc-fs/t-a1/ghi.m4a" }]);
    const r = await run(transcribe.createTranscribeAudioTool(ctx), { fileName: "phong van" });
    assert.match(loiCuaTool(r), /0: Bản ghi mới 11\.m4a/);
  });

  it("HỒI QUY: file hợp lệ trong dataDir KHÔNG bị coi là 'đường dẫn không hợp lệ'", async () => {
    // Bản cũ đảo tham số assertSafePathInside → mọi file đều bị chặn
    const ctx = ctxOf("t-a2", [{ fileName: "Bản ghi mới 11.m4a", localPath: "media/acc-fs/t-a2/ghi.m4a" }]);
    const r = await run(transcribe.createTranscribeAudioTool(ctx), { fileName: "ban ghi moi" });
    const loi = loiCuaTool(r);
    assert.doesNotMatch(loi, /không hợp lệ/);
    assert.match(loi, /Không tìm thấy file âm thanh trên đĩa/);
  });

  it("đường dẫn ra ngoài dataDir → bị chặn", async () => {
    const ctx = ctxOf("t-a3", [{ fileName: "x.mp3", localPath: "../../ngoai/x.mp3" }]);
    const r = await run(transcribe.createTranscribeAudioTool(ctx), {});
    assert.match(loiCuaTool(r), /không hợp lệ/);
  });
});

describe("send_file", () => {
  it("path traversal chỉ còn basename, không có trong kho → ketQuaLoi", async () => {
    const r = await run(sendFile.createSendFileTool(ctxOf("t-s0")), { source: "../../config/.env" });
    assert.match(loiCuaTool(r), /Không có file .* trong kho shared-files/);
  });

  it("URL nội bộ (SSRF) → ketQuaLoi, không ném", async () => {
    const r = await run(sendFile.createSendFileTool(ctxOf("t-s1")), { source: "http://127.0.0.1/a.pdf" });
    assert.match(loiCuaTool(r), /Gửi file thất bại/);
  });
});
