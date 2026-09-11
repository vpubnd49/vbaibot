import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { transcribeAudioFile } from "./stt-client.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stt-test-"));
const audioPath = path.join(tempDir, "ghi-am.mp3");
fs.writeFileSync(audioPath, Buffer.from("fake-audio"));

describe("transcribeAudioFile", () => {
  it("trả transcript tiếng Việt từ API OpenAI-compatible", async () => {
    const originalFetch = globalThis.fetch;
    let request: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (input, init) => {
      request = { url: String(input), init: init ?? {} };
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      assert.ok(init?.body instanceof FormData);
      const body = init.body as FormData;
      assert.equal(body.get("model"), "whisper-test");
      assert.equal(body.get("language"), "vi");
      assert.equal(body.get("response_format"), "json");
      return new Response(JSON.stringify({ text: "  Xin chào tiếng Việt  " }), { status: 200 });
    }) as typeof fetch;

    try {
      const result = await transcribeAudioFile(audioPath, "ghi-am.mp3", {
        baseUrl: "https://stt.test/v1",
        apiKey: "test-key",
        model: "whisper-test",
        language: "vi",
      });
      assert.deepEqual(result, { text: "Xin chào tiếng Việt", provider: "openai-compatible", model: "whisper-test" });
      assert.equal(request?.url, "https://stt.test/v1/audio/transcriptions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("dùng MIME audio/webm cho file WebM", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const body = init?.body as FormData;
      const file = body.get("file") as File;
      assert.equal(file.type, "audio/webm");
      return new Response(JSON.stringify({ text: "nội dung webm" }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await transcribeAudioFile(audioPath, "ghi-am.webm", {
        baseUrl: "https://stt.test/v1",
        apiKey: "test-key",
      });
      assert.equal(result?.text, "nội dung webm");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ném lỗi có status khi provider trả HTTP lỗi", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("invalid key", { status: 401 })) as typeof fetch;
    try {
      await assert.rejects(
        () => transcribeAudioFile(audioPath, undefined, { baseUrl: "https://stt.test/v1", apiKey: "test-key" }),
        /STT HTTP 401: invalid key/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
