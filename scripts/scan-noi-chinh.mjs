/**
 * Script quét toàn bộ thư mục NỘI CHÍNH, đọc nội dung .doc/.docx,
 * lưu thành file JSON knowledge base cho chatbot.
 *
 * Chạy: node --experimental-specifier-resolution=node scripts/scan-noi-chinh.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "e:/OneDrive/HSCV/NỘI CHÍNH";
const OUT_FILE = "src/knowledge/noi-chinh-corpus.json";
const MAX_TEXT = 8000; // ký tự tối đa mỗi file (tránh quá lớn)

// ===== Helpers =====

async function readDocx(filePath) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ path: filePath });
    // Strip HTML → text
    let text = result.value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
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

async function readWordFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = null;

  if (ext === ".docx") {
    text = await readDocx(filePath);
    if (!text) text = await readDoc(filePath); // fallback
  } else if (ext === ".doc") {
    text = await readDoc(filePath);
    if (!text) text = await readDocx(filePath); // fallback
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
        if (ext === ".doc" || ext === ".docx") {
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
  console.log(`Quét thư mục: ${ROOT}`);
  const files = walkDir(ROOT);
  console.log(`Tìm thấy ${files.length} file .doc/.docx`);

  const corpus = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const category = relPath.split("/")[0]; // thư mục cấp 1

    if ((i + 1) % 50 === 0) {
      console.log(`  [${i + 1}/${files.length}] đang xử lý...`);
    }

    try {
      const text = await readWordFile(filePath);
      if (text && text.length > 50) {
        corpus.push({
          path: relPath,
          category,
          filename: path.basename(filePath),
          text,
        });
        ok++;
      } else {
        fail++;
      }
    } catch (err) {
      fail++;
    }
  }

  console.log(`\nKết quả: ${ok} file đọc được, ${fail} file lỗi/trống`);
  console.log(`Đang ghi ${OUT_FILE}...`);

  fs.writeFileSync(OUT_FILE, JSON.stringify(corpus, null, 0), "utf-8");

  const sizeKB = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log(`Xong! File ${OUT_FILE} — ${sizeKB} KB, ${corpus.length} mục`);

  // Thống kê theo category
  const stats = {};
  for (const item of corpus) {
    stats[item.category] = (stats[item.category] || 0) + 1;
  }
  console.log("\nThống kê theo thư mục:");
  for (const [cat, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} file`);
  }
}

main().catch(console.error);
