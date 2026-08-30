import { updateMusicSettings, isMusicGenConfigured } from "../src/config/runtime-music-settings.js";
import { updateVideoSettings, isVideoGenConfigured } from "../src/config/runtime-video-settings.js";

const key = process.argv[2] || process.env.MUSIC_GEN_API_KEY || "";

if (!key) {
  console.error("Vui long truyen key qua tham so: npx tsx scripts/setup-image-gen.ts <KEY>");
  process.exit(1);
}

const musicSettings = updateMusicSettings({
  apiKey: key,
  model: "lyria-3-clip-preview",
});

const videoSettings = updateVideoSettings({
  apiKey: key,
  model: "veo-3.0-generate-preview",
});

console.log("Music Configured:", isMusicGenConfigured(musicSettings));
console.log("Video Configured:", isVideoGenConfigured(videoSettings));
console.log("✅ Configured API Key for Music & Video successfully!");
