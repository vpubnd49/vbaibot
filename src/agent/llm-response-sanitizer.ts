/**
 * Phòng thủ trước response lỗi từ router proxy (9Router): có ca router trả lời
 * request NON-streaming bằng body là JSON hoàn chỉnh nhưng dính thêm đuôi SSE
 * `data: [DONE]` (và header content-type: text/event-stream). AI SDK parse JSON
 * sẽ fail ở ký tự đầu tiên sau dấu `}` đóng - toàn bộ lượt agent chết dù câu
 * trả lời đã được sinh ra và token đã tốn.
 *
 * Module này thuần (không import env/logger) để test import tĩnh được.
 */

const SSE_DONE_TRAILER = /(?:\s*data:\s*\[DONE\]\s*)+$/;

/**
 * Chuyển một luồng SSE (`data: {...}\n\ndata: [DONE]`) thành JSON hoàn chỉnh
 * của OpenAI Chat Completion (`chat.completion`), khi router upstream trả về
 * stream SSE dù request của client là non-streaming (`stream: false`).
 */
export function assembleSseToChatCompletion(sseText: string): string | null {
  const trimmed = sseText.trim();
  if (!trimmed.startsWith("data:")) return null;

  const lines = sseText.split(/\r?\n/);
  let id = "";
  let model = "";
  let created = Math.floor(Date.now() / 1000);
  let content = "";
  let reasoning = "";
  let finishReason = "stop";
  let usage: unknown = null;
  const toolCallsMap = new Map<number, { id: string; type: string; function: { name: string; arguments: string } }>();

  let hasValidChunk = false;

  for (const line of lines) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const dataStr = l.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") continue;

    try {
      const chunk = JSON.parse(dataStr);
      hasValidChunk = true;
      if (chunk.id) id = chunk.id;
      if (chunk.model) model = chunk.model;
      if (chunk.created) created = chunk.created;
      if (chunk.usage) usage = chunk.usage;

      const choice = chunk.choices?.[0];
      if (choice) {
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (delta) {
          if (delta.content) content += delta.content;
          if (delta.reasoning_content) reasoning += delta.reasoning_content;
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = toolCallsMap.get(idx) || {
                id: tc.id || "",
                type: tc.type || "function",
                function: { name: "", arguments: "" },
              };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              toolCallsMap.set(idx, existing);
            }
          }
        }
      }
    } catch {
      // Bỏ qua dòng json lỗi
    }
  }

  if (!hasValidChunk) return null;

  const message: Record<string, unknown> = {
    role: "assistant",
    content: content || null,
  };
  if (reasoning) {
    message.reasoning_content = reasoning;
  }
  if (toolCallsMap.size > 0) {
    message.tool_calls = Array.from(toolCallsMap.values());
  }

  return JSON.stringify({
    id: id || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created,
    model: model || "unknown",
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
    ...(usage ? { usage } : {}),
  });
}

/**
 * Cắt đuôi `data: [DONE]` nếu phần còn lại là JSON object hoàn chỉnh.
 * Trả về body đã làm sạch, hoặc null nếu body không khớp đúng ca lỗi này
 * (không có đuôi, hoặc phần còn lại không phải JSON - vd stream SSE thật).
 */
export function stripSseDoneTrailer(body: string): string | null {
  if (!SSE_DONE_TRAILER.test(body)) return null;

  const cleaned = body.replace(SSE_DONE_TRAILER, "").trim();
  // Stream SSE thật có dạng "data: {...}\n\ndata: [DONE]" - sau khi cắt đuôi
  // phần còn lại bắt đầu bằng "data:", không phải "{" -> không đụng vào
  if (!cleaned.startsWith("{")) return null;

  try {
    JSON.parse(cleaned);
  } catch {
    return null;
  }
  return cleaned;
}

export type SanitizingFetchOptions = {
  /** Gọi khi phát hiện + sửa response lỗi - dùng để log cảnh báo */
  onSanitized?: () => void;
  /** Cho test inject fetch giả; mặc định fetch toàn cục */
  baseFetch?: typeof globalThis.fetch;
};

/**
 * Bọc fetch cho AI SDK provider: response non-streaming nào dính đuôi SSE hoặc
 * bị router trả nhầm định dạng SSE stream thì chuyển đổi sạch thành JSON chuẩn.
 * Response streaming thật (request có "stream":true) không bị đụng tới - đọc body ở đây sẽ phá stream.
 */
export function createSanitizingFetch(options: SanitizingFetchOptions = {}): typeof globalThis.fetch {
  const baseFetch = options.baseFetch ?? globalThis.fetch;

  return async (input, init) => {
    const res = await baseFetch(input, init);
    if (!res.ok) return res;
    if (typeof init?.body === "string" && /"stream"\s*:\s*true/.test(init.body)) return res;

    const text = await res.text();
    let cleaned = stripSseDoneTrailer(text);
    if (cleaned === null && text.trim().startsWith("data:")) {
      cleaned = assembleSseToChatCompletion(text);
    }

    // Body đã bị đọc nên phải dựng lại Response dù có sửa hay không.
    // Xóa content-length/content-encoding: undici đã giải nén sẵn, giữ header
    // cũ sẽ sai lệch với body mới.
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    if (cleaned !== null) {
      headers.set("content-type", "application/json; charset=utf-8");
      options.onSanitized?.();
    }

    return new Response(cleaned ?? text, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
