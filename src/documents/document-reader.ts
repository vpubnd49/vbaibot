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

export type DocumentReadOptions = {
  /** Phạm vi trang 1-based, dùng cho PDF scan để chia lượt OCR thành các chunk nhỏ. */
  pageStart?: number;
  pageEnd?: number;
};

export type DocumentContent = {
  text: string;
  pageCount?: number;
  truncated: boolean;
  originalLength: number;
  fileType: string;
};

const SUPPORTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.ods', '.csv', '.tsv', '.txt', '.md',
  '.json', '.xml', '.html', '.htm', '.rtf',
  '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.heic', '.webp',
  '.zip',  // ZIP chứa nhiều file — batch-ocr-engine tự giải nén
] as const;
export type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];

export function isSupportedDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension);
}

export async function readDocument(filePath: string, options: DocumentReadOptions = {}): Promise<DocumentContent> {
  const ext = path.extname(filePath).toLowerCase() as SupportedExtension;
  let text = '';
  let pageCount: number | undefined;

  try {
    switch (ext) {
      case '.pdf': {
        try {
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
          }
        } catch (pdfErr) {
          log.warn({ filePath, err: pdfErr }, 'pdf-parse không đọc được text, chuyển sang OCR scan');
        }

        // PDF scan auto-OCR: chuyển trang thành ảnh rồi gọi vision sidecar đọc
        if (text.trim().length < 50) {
          const pages = (pageCount && pageCount > 0) ? pageCount : 10;
          const ocrText = await ocrScannedPdf(filePath, pages, options.pageStart, options.pageEnd);
          if (ocrText && ocrText.trim()) {
            text = ocrText;
          }
        }
        break;
      }
      case '.docx': {
        try {
          const mammoth = await import('mammoth');
          const htmlResult = await mammoth.convertToHtml({ path: filePath });
          text = htmlToStructuredText(htmlResult.value);
        } catch (docxErr) {
          // Fallback nếu file thực chất là format .doc cũ đổi tên
          try {
            // @ts-expect-error word-extractor lacks ts declarations
            const WordExtractorMod = await import('word-extractor');
            const WordExtractor = WordExtractorMod.default || WordExtractorMod;
            const extractor = new (WordExtractor as any)();
            const extracted = await extractor.extract(filePath);
            text = [extracted.getHeaders(), extracted.getBody(), extracted.getFooters()].filter(Boolean).join('\n\n');
          } catch {
            throw docxErr;
          }
        }
        break;
      }
      case '.doc': {
        try {
          // @ts-expect-error word-extractor lacks ts declarations
          const WordExtractorMod = await import('word-extractor');
          const WordExtractor = WordExtractorMod.default || WordExtractorMod;
          const extractor = new (WordExtractor as any)();
          const extracted = await extractor.extract(filePath);
          const body = extracted.getBody() || '';
          const headers = extracted.getHeaders() || '';
          const footers = extracted.getFooters() || '';
          text = [headers, body, footers].filter(Boolean).join('\n\n');
        } catch (docErr) {
          // Fallback nếu file thực chất là OOXML (.docx) đổi tên thành .doc
          try {
            const mammoth = await import('mammoth');
            const htmlResult = await mammoth.convertToHtml({ path: filePath });
            text = htmlToStructuredText(htmlResult.value);
          } catch {
            throw docErr;
          }
        }
        break;
      }
      case '.xlsx': {
        try {
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
        } catch (xlsxErr) {
          // Fallback qua xlsx (hỗ trợ cả XLS BIFF8, CSV, HTML table lưu dưới đuôi .xlsx)
          try {
            const xlsModule: any = await import('xlsx');
            const workbook = xlsModule.read(fs.readFileSync(filePath), { type: 'buffer', cellText: true, cellDates: true });
            for (const sheetName of workbook.SheetNames as string[]) {
              const sheet = workbook.Sheets[sheetName];
              text += `--- Sheet: ${sheetName} ---\n${xlsModule.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' })}\n`;
            }
          } catch {
            throw xlsxErr;
          }
        }
        break;
      }
      case '.xls':
      case '.ods': {
        const xlsModule: any = await import('xlsx');
        const workbook = xlsModule.read(fs.readFileSync(filePath), { type: 'buffer', cellText: true, cellDates: true });
        for (const sheetName of workbook.SheetNames as string[]) {
          const sheet = workbook.Sheets[sheetName];
          text += `--- Sheet: ${sheetName} ---\n${xlsModule.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' })}\n`;
        }
        break;
      }
      case '.json': {
        try {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          text = JSON.stringify(parsed, null, 2);
        } catch {
          text = fs.readFileSync(filePath, 'utf-8');
        }
        break;
      }
      case '.xml': {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
          const { XMLParser } = await import('fast-xml-parser');
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsed = parser.parse(raw);
          text = JSON.stringify(parsed, null, 2);
        } catch {
          text = raw;
        }
        break;
      }
      case '.html':
      case '.htm': {
        const html = fs.readFileSync(filePath, 'utf-8');
        text = htmlToStructuredText(html);
        break;
      }
      case '.rtf': {
        const raw = fs.readFileSync(filePath, 'utf-8');
        text = raw
          .replace(/\\par[d]?/g, '\n')
          .replace(/\\tab/g, '\t')
          .replace(/\\[a-zA-Z0-9\-]+ ?/g, '')
          .replace(/[{}]/g, '')
          .trim();
        break;
      }
      case '.tsv':
      case '.csv':
      case '.txt':
      case '.md': {
        text = fs.readFileSync(filePath, 'utf-8');
        break;
      }
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.bmp':
      case '.tiff':
      case '.tif':
      case '.heic':
      case '.webp': {
        pageCount = 1;
        text = await ocrScannedImage(filePath, ext);
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

// ─── Document OCR Shared ─────────────────────────────────────────────────────

/** Prompt OCR chuyên biệt cho trang tài liệu hành chính / văn bản scan */
const OCR_PROMPT =
  'Trích xuất NGUYÊN VĂN, ĐẦY ĐỦ toàn bộ chữ, số, bảng biểu, tiêu đề, chức danh ' +
  'và nơi nhận trên trang tài liệu này sang tiếng Việt. GIỮ NGUYÊN cấu trúc ' +
  'đánh số (Điều, Khoản, Điểm, Chương), thụt dòng và thứ tự. Không tóm tắt, không bỏ sót.\n' +
  'NẾU TRANG CÓ BẢNG BIỂU: trình bày bảng bằng markdown table (dùng dấu | phân cách cột). ' +
  'Dòng đầu tiên là header, dòng thứ hai là separator (---|---|---), các dòng tiếp theo là dữ liệu. ' +
  'Giữ nguyên mọi con số kể cả dấu chấm phân cách hàng nghìn (vd 1.234.567). ' +
  'Dòng nào có NỀN TÔ MÀU (vàng, xanh lá, xanh dương) thì ghi thêm [TÔ MÀU] ở cuối dòng đó. ' +
  'Nếu ảnh bị xoay/lật ngược, vẫn đọc đúng chiều chữ.';

// ─── Image Scan Auto-OCR ─────────────────────────────────────────────────────

/** Map phần mở rộng ảnh sang MIME type */
const IMAGE_MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.heic': 'image/heic',
};

/**
 * Tự động OCR file ảnh scan/chụp gửi dưới dạng document:
 * Đọc file → base64 → vision sidecar (askAboutImage) → text trích xuất.
 */
async function ocrScannedImage(filePath: string, ext: string): Promise<string> {
  // Lazy import vision sidecar — tránh circular dependency
  const { isSidecarConfigured: checkSidecar } = await import('../config/runtime-vision-settings.js');
  const visionModule = await import('../agent/vision-sidecar.js');

  if (!checkSidecar()) {
    return `[File ảnh scan/chụp (${ext}) chưa thể trích xuất nội dung do hệ thống chưa cấu hình AI nhận diện hình ảnh (Vision Sidecar).]`;
  }

  const mediaType = IMAGE_MEDIA_TYPES[ext] || 'image/jpeg';
  const imgBuffer = fs.readFileSync(filePath);
  const sidecarImage = {
    base64: imgBuffer.toString('base64'),
    mediaType,
  };

  try {
    log.info({ filePath, ext, mediaType }, 'Bắt đầu OCR file ảnh tài liệu scan');
    const ocrText = await visionModule.askAboutImage(sidecarImage, OCR_PROMPT);
    return ocrText.trim() || '[Ảnh scan không có chữ hoặc chữ quá mờ không nhận dạng được.]';
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn({ filePath, err }, 'OCR file ảnh scan thất bại');
    return `[Lỗi khi nhận diện chữ từ file ảnh scan: ${errMsg}]`;
  }
}

// ─── PDF Scan Auto-OCR ───────────────────────────────────────────────────────

/**
 * Tự động OCR file PDF scan: pdftoppm → PNG → vision sidecar → text.
 * Fallback nếu pdftoppm không có hoặc sidecar chưa cấu hình.
 */
async function ocrScannedPdf(
  filePath: string,
  totalPages: number,
  requestedStart?: number,
  requestedEnd?: number,
): Promise<string> {
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

  const configuredMaxPages = getTuning("DOCUMENT_PDF_OCR_MAX_PAGES");
  const startPage = Math.max(1, Math.min(totalPages, requestedStart ?? 1));
  const requestedLast = requestedEnd ?? totalPages;
  const endPage = Math.max(startPage, Math.min(totalPages, requestedLast));
  const pagesToOcr = Math.min(endPage - startPage + 1, configuredMaxPages);
  const actualEnd = startPage + pagesToOcr - 1;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));

  try {
    // Chuyển PDF → PNG bằng pdftoppm (200 DPI, đủ nét cho OCR)
            log.info({ filePath, totalPages, pageStart: startPage, pageEnd: actualEnd, pagesToOcr, dpi: 200 }, 'Bắt đầu auto-OCR PDF scan');
    await runPdftoppm(filePath, tmpDir, startPage, actualEnd);

    // Đọc các file PNG đã render
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort(); // pdftoppm đánh số tuần tự

    if (pngFiles.length === 0) {
      log.warn({ filePath }, 'pdftoppm không xuất được ảnh nào');
      return `[File PDF có ${totalPages} trang dạng scan nhưng không chuyển được thành ảnh để đọc.]`;
    }

    // OCR từng trang qua vision sidecar. `pngFiles` có thể được đặt tên page-03,
    // page-04... khi đọc chunk; không được đánh số lại thành Trang 1/10 vì model
    // sẽ tưởng đây là đầu tài liệu và người dùng không biết trang nào bị thiếu.
    const results: string[] = [];
    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = path.join(tmpDir, pngFiles[i]!);
      const pageNumber = startPage + i;
      const pngBuffer = fs.readFileSync(pngPath);
      const sidecarImage = {
        base64: pngBuffer.toString('base64'),
        mediaType: 'image/png' as const,
      };

      try {
        const pageText = await visionModule.askAboutImage(sidecarImage, OCR_PROMPT);
        const normalizedText = pageText.trim();
        const pageResult = normalizedText && !/^\[.*không.*(chữ|đọc được).*\]$/i.test(normalizedText)
          ? normalizedText
          : '[OCR không trả về dữ liệu văn bản cho trang này]';
        results.push(`--- Trang ${pageNumber}/${totalPages} ---\n${pageResult}`);
        log.info({ page: pageNumber, chars: normalizedText.length, ocrEmpty: !normalizedText }, 'OCR xong trang PDF');
      } catch (err) {
        log.warn({ page: pageNumber, err }, 'OCR trang PDF thất bại');
        results.push(`--- Trang ${pageNumber}/${totalPages} ---\n[OCR thất bại, chưa có dữ liệu trang này]`);
      }
    }

    const suffix = actualEnd < totalPages
      ? `\n\n[Đã OCR trang ${startPage}-${actualEnd}/${totalPages}. Muốn đọc tiếp, yêu cầu rõ phạm vi trang còn lại.]`
      : '';

    const nonEmptyPages = results.filter((result) => !result.includes('[OCR không trả về dữ liệu') && !result.includes('[OCR thất bại')).length;
    const emptyPages = results.length - nonEmptyPages;
    log.info({ filePath, pageStart: startPage, pageEnd: actualEnd, renderedPages: pngFiles.length, nonEmptyPages, emptyPages }, 'Hoàn thành OCR chunk PDF');
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
function runPdftoppm(pdfPath: string, outDir: string, startPage: number, endPage: number): Promise<void> {
  const outPrefix = path.join(outDir, 'page');
  return new Promise((resolve, reject) => {
    execFile('pdftoppm', [
      '-png',           // Xuất PNG
      '-r', '200',      // 200 DPI — cân bằng nét chữ và dung lượng
      '-f', String(startPage), // Bắt đầu từ trang người dùng yêu cầu
      '-l', String(endPage), // Kết thúc ở trang người dùng yêu cầu
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
