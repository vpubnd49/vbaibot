import path from "node:path";
import { ThreadType } from "zca-js";
import { pickImageVariant, type ImageQuality } from "./zalo-image-variant.js";

export type IncomingImage = {
  url: string;
  /** Đường dẫn file đã lưu trong data/media (tương đối với DATA_DIR) - có sau khi persist */
  localPath?: string;
};

export type IncomingFile = {
  fileName: string;
  url?: string;
  fileSize?: number;
  extension: string;
  mimeType?: string;
  isAudio?: boolean;
  transcript?: string;
  /** Đường dẫn file đã lưu trong data/media - có sau khi persist */
  localPath?: string;
};

/** Zalo gửi thư mục (zCloud Folder) */
export type IncomingZaloFolder = {
  /** Tên thư mục, vd: "DS" */
  name: string;
  /** URL tải về (link zCloud) */
  downloadUrl?: string;
  /** Kích thước tổng (byte) */
  totalSize?: number;
  /** Số file bên trong (nếu biết) */
  fileCount?: number;
};

export type ParsedMessage = {
  accountId: string;
  threadId: string;
  threadType: ThreadType;
  isGroup: boolean;
  senderId: string;
  senderName: string;
  text: string;
  images: IncomingImage[];
  files?: IncomingFile[];
  /** Thư mục Zalo (zCloud) người dùng gửi */
  folders?: IncomingZaloFolder[];
  msgId: string;
  cliMsgId: string;
  isSelf: boolean;
  mentionsMe: boolean;
  /** data gốc của zca-js - dùng cho quote khi trả lời */
  rawData: Record<string, unknown>;
};

/**
 * Nội dung ghi vào history cho 1 tin đến.
 */
export function describeForHistory(msg: ParsedMessage): string {
  const imageNote = msg.images.length > 0 ? ` [gửi kèm ${msg.images.length} ảnh]` : "";
  const files = msg.files ?? [];
  const audioFiles = files.filter((file) => file.isAudio);
  const documentFiles = files.filter((file) => !file.isAudio);
  const audioNote = audioFiles.length > 0
    ? ` [gửi kèm ${audioFiles.length} file ghi âm: ${audioFiles.map((f) => f.fileName).join(", ")}]`
    : "";
  const fileNote = documentFiles.length > 0
    ? ` [gửi kèm ${documentFiles.length} file tài liệu: ${documentFiles.map((f) => f.fileName).join(", ")}]`
    : "";
  const folderNote = (msg.folders ?? []).length > 0
    ? ` [gửi thư mục Zalo: ${msg.folders!.map((f) => `"${f.name}"${f.totalSize ? ` (${Math.round(f.totalSize / 1024 / 1024)} MB)` : ""}`).join(", ")} — anh/chị cần gửi lại từng file ảnh hoặc nén thành ZIP để bot đọc được]`
    : "";
  return `${msg.text}${imageNote}${audioNote}${fileNote}${folderNote}`.trim() || "[tài liệu/ảnh/ghi âm]";
}

const SUPPORTED_DOC_EXTS = [
  ".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md", ".doc", ".xls",
  ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp",
  ".zip", ".ods", ".tsv", // ZIP giải nén bởi batch-ocr, ODS/TSV đọc bởi document-reader
];

const SUPPORTED_AUDIO_EXTS = [".m4a", ".mp3", ".wav", ".aac", ".ogg", ".opus", ".flac", ".amr", ".webm"];
const AUDIO_MIME_TYPES: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".flac": "audio/flac",
  ".amr": "audio/amr",
  ".webm": "audio/webm",
};

