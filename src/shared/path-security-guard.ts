import fs from "node:fs";
import path from "node:path";

/**
 * Module bảo vệ đường dẫn hệ thống và chống tấn công Path Traversal, Symlink, LFI.
 */

/**
 * Kiểm tra xem một đường dẫn có chứa ký tự độc hại (Null byte, control characters, '..') hay không.
 */
export function hasTraversalMarkers(input: string): boolean {
  if (!input || typeof input !== "string") return true;
  // Chặn null bytes và ký tự điều khiển
  if (/[\0\x00-\x1f\x7f]/.test(input)) return true;
  // Chặn dot-dot traversal
  if (/(^|[\\/])\.\.([\\/]|$)/.test(input)) return true;
  return false;
}

/**
 * Kiểm tra xem một tệp/thư mục có phải là Symbolic Link (Symlink) hay không.
 */
export function isSymbolicLink(targetPath: string): boolean {
  try {
    const stat = fs.lstatSync(targetPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Kiểm tra và chuẩn hóa đường dẫn an toàn bên trong thư mục cho phép (allowedParentDir).
 * Ném lỗi nếu:
 * 1. Chứa ký tự path traversal hoặc null bytes.
 * 2. Tệp hoặc thư mục là Symbolic Link trỏ đi nơi khác.
 * 3. Đường dẫn sau khi phân giải thực tế (realpath) nằm ngoài thư mục cha cho phép.
 */
export function assertSafePathInside(targetPath: string, allowedParentDir: string): string {
  if (hasTraversalMarkers(targetPath)) {
    throw new Error(`Phát hiện đường dẫn không an toàn (Path Traversal / Null byte): "${targetPath}"`);
  }

  const resolvedAllowedDir = path.resolve(allowedParentDir);
  const resolvedTarget = path.resolve(targetPath);

  // Kiểm tra ban đầu trước khi gọi realpath
  if (!resolvedTarget.startsWith(resolvedAllowedDir + path.sep) && resolvedTarget !== resolvedAllowedDir) {
    throw new Error(`Đường dẫn "${targetPath}" nằm ngoài thư mục cho phép "${allowedParentDir}"`);
  }

  // Nếu tệp tồn tại, kiểm tra symlink và realpath thực tế
  if (fs.existsSync(resolvedTarget)) {
    if (isSymbolicLink(resolvedTarget)) {
      throw new Error(`Chặn truy cập Symbolic Link (Symlink bypass attack): "${targetPath}"`);
    }

    const realTarget = fs.realpathSync(resolvedTarget);
    let realAllowedDir = resolvedAllowedDir;
    try {
      if (fs.existsSync(resolvedAllowedDir)) {
        realAllowedDir = fs.realpathSync(resolvedAllowedDir);
      }
    } catch {
      // bỏ qua nếu thư mục cha chưa tạo
    }

    if (!realTarget.startsWith(realAllowedDir + path.sep) && realTarget !== realAllowedDir) {
      throw new Error(`Đường dẫn thực tế "${realTarget}" thoát khỏi vùng an toàn "${realAllowedDir}"`);
    }

    return realTarget;
  }

  return resolvedTarget;
}
