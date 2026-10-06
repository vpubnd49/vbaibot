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
       assert.equal(body.get("model"), "gemini-3.8-flash");
      assert.equal(body.get("language"), "vi");
      assert.equal(body.get("response_format"), "json");
      return new Response(JSON.stringify({ text: "  Xin chào tiếng Việt  " }), { status: 200 });
    }) as typeof fetch;

    try {
      const result = await transcribeAudioFile(audioPath, "ghi-am.mp3", {
        baseUrl: "https://stt.test/v1",
        apiKey: "test-key",
         model: "omni/antigravity/gemini-3.8-flash-high",
        language: "vi",
        protocol: "transcriptions",
      });
      assert.deepEqual(result, { text: "Xin chào tiếng Việt", provider: "openai-compatible", model: "gemini-3.8-flash" });
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
        protocol: "transcriptions",
      });
      assert.equal(result?.text, "nội dung webm");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gọi Google Gemini API khi model bắt đầu bằng gemini hoặc base URL của Google", async () => {
    const originalFetch = globalThis.fetch;
    let request: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (input, init) => {
      request = { url: String(input), init: init ?? {} };
      const body = JSON.parse(init?.body as string);
      assert.ok(body.contents?.[0]?.parts?.[1]?.inlineData?.data);
      assert.equal(body.contents?.[0]?.parts?.[1]?.inlineData?.mimeType, "audio/mp3");
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: "Nội dung từ Gemini audio" }] } },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const result = await transcribeAudioFile(audioPath, "ghi-am.mp3", {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: "AQ.fake-key",
        model: "gemini-3.8-flash",
      });
      assert.deepEqual(result, {
        text: "Nội dung từ Gemini audio",
        provider: "openai-compatible",
        model: "gemini-3.8-flash",
      });
      assert.ok(request?.url.includes("models/gemini-3.8-flash:generateContent?key=AQ.fake-key"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gọi 9Router audio-chat và parse được SSE text-stream với key sk-", async () => {
    const originalFetch = globalThis.fetch;
    let request: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (input, init) => {
      request = { url: String(input), init: init ?? {} };
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk-906c221b-test");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, "ag/gemini-3-flash");
      assert.ok(Array.isArray(body.messages));
      assert.ok(body.messages[0].content[1].input_audio.data);

      const ssePayload = [
        'data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"Kết luận "}}]}',
        'data: {"id":"chatcmpl-2","choices":[{"index":0,"delta":{"content":"cuộc họp ngày hôm nay."}}]}',
        'data: [DONE]',
      ].join("\n");

      return new Response(ssePayload, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }) as typeof fetch;

    try {
      const result = await transcribeAudioFile(audioPath, "ghi-am.mp3", {
        baseUrl: "https://9router.flowgiare.com/v1",
        apiKey: "sk-906c221b-test",
        protocol: "audio-chat",
      });
      assert.deepEqual(result, {
        text: "Kết luận cuộc họp ngày hôm nay.",
        provider: "openai-compatible",
        model: "ag/gemini-3-flash",
      });
      assert.equal(request?.url, "https://9router.flowgiare.com/v1/chat/completions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
