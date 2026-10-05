/**
 * Script quét toàn bộ thư mục NỘI CHÍNH, đọc nội dung .doc/.docx/.xlsx/.pdf,
 * cập nhật gia tăng (incremental) vào file JSON knowledge base cho chatbot.
 *
 * Chạy: node scripts/scan-noi-chinh.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "e:/OneDrive/HSCV/NỘI CHÍNH";
const OUT_FILE = "src/knowledge/noi-chinh-corpus.json";
const MAX_TEXT = 8000; // ký tự tối đa mỗi file

// ===== Helpers =====

async function readDocx(filePath) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ path: filePath });
    return result.value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return null;
  }
}

async function readDoc(filePath) {
  try {
    const WordExtractorMod = await import("word-extractor");
    const WordExtractor = WordExtractorMod.default || WordExtractorMod;
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    const body = extracted.getBody() || "";
    const headers = extracted.getHeaders() || "";
    const footers = extracted.getFooters() || "";
    return [headers, body, footers].filter(Boolean).join("\n\n").trim();
  } catch {
    return null;
  }
}

async function readExcel(filePath) {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    let text = "";
    workbook.eachSheet((worksheet) => {
      text += `--- Sheet: ${worksheet.name} ---\n`;
      worksheet.eachRow((row) => {
        if (row.values) {
          const cells = (row.values)
            .filter((v) => v !== undefined && v !== null)
            .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)));
          if (cells.length > 0) text += cells.join(" | ") + "\n";
        }
      });
      text += "\n";
    });
    return text.trim();
  } catch {
    return null;
  }
}

async function readPdfText(filePath) {
  try {
    const pdfModule = await import("pdf-parse");
    const parse = pdfModule.default || pdfModule;
    const dataBuffer = fs.readFileSync(filePath);
    const data = await parse(dataBuffer);
    const raw = data.text ? data.text.trim() : "";
    const meaningful = raw.replace(/[\s\d\r\n\t.,;:!?()\[\]{}"'\/\\|-]/g, "");
    if (meaningful.length > 50) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = null;

  if (ext === ".docx") {
    text = await readDocx(filePath);
    if (!text) text = await readDoc(filePath);
  } else if (ext === ".doc") {
    text = await readDoc(filePath);
    if (!text) text = await readDocx(filePath);
  } else if (ext === ".xlsx") {
    text = await readExcel(filePath);
  } else if (ext === ".pdf") {
    text = await readPdfText(filePath);
  }

  if (text && text.length > MAX_TEXT) {
    text = text.substring(0, MAX_TEXT) + "\n[... cắt bớt]";
  }
  return text;
}

// ===== Recursive scan =====

function walkDir(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("~")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if ([".doc", ".docx", ".xlsx", ".pdf"].includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error(`Lỗi đọc thư mục ${dir}: ${err.message}`);
  }
  return results;
}

// ===== Main =====

async function main() {
  console.log(`Bắt đầu quét thư mục NỘI CHÍNH: ${ROOT}`);

  // 1. Tải corpus hiện có
  const existingMap = new Map();
  if (fs.existsSync(OUT_FILE)) {
    try {
      const oldCorpus = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
      for (const item of oldCorpus) {
        if (item.path && item.text && item.text.length > 50) {
          existingMap.set(item.path, item);
        }
      }
      console.log(`Corpus hiện tại có: ${existingMap.size} tài liệu đã index.`);
    } catch (err) {
      console.warn("Không đọc được corpus cũ, sẽ lập chỉ mục mới:", err.message);
    }
  }

  const allFiles = walkDir(ROOT);
  console.log(`Tìm thấy tổng cộng ${allFiles.length} file (.doc, .docx, .xlsx, .pdf) trên đĩa.`);

  const corpus = [];
  let reused = 0;
  let newlyRead = 0;
  let failed = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const category = relPath.split("/")[0];

    // Tái sử dụng nếu đã đọc
    if (existingMap.has(relPath)) {
      corpus.push(existingMap.get(relPath));
      reused++;
      continue;
    }

    // Đọc file mới
    try {
      const text = await readFileContent(filePath);
      if (text && text.length > 50) {
        corpus.push({
          path: relPath,
          category,
          filename: path.basename(filePath),
          text,
        });
        newlyRead++;
        if (newlyRead % 20 === 0) {
          console.log(`  Đã đọc thêm ${newlyRead} file mới... (tổng duyệt: ${i + 1}/${allFiles.length})`);
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  console.log(`\nTổng kết quá trình đọc thư mục NỘI CHÍNH:`);
  console.log(`- Tài liệu tái sử dụng: ${reused}`);
  console.log(`- Tài liệu mới đọc thêm thành công: ${newlyRead}`);
  console.log(`- Tệp không có text / scan ảnh / lỗi: ${failed}`);
  console.log(`- Tổng số tài liệu trong Corpus: ${corpus.length}`);

  console.log(`Đang lưu vào ${OUT_FILE}...`);
  fs.writeFileSync(OUT_FILE, JSON.stringify(corpus, null, 0), "utf-8");

  const sizeMB = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Đã lưu thành công: ${OUT_FILE} (${sizeMB} MB, ${corpus.length} tài liệu).`);

  // Thống kê theo category
  const stats = {};
  for (const item of corpus) {
    stats[item.category] = (stats[item.category] || 0) + 1;
  }
  console.log("\nPhân bổ theo lĩnh vực trong NỘI CHÍNH:");
  for (const [cat, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  • ${cat}: ${count} văn bản`);
  }
}

main().catch(console.error);
