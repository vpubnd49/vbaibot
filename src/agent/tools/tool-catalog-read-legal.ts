import { createThanhtraLamdongTool } from "./thanhtra-lamdong-tool.js";
import { createQpplLamdongTool } from "./qppl-lamdong-tool.js";
import { createNationalLegalTool } from "./national-legal-tool.js";
import { createListSkillsTool } from "./create-skill-tool.js";
import type { ToolDefinition } from "./tool-catalog-types.js";

/** Đầu nhóm "read": kỹ năng + kho VB (Thanh tra, QPPL Lâm Đồng, VB TW). Tách từ tool-catalog-read.ts, giữ thứ tự cũ. */
export const READ_LEGAL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "list_skills",
    label: "Danh sách kỹ năng",
    description: "Xem danh sách các kỹ năng (Skills) hiện có trong hệ thống và các từ khóa kích hoạt tương ứng",
    group: "read",
    keTrongKhaNang: true,
    build: () => createListSkillsTool(),
  },
  {
    key: "thanhtra_lamdong",
    label: "Kết luận Thanh tra Lâm Đồng",
    description:
      "Tra cứu danh sách, tóm tắt và tải file PDF Kết luận thanh tra, Thông báo kết luận của Thanh tra tỉnh Lâm Đồng (nguồn: lamdong.gov.vn)",
    group: "read",
    build: (ctx) => createThanhtraLamdongTool(ctx),
  },
  {
    key: "qppl_lamdong",
    label: "VB Chỉ đạo & QPPL tỉnh Lâm Đồng",
    description:
      "Tra cứu và tải file văn bản chỉ đạo điều hành, báo cáo, quyết định, công văn của UBND tỉnh, HĐND tỉnh, các Sở ban ngành (Tư pháp, Tài chính, GD&ĐT, Nội vụ...) và các địa phương cấp huyện (Đức Trọng, Di Linh...)",
    group: "read",
    build: (ctx) => createQpplLamdongTool(ctx),
  },
  {
    key: "national_legal",
    label: "VB Pháp luật cấp TW",
    description:
      "Tra cứu và tải file VB pháp luật cấp Trung ương: Luật, Nghị định, Thông tư, QĐ Thủ tướng, Nghị quyết QH/CP " +
       "(nguồn: Cổng Pháp luật quốc gia + CSDL quốc gia vbpl.vn + Công báo ĐT CP + Thư viện Pháp luật). Hỗ trợ tải PDF, DOC, DOCX.",
    group: "read",
    build: (ctx) => createNationalLegalTool(ctx),
  },
];
