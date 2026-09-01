import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { getTuning } from '../config/runtime-tuning-settings.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('document-reader');

/**
 * Chuyển HTML (từ mammoth) thành text CÓ CẤU TRÚC: giữ bảng biểu, heading,
 * danh sách có thứ tự. Kết quả dễ hiểu hơn nhiều so với extractRawText
 * khi file DOCX chứa layout 2 cột, bảng Nơi nhận/Chữ ký kiểu NĐ 30.
 */
function htmlToStructuredText(html: string): string {
  let text = html;

  // Headings → giữ nguyên dạng tiêu đề rõ ràng
  text = text.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_m, _level, content) => {
    return `\n${'#'.repeat(Number(_level))} ${stripTags(content).trim()}\n`;
  });

  // Bảng: xử lý <table> → text có phân cách cột bằng " | "
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableContent: string) => {
    const rows: string[] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const cells: string[] = [];
      const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(trMatch[1]!)) !== null) {
        cells.push(stripTags(tdMatch[1]!).trim());
      }
      if (cells.length > 0) rows.push(cells.join(' | '));
    }
    return '\n' + rows.join('\n') + '\n';
  });

  // Danh sách có thứ tự
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, content) => {
    return `- ${stripTags(content).trim()}\n`;
  });

  // Line breaks & paragraphs
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Strip remaining HTML tags
  text = stripTags(text);

  // Dọn dẹp: gộp nhiều dòng trống liên tiếp thành 1
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** Loại bỏ tất cả HTML tag, giữ lại text thuần */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export type DocumentContent = {
  text: string;
  pageCount?: number;
  truncated: boolean;
  originalLength: number;
  fileType: string;
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.md'] as const;
export type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];

export function isSupportedDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension);
}

export async function readDocument(filePath: string): Promise<DocumentContent> {
  const ext = path.extname(filePath).toLowerCase() as SupportedExtension;
  let text = '';
  let pageCount: number | undefined;

  try {
    switch (ext) {
      case '.pdf': {
        const pdfModule: any = await import('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        if (typeof pdfModule === 'function') {
          const data = await pdfModule(dataBuffer);
          text = data.text;
          pageCount = data.numpages;
        } else if (typeof pdfModule.default === 'function') {
          const data = await pdfModule.default(dataBuffer);
          text = data.text;
          pageCount = data.numpages;
        } else if (pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: dataBuffer });
          const result = await parser.getText();
          text = result.text;
          pageCount = result.total;
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
        } else {
          throw new Error('Module pdf-parse không tương thích với phiên bản hiện tại.');
        }
        // PDF scan auto-OCR: chuyển trang thành ảnh rồi gọi vision sidecar đọc
        if (text.trim().length < 50 && pageCount && pageCount > 0) {
          const ocrText = await ocrScannedPdf(filePath, pageCount);
          text = ocrText;
        }
        break;
      }
      case '.docx': {
        const mammoth = await import('mammoth');
        const htmlResult = await mammoth.convertToHtml({ path: filePath });
        text = htmlToStructuredText(htmlResult.value);
        break;
      }
      case '.doc': {
        // @ts-expect-error word-extractor lacks ts declarations
        const WordExtractorMod = await import('word-extractor');
        const WordExtractor = WordExtractorMod.default || WordExtractorMod;
        const extractor = new (WordExtractor as any)();
        const extracted = await extractor.extract(filePath);
        const body = extracted.getBody() || '';
        const headers = extracted.getHeaders() || '';
        const footers = extracted.getFooters() || '';
        text = [headers, body, footers].filter(Boolean).join('\n\n');
        break;
      }
      case '.xlsx': {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        workbook.eachSheet((worksheet, _sheetId) => {
          text += `--- Sheet: ${worksheet.name} ---\n`;
          worksheet.eachRow((row, _rowNumber) => {
            text += row.values
              ? (row.values as any[]).filter(v => v !== undefined && v !== null).join('\t') + '\n'
              : '\n';
          });
          text += '\n';
        });
        break;
      }
      case '.xls': {
        // ExcelJS chỉ hỗ trợ OOXML (.xlsx), không đọc được BIFF8 .xls.
        const xlsModule: any = await import('xlsx');
        const workbook = xlsModule.read(fs.readFileSync(filePath), { type: 'buffer', cellText: true, cellDates: true });
        for (const sheetName of workbook.SheetNames as string[]) {
          const sheet = workbook.Sheets[sheetName];
          text += `--- Sheet: ${sheetName} ---\n${xlsModule.utils.sheet_to_csv(sheet, { FS: '\\t', RS: '\\n' })}\n`;
        }
        break;
      }
      case '.csv':
      case '.txt':
      case '.md': {
        text = fs.readFileSync(filePath, 'utf-8');
        break;
      }
      default:
        text = `Lỗi: Định dạng file ${ext} không được hỗ trợ.`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, filePath }, `Lỗi khi đọc file document`);
    text = `Lỗi khi đọc nội dung file: ${errorMessage}`;
  }

  return {
    text,
    pageCount,
    truncated: false,
    originalLength: text.length,
    fileType: ext,
  };
}

