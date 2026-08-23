import fs from 'fs/promises';
import path from 'path';
import { dataDir } from '../config/env.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('voice-file-store');

/**
 * Lưu trữ và quản lý file voice audio trong thư mục data/media/voice
 */
export async function saveVoiceFile(accountId: string, threadId: string, audioBuffer: Buffer, format: string = 'wav') {
  const dirPath = path.join(dataDir, 'media', 'voice', accountId);
  
  try {
    // Đảm bảo thư mục lưu trữ tồn tại
    await fs.mkdir(dirPath, { recursive: true });
    
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `voice_${timestamp}_${randomSuffix}.${format}`;
    const absolutePath = path.join(dirPath, filename);
    
    await fs.writeFile(absolutePath, audioBuffer);
    log.info({ absolutePath, accountId }, 'Đã lưu file âm thanh thành công');
    
    // Trả về đường dẫn tương đối phục vụ web hoặc API, và đường dẫn tuyệt đối
    const relativePath = `media/voice/${accountId}/${filename}`;
    
    return { relativePath, absolutePath, filename };
  } catch (error) {
    log.error({ error, accountId }, 'Lỗi khi lưu file âm thanh');
    throw error;
  }
}

/**
 * Lấy đường dẫn tuyệt đối của file voice dựa trên account và tên file
 */
export async function getVoiceFilePath(accountId: string, filename: string): Promise<string | null> {
  const absolutePath = path.join(dataDir, 'media', 'voice', accountId, filename);
  try {
    await fs.access(absolutePath);
    return absolutePath;
  } catch {
    return null;
  }
}

/**
 * Dọn dẹp các file voice cũ hơn số ngày quy định
 */
export async function cleanupOldVoiceFiles(retentionDays: number = 7) {
  const voiceRoot = path.join(dataDir, 'media', 'voice');
  try {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    
    const accountDirs = await fs.readdir(voiceRoot, { withFileTypes: true });
    
    for (const dirent of accountDirs) {
      if (!dirent.isDirectory()) continue;
      
      const accountDirPath = path.join(voiceRoot, dirent.name);
      const files = await fs.readdir(accountDirPath);
      
      for (const file of files) {
        if (!file.startsWith('voice_')) continue;
        
        const filePath = path.join(accountDirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          log.info({ filePath }, 'Đã xóa file âm thanh cũ');
        }
      }
    }
  } catch (error) {
    // Chỉ báo lỗi nếu có lỗi khác ngoài việc thư mục không tồn tại
    if (error && (error as any).code !== 'ENOENT') {
      log.error({ error }, 'Lỗi khi dọn dẹp file voice cũ');
    }
  }
}