function extractFileCandidate(obj: any): IncomingFile | null {
  if (!obj) return null;
  let targetObj = obj;

  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        targetObj = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  if (Array.isArray(targetObj)) {
    for (const item of targetObj) {
      const found = extractFileCandidate(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof targetObj !== "object" || targetObj === null) return null;

  const fileName = String(
    targetObj.title ?? targetObj.fileName ?? targetObj.name ?? targetObj.filename ?? targetObj.description ?? ""
  ).trim();

  const url = String(
    targetObj.href ?? targetObj.url ?? targetObj.fileUrl ?? targetObj.link ?? targetObj.path ?? targetObj.downloadUrl ?? ""
  ).trim();

  const fileSize = typeof targetObj.size === "number" ? targetObj.size : typeof targetObj.fileSize === "number" ? targetObj.fileSize : undefined;

  const extFromFileName = fileName ? path.extname(fileName).toLowerCase() : "";
  const extFromUrl = url ? path.extname(url.split("?")[0]!).toLowerCase() : "";
  const ext = extFromFileName || extFromUrl;

  const isAudio = SUPPORTED_AUDIO_EXTS.includes(ext) || String(targetObj.mimeType ?? targetObj.contentType ?? "").toLowerCase().startsWith("audio/") || /voice|audio|record/i.test(`${targetObj.msgType ?? ""} ${targetObj.type ?? ""}`);
  const isDoc = SUPPORTED_DOC_EXTS.includes(ext) || targetObj.msgType === "file" || String(targetObj.type).includes("file");

  if (url && (isAudio || isDoc || fileName.includes("."))) {
    const resolvedExt = ext || (isAudio ? ".m4a" : ".docx");
    return {
      fileName: fileName || `file${resolvedExt}`,
      url,
      fileSize,
      extension: resolvedExt,
      mimeType: String(targetObj.mimeType ?? targetObj.contentType ?? "") || AUDIO_MIME_TYPES[resolvedExt],
      isAudio,
    };
  }

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseIncomingMessage(
  accountId: string,
  selfId: string,
  message: any,
  imageQuality: ImageQuality = "normal",
): ParsedMessage {
  const data = message?.data ?? {};
  const content = data.content;
  const msgType = String(data.msgType ?? "");

  let text = "";
  const images: IncomingImage[] = [];
  const files: IncomingFile[] = [];

  let parsedContent = content;
  if (typeof content === "string" && content.trim().startsWith("{")) {
    try {
      parsedContent = JSON.parse(content);
    } catch {
      // keep string
    }
  }

  if (typeof content === "string" && typeof parsedContent === "string") {
    text = content;
  } else if (parsedContent && typeof parsedContent === "object") {
    text = String(parsedContent.title ?? parsedContent.description ?? parsedContent.text ?? "");
    const picked = msgType.includes("photo")
      ? pickImageVariant(parsedContent as Record<string, unknown>, imageQuality)
      : null;
    if (picked) {
      images.push({ url: picked.url });
    }
  }

  // Bóc tách file đính kèm từ tất cả các vị trí trong payload
  const candidatesToScan = [
    content,
    parsedContent,
    data.attach,
    data.attachments,
    data.params,
    data.property,
    data.quote,
    data.quoteMsg,
    data.quote?.attach,
    data.quote?.content,
    data.quoteMsg?.attach,
    data.quoteMsg?.content,
  ];

  for (const item of candidatesToScan) {
    if (!item) continue;
    const f = extractFileCandidate(item);
    if (f && !files.some((x) => x.url === f.url)) {
      files.push(f);
    }
  }

  // ── Phát hiện Zalo Folder (zCloud) ──────────────────────────────────────
  // Khi user gửi cả thư mục qua Zalo, payload có:
  // - msgType chứa "folder" hoặc
  // - parsedContent.fileType === "folder" hoặc
  // - parsedContent.type === "folder"
  const folders: IncomingZaloFolder[] = [];
  const isFolder =
    msgType.toLowerCase().includes("folder") ||
    String(parsedContent?.fileType ?? "").toLowerCase() === "folder" ||
    String(parsedContent?.type ?? "").toLowerCase() === "folder" ||
    String(data.fileType ?? "").toLowerCase() === "folder" ||
    (parsedContent && typeof parsedContent === "object" && "folderId" in parsedContent);

  if (isFolder && parsedContent && typeof parsedContent === "object") {
    const pc = parsedContent as any;
    const folderName =
      String(pc.title ?? pc.name ?? pc.fileName ?? pc.folderName ?? pc.description ?? "Thư mục").trim() || "Thư mục";
    const downloadUrl =
      String(pc.href ?? pc.url ?? pc.fileUrl ?? pc.link ?? pc.downloadUrl ?? "").trim() || undefined;
    const totalSize =
      typeof pc.size === "number" ? pc.size :
      typeof pc.fileSize === "number" ? pc.fileSize :
      typeof pc.totalSize === "number" ? pc.totalSize : undefined;
    const fileCount = typeof pc.fileCount === "number" ? pc.fileCount : undefined;

    folders.push({ name: folderName, downloadUrl, totalSize, fileCount });
  }

  const mentions = Array.isArray(data.mentions) ? data.mentions : [];
  const mentionsMe = mentions.some((m: any) => String(m?.uid) === selfId);

  return {
    accountId,
    threadId: String(message?.threadId ?? ""),
    threadType: message?.type ?? ThreadType.User,
    isGroup: message?.type === ThreadType.Group,
    senderId: String(data.uidFrom ?? ""),
    senderName: String(data.dName ?? "Người dùng"),
    text,
    images,
    files,
    folders: folders.length > 0 ? folders : undefined,
    msgId: String(data.msgId ?? ""),
    cliMsgId: String(data.cliMsgId ?? ""),
    isSelf: Boolean(message?.isSelf),
    mentionsMe,
    rawData: data,
  };
}
