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
  /** Đường dẫn file đã lưu trong data/media - có sau khi persist */
  localPath?: string;
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
  const fileNote = files.length > 0 ? ` [gửi kèm ${files.length} file tài liệu: ${files.map((f) => f.fileName).join(", ")}]` : "";
  return `${msg.text}${imageNote}${fileNote}`.trim() || "[tài liệu/ảnh]";
}

const SUPPORTED_DOC_EXTS = [".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md", ".doc", ".xls"];

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

  const isDoc = SUPPORTED_DOC_EXTS.includes(ext) || targetObj.msgType === "file" || String(targetObj.type).includes("file");

  if (url && (isDoc || fileName.includes("."))) {
    return {
      fileName: fileName || `file${ext || ".docx"}`,
      url,
      fileSize,
      extension: ext || ".docx",
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
    msgId: String(data.msgId ?? ""),
    cliMsgId: String(data.cliMsgId ?? ""),
    isSelf: Boolean(message?.isSelf),
    mentionsMe,
    rawData: data,
  };
}