// ─── PDF Scan Auto-OCR ───────────────────────────────────────────────────────

/** Số trang tối đa sẽ tự động OCR — tránh quá tải token & timeout */
const MAX_OCR_PAGES = 10;

/** Prompt OCR chuyên biệt cho trang tài liệu hành chính */
const OCR_PROMPT =
  'Trích xuất NGUYÊN VĂN, ĐẦY ĐỦ toàn bộ chữ, số, bảng biểu, tiêu đề, chức danh ' +
  'và nơi nhận trên trang tài liệu này sang tiếng Việt. GIỮ NGUYÊN cấu trúc ' +
  'đánh số (Điều, Khoản, Điểm, Chương), thụt dòng và thứ tự. Không tóm tắt, không bỏ sót.';

/**
 * Tự động OCR file PDF scan: pdftoppm → PNG → vision sidecar → text.
 * Fallback nếu pdftoppm không có hoặc sidecar chưa cấu hình.
 */
async function ocrScannedPdf(filePath: string, totalPages: number): Promise<string> {
  // Lazy import vision sidecar — tránh circular dependency
  const { isSidecarConfigured: checkSidecar } = await import('../config/runtime-vision-settings.js');
  const visionModule = await import('../agent/vision-sidecar.js');

  if (!checkSidecar()) {
    return `[File PDF có ${totalPages} trang nhưng không trích xuất được nội dung text. ` +
      `Đây có thể là file PDF dạng scan/ảnh chụp. Hãy gửi ảnh chụp từng trang để bot đọc chi tiết qua nhận diện hình ảnh.]`;
  }

  // Kiểm tra pdftoppm có sẵn trên hệ thống không
  const hasPdftoppm = await checkPdftoppm();
  if (!hasPdftoppm) {
    log.warn('pdftoppm không tìm thấy trên hệ thống — không thể auto-OCR PDF scan');
    return `[File PDF có ${totalPages} trang dạng scan/ảnh chụp. Hệ thống chưa cài pdftoppm để chuyển đổi. ` +
      `Hãy gửi ảnh chụp từng trang để bot đọc chi tiết.]`;
  }

  const maxPages = getTuning("DOCUMENT_PDF_OCR_MAX_PAGES");
  const pagesToOcr = Math.min(totalPages, maxPages);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));

  try {
    // Chuyển PDF → PNG bằng pdftoppm (200 DPI, đủ nét cho OCR)
    log.info({ filePath, totalPages, pagesToOcr }, 'Bắt đầu auto-OCR PDF scan');
    await runPdftoppm(filePath, tmpDir, pagesToOcr);

    // Đọc các file PNG đã render
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort(); // pdftoppm đánh số tuần tự

    if (pngFiles.length === 0) {
      log.warn({ filePath }, 'pdftoppm không xuất được ảnh nào');
      return `[File PDF có ${totalPages} trang dạng scan nhưng không chuyển được thành ảnh để đọc.]`;
    }

    // OCR từng trang qua vision sidecar
    const results: string[] = [];
    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = path.join(tmpDir, pngFiles[i]!);
      const pngBuffer = fs.readFileSync(pngPath);
      const sidecarImage = {
        base64: pngBuffer.toString('base64'),
        mediaType: 'image/png' as const,
      };

      try {
        const pageText = await visionModule.askAboutImage(sidecarImage, OCR_PROMPT);
        results.push(`--- Trang ${i + 1}/${pngFiles.length} ---\n${pageText}`);
        log.info({ page: i + 1, chars: pageText.length }, 'OCR xong trang PDF');
      } catch (err) {
        log.warn({ page: i + 1, err }, 'OCR trang PDF thất bại');
        results.push(`--- Trang ${i + 1}/${pngFiles.length} ---\n[Không đọc được trang này]`);
      }
    }

    const suffix = totalPages > MAX_OCR_PAGES
      ? `\n\n[Chỉ OCR ${MAX_OCR_PAGES}/${totalPages} trang đầu. Gửi ảnh các trang còn lại nếu cần.]`
      : '';

    return results.join('\n\n') + suffix;
  } finally {
    // Dọn dẹp thư mục tạm
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }
}

/** Kiểm tra pdftoppm có sẵn trên hệ thống không */
function checkPdftoppm(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('pdftoppm', ['-v'], { timeout: 3000 }, (err) => {
      resolve(!err);
    });
  });
}

/** Chạy pdftoppm chuyển PDF → PNG, 200 DPI, giới hạn số trang */
function runPdftoppm(pdfPath: string, outDir: string, maxPages: number): Promise<void> {
  const outPrefix = path.join(outDir, 'page');
  return new Promise((resolve, reject) => {
    execFile('pdftoppm', [
      '-png',           // Xuất PNG
      '-r', '200',      // 200 DPI — cân bằng nét chữ và dung lượng
      '-l', String(maxPages), // Chỉ render đến trang maxPages
      pdfPath,
      outPrefix,
    ], { timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) {
        log.error({ err, stderr }, 'pdftoppm thất bại');
        reject(new Error(`pdftoppm lỗi: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}
