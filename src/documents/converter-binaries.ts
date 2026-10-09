/**
 * converter-binaries.ts
 * Bọc các công cụ ngoài dùng cho chuyển đổi file: ffmpeg, pdftoppm, soffice (LibreOffice, tuỳ chọn)
 * và bộ ghi PDF tối giản nhúng ảnh JPEG. Chỉ truyền ĐỐI SỐ CỐ ĐỊNH qua execFile (không shell,
 * không chạy lệnh do model sinh ra).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

export class ConvertError extends Error {}

const TIMEOUT_MS = 120_000;

function run(bin: string, args: string[], hint: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, _o, stderr) => {
      if (!err) return resolve();
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return reject(new ConvertError(`Máy chủ chưa cài ${bin} nên chưa chuyển được ${hint}`));
      }
      reject(new ConvertError(`${bin} lỗi khi chuyển ${hint}: ${String(stderr || err.message).slice(-300)}`));
    });
  });
}

/** Chạy `work(thưMụcTạm)` rồi dọn thư mục. */
export async function withWorkDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = path.join(os.tmpdir(), `vbaibot-conv-${crypto.randomBytes(6).toString("hex")}`);
  fs.mkdirSync(dir, { recursive: true });
  try { return await work(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const FFMPEG_ARGS: Record<string, string[]> = {
  mp3: ["-vn", "-codec:a", "libmp3lame", "-q:a", "4"],
  wav: ["-vn"],
  m4a: ["-vn", "-c:a", "aac", "-b:a", "128k"],
  mp4: ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"],
  webm: ["-c:v", "libvpx", "-b:v", "1M", "-c:a", "libvorbis"],
  gif: ["-t", "15", "-vf", "fps=10,scale=480:-1:flags=lanczos"],
  png: ["-frames:v", "1"],
  jpg: ["-frames:v", "1", "-q:v", "2"],
  webp: ["-frames:v", "1"],
};

export async function ffmpegConvert(src: string, target: string): Promise<Buffer> {
  const extra = FFMPEG_ARGS[target];
  if (!extra) throw new ConvertError(`Chưa hỗ trợ chuyển sang .${target} bằng ffmpeg`);
  return withWorkDir(async (dir) => {
    const out = path.join(dir, `out.${target}`);
    await run("ffmpeg", ["-y", "-i", src, ...extra, out], `sang .${target}`);
    return fs.readFileSync(out);
  });
}

/** PDF → ảnh trang đầu (hoặc trang `page`). */
export async function pdfToImage(src: string, target: "png" | "jpg", page = 1): Promise<Buffer> {
  return withWorkDir(async (dir) => {
    const base = path.join(dir, "page");
    const fmt = target === "png" ? "-png" : "-jpeg";
    await run("pdftoppm", [fmt, "-r", "150", "-f", String(page), "-l", String(page), "-singlefile", src, base], "PDF sang ảnh");
    return fs.readFileSync(`${base}.${target}`);
  });
}

const OFFICE_TARGETS = new Set(["pdf", "docx", "xlsx", "doc", "xls", "odt", "ods"]);
let sofficeAvailable: boolean | undefined;

/** Chuyển bằng LibreOffice nếu máy có sẵn; trả null nếu không có/không làm được (để caller dùng đường dự phòng). */
export async function sofficeConvert(src: string, target: string): Promise<Buffer | null> {
  if (!OFFICE_TARGETS.has(target) || sofficeAvailable === false) return null;
  try {
    return await withWorkDir(async (dir) => {
      await run("soffice", ["--headless", "--convert-to", target, "--outdir", dir, src], `sang .${target}`);
      const out = path.join(dir, `${path.parse(src).name}.${target}`);
      sofficeAvailable = true;
      return fs.existsSync(out) ? fs.readFileSync(out) : null;
    });
  } catch (err) {
    if (err instanceof ConvertError && /chưa cài/.test(err.message)) sofficeAvailable = false;
    return null;
  }
}

function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new ConvertError("Không đọc được kích thước ảnh JPEG");
}

/** Ghép các ảnh JPEG thành PDF (mỗi ảnh một trang đúng tỷ lệ). */
export function jpegsToPdf(jpegs: Buffer[]): Buffer {
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let pos = parts[0]!.length;
  const add = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
    parts.push(buf);
    pos += buf.length;
  };
  const obj = (n: number, body: Buffer | string) => {
    offsets[n] = pos;
    add(`${n} 0 obj\n`);
    add(body);
    add("\nendobj\n");
  };
  const pageIds: number[] = [];
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  let next = 3;
  const pageObjs: Array<() => void> = [];
  jpegs.forEach((jpg) => {
    const { w, h } = jpegSize(jpg);
    const page = next, content = next + 1, img = next + 2;
    next += 3;
    pageIds.push(page);
    pageObjs.push(() => {
      const stream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
      obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`);
      obj(content, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      obj(img, Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, "latin1"),
        jpg,
        Buffer.from("\nendstream"),
      ]));
    });
  });
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pageObjs.forEach((fn) => fn());
  const xref = pos;
  add(`xref\n0 ${next}\n0000000000 65535 f \n`);
  for (let n = 1; n < next; n++) add(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(parts);
}
