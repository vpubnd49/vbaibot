/**
 * Bản đồ tên model hiển thị trên dashboard → model ID gửi lên KIE API.
 *
 * Dashboard lưu tên thân thiện ("Nano Banana 2"), nhưng API cần slug
 * ("nano-banana-2"). Tra bằng lowercase để chịu được viết hoa lẫn lộn.
 *
 * Nếu tên không có trong map, gửi nguyên giá trị — cho phép người dùng
 * gõ trực tiếp model ID vào dashboard mà không bị chặn.
 */

const IMAGE_MODEL_MAP: Record<string, string> = {
  "nano banana 2": "nano-banana-2",
  "nano banana 2 4k": "nano-banana-2",
  "nano banana 2 2k": "nano-banana-2",
  "nano banana 2 1k": "nano-banana-2",
  "nano banana pro": "nano-banana-pro",
  "nano banana pro 4k": "nano-banana-pro",
};

const VIDEO_MODEL_MAP: Record<string, string> = {
  "seedance 2.0": "bytedance/seedance-2",
  "seedance 2": "bytedance/seedance-2",
  "seedance2": "bytedance/seedance-2",
};

const MUSIC_MODEL_MAP: Record<string, string> = {
  "suno v5.5": "V5_5",
  "suno v5": "V5_5",
  "sunoe v5.5": "V5_5",
  "v5_5": "V5_5",
  "v5.5": "V5_5",
};

function resolve(map: Record<string, string>, displayName: string): string {
  const key = displayName.trim().toLowerCase().replace(/\s+/g, " ");
  return map[key] ?? displayName.trim();
}

export function resolveImageModelId(displayName: string): string {
  return resolve(IMAGE_MODEL_MAP, displayName);
}

export function resolveVideoModelId(displayName: string): string {
  return resolve(VIDEO_MODEL_MAP, displayName);
}

export function resolveMusicModelId(displayName: string): string {
  return resolve(MUSIC_MODEL_MAP, displayName);
}
