import { streamText } from "ai";
import { resolveLanguageModel } from "../agent/llm-provider.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("podcast-script");

export type PodcastScriptParams = {
  content: string; // Nội dung nguồn để thảo luận
  hostNames?: [string, string]; // Mặc định: ["Anh", "Chị"]
  style?: "summary" | "deep-dive" | "brief"; // Mặc định: "summary"
  maxLengthChars?: number; // Mặc định: 5000
};

/**
 * Tự động tạo kịch bản 2 người nói từ nội dung văn bản (dùng khi LLM ngoài không khả dụng).
 */
function fallbackConstructScript(content: string, hostNames: [string, string]): string {
  const cleanContent = content
    .replace(/[#*`_~]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = cleanContent
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const scriptLines: string[] = [];
  const [h1, h2] = hostNames;

  scriptLines.push(`${h1}: Xin chào các bạn thính giả, chào mừng các bạn đến với bản tin tổng hợp dạng podcast hôm nay.`);
  scriptLines.push(`${h2}: Chào anh ${h1} và chào quý vị, chúng ta sẽ cùng điểm qua các nội dung quan trọng nhất ngay sau đây.`);

  let speakerIdx = 0;
  for (const line of lines) {
    if (line.length < 5) continue;
    const speaker = speakerIdx % 2 === 0 ? h1 : h2;
    // Bỏ các ký tự đánh số đầu dòng như 1., -, +
    const cleanLine = line.replace(/^[\d+.-]+\s*/, "");
    scriptLines.push(`${speaker}: ${cleanLine}`);
    speakerIdx++;
  }

  scriptLines.push(`${h2}: Đó là toàn bộ những điểm đáng chú ý nhất trong phần tóm tắt vừa rồi.`);
  scriptLines.push(`${h1}: Cảm ơn các bạn đã lắng nghe, chúc các bạn một ngày làm việc hiệu quả và nhiều năng lượng!`);

  return scriptLines.join("\n");
}

/**
 * Sinh kịch bản podcast đa người nói từ nội dung văn bản.
 */
export async function generatePodcastScript(params: PodcastScriptParams): Promise<string> {
  const { content, hostNames = ["Anh", "Chị"], style = "summary", maxLengthChars = 5000 } = params;

  log.info({ hosts: hostNames, style }, "Bắt đầu sinh kịch bản podcast");

  const systemPrompt = `
Bạn là chuyên gia viết kịch bản radio và podcast chuyên nghiệp kiểu NotebookLM.
Nhiệm vụ của bạn là chuyển đổi nội dung được cung cấp thành một đoạn hội thoại tự nhiên, hấp dẫn giữa 2 người dẫn chương trình (host).

YÊU CẦU:
- 2 host tên là: ${hostNames[0]} và ${hostNames[1]}.
- ${hostNames[0]} là người trình bày chính, ${hostNames[1]} hỏi và thêm nhận xét sắc sảo hoặc khơi gợi chủ đề.
- Dùng giọng Bắc chuẩn, văn phong nói tự nhiên nhất có thể, như 2 đồng nghiệp đang trao đổi công việc.
- Định dạng mỗi dòng bắt buộc là: "[Tên host]: [Nội dung nói]".
  Ví dụ:
  ${hostNames[0]}: Chào các bạn, hôm nay chúng ta sẽ cùng tổng hợp...
  ${hostNames[1]}: Đúng rồi anh, có rất nhiều điểm đáng chú ý...
- Phải bao quát được các ý chính của nội dung gốc một cách hấp dẫn như một chương trình phát thanh.
- Bắt đầu bằng câu chào hỏi mở đầu, kết thúc bằng tổng kết hoặc lời chào tạm biệt.
- KHÔNG dùng markdown định dạng chữ đậm/nghiêng, KHÔNG dùng emoji, KHÔNG gạch đầu dòng. Chỉ sử dụng thuần text tiếng Việt được phát âm.
- Chiều dài dự kiến: tối đa khoảng ${maxLengthChars} ký tự.
`;

  try {
    // Dùng streamText thay vì generateText để tương thích hoàn toàn với router proxy (tránh lỗi SSE Invalid JSON)
    const result = streamText({
      model: resolveLanguageModel(),
      system: systemPrompt,
      prompt: `Nội dung cần chuyển thành kịch bản podcast:\n\n${content}`,
    });

    let generatedText = "";
    for await (const chunk of result.textStream) {
      generatedText += chunk;
    }

    if (generatedText.trim().length > 50) {
      log.info({ length: generatedText.length }, "Đã sinh kịch bản podcast thành công qua LLM");
      return generatedText.trim();
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Lỗi khi gọi LLM sinh kịch bản podcast, kích hoạt fallback tạo kịch bản trực tiếp");
  }

  // Fallback an toàn: tự xây dựng kịch bản từ nội dung nếu LLM lỗi
  const fallbackScript = fallbackConstructScript(content, hostNames);
  log.info({ length: fallbackScript.length }, "Đã tạo kịch bản podcast qua bộ dựng nội dung trực tiếp");
  return fallbackScript;
}
