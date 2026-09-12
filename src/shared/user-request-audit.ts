export type AuditMessage = {
  text: string;
  imageCount: number;
  files?: readonly { isAudio?: boolean }[];
  isGroup: boolean;
};

export type UserRequestAuditEvent = {
  auditSchema: 1;
  auditEvent: "user_request_received" | "user_request_dropped";
  requestSource: "zalo-user" | "scheduled" | "dashboard" | "internal";
  messageCount: number;
  textChars: number;
  imageCount: number;
  fileCount: number;
  audioCount: number;
  documentCount: number;
  hasText: boolean;
  hasImages: boolean;
  hasFiles: boolean;
  isGroup: boolean;
  batch: boolean;
  dropReason?: "queue_full";
};

/**
 * Dựng event audit bằng allowlist cố định. Không nhận ParsedMessage trực tiếp
 * để tránh vô tình ghi senderId, tên người dùng, URL, path, rawData hoặc text.
 */
export function toUserRequestAuditEvent(
  messages: readonly AuditMessage[],
  options: {
    event?: UserRequestAuditEvent["auditEvent"];
    source?: UserRequestAuditEvent["requestSource"];
    dropReason?: UserRequestAuditEvent["dropReason"];
  } = {},
): UserRequestAuditEvent {
  const files = messages.flatMap((message) => message.files ?? []);
  const textChars = messages.reduce((total, message) => total + message.text.length, 0);
  const imageCount = messages.reduce((total, message) => total + message.imageCount, 0);
  const audioCount = files.filter((file) => file.isAudio === true).length;
  const event: UserRequestAuditEvent = {
    auditSchema: 1,
    auditEvent: options.event ?? "user_request_received",
    requestSource: options.source ?? "zalo-user",
    messageCount: messages.length,
    textChars,
    imageCount,
    fileCount: files.length,
    audioCount,
    documentCount: files.length - audioCount,
    hasText: textChars > 0,
    hasImages: imageCount > 0,
    hasFiles: files.length > 0,
    isGroup: messages.some((message) => message.isGroup),
    batch: messages.length > 1,
  };
  if (options.dropReason) event.dropReason = options.dropReason;
  return event;
}

/** Contract runtime: audit event tuyệt đối không được chứa raw request. */
export function assertSafeUserRequestAudit(event: UserRequestAuditEvent): void {
  const allowed = new Set([
    "auditSchema", "auditEvent", "requestSource", "messageCount", "textChars",
    "imageCount", "fileCount", "audioCount", "documentCount", "hasText",
    "hasImages", "hasFiles", "isGroup", "batch", "dropReason",
  ]);
  for (const key of Object.keys(event)) {
    if (!allowed.has(key)) throw new Error(`Unexpected audit field: ${key}`);
  }
  if (event.auditSchema !== 1) throw new Error("Unsupported audit schema");
  if (!Number.isInteger(event.messageCount) || event.messageCount < 0) throw new Error("Invalid messageCount");
  if (!Number.isInteger(event.textChars) || event.textChars < 0) throw new Error("Invalid textChars");
  if (event.auditEvent === "user_request_dropped" && event.dropReason !== "queue_full") {
    throw new Error("Dropped request must include dropReason");
  }
}
