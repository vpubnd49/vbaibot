import { generateText } from "ai";
import { resolveLanguageModel } from "../agent/llm-provider.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("podcast-script");

export type PodcastScriptParams = {
  content: string;            // Nội dung nguồn để thảo luận
  hostNames?: [string, string]; // Mặc định: ["Anh", "Chị"]
  style?: "summary" | "deep-dive" | "brief"; // Mặc định: "summary"
  maxLengthChars?: number;    // Mặc định: 5000
};

/**
 * Sinh kịch bản podcast đa người nói từ nội dung văn bản.
 */
export async function generatePodcastScript(params: PodcastScriptParams): Promise<string> {
  const { 
    content, 
    hostNames = ["Anh", "Chị"],
    style = "summary",
    maxLengthChars = 5000
  } = params;

  log.info({ hosts: hostNames, style }, 'Bắt đầu sinh kịch bản podcast');

  const systemPrompt = `
Bạn là chuyên gia viết kịch bản radio và podcast chuyên nghiệp.
Nhiệm vụ của bạn là chuyển đổi nội dung người dùng cung cấp thành một đoạn hội thoại tự nhiên giữa 2 người dẫn chương trình (host).

YÊU CẦU:
- 2 host tên là: ${hostNames[0]} và ${hostNames[1]}.
- ${hostNames[0]} là người trình bày chính, ${hostNames[1]} hỏi và thêm nhận xét sắc sảo hoặc khơi gợi chủ đề.
- Dùng giọng Bắc chuẩn, văn phong nói tự nhiên nhất có thể, không phải văn viết.
- Định dạng mỗi dòng bắt buộc là: "[Tên host]: [Nội dung nói]".
  Ví dụ:
  ${hostNames[0]}: Chào các bạn, hôm nay chúng ta sẽ cùng tổng hợp...
  ${hostNames[1]}: Đúng rồi anh, có rất nhiều điểm đáng chú ý...
- Sử dụng các từ ngữ điệu tự nhiên trong giao tiếp: từ đệm (à, ừm, nha, nhé), các câu phản ứng tự nhiên.
- Thêm tag [pause], [emphasis] ở nơi cần ngắt nghỉ hoặc nhấn mạnh để giọng AI (TTS) đọc tự nhiên hơn.
- Phải bao quát được các ý chính của nội dung gốc một cách hấp dẫn như một chương trình phát thanh.
- Bắt đầu bằng câu chào hỏi mở đầu, kết thúc bằng tổng kết hoặc lời chào tạm biệt.
- KHÔNG dùng markdown định dạng chữ đậm/nghiêng, KHÔNG dùng emoji, KHÔNG gạch đầu dòng. Chỉ sử dụng thuần text tiếng Việt được phát âm.
- Chiều dài dự kiến: tối đa khoảng ${maxLengthChars} ký tự.
- Phong cách kịch bản: ${style === 'summary' ? 'Tóm tắt nhanh gọn' : style === 'deep-dive' ? 'Phân tích chuyên sâu và chi tiết' : 'Ngắn gọn, súc tích'}.
`;

  try {
    const result = await generateText({
      model: resolveLanguageModel(),
      system: systemPrompt,
      prompt: `Nội dung cần chuyển thành kịch bản podcast:\n\n${content}`
    });

    log.info({ length: result.text.length }, 'Đã sinh kịch bản podcast thành công');
    return result.text.trim();
  } catch (error) {
    log.error({ error }, 'Lỗi trong quá trình sinh kịch bản podcast');
    throw error;
  }
}
