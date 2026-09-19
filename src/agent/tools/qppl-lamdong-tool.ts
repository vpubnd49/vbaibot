import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { searchQpplDocs, getQpplDocById, countQpplDocs } from "../../qppl/qppl-store.js";
import { getQpplStorageDir, syncQpplDocuments, downloadAllFilesForDoc, liveSearchAndUpsert, liveSearchByDateRange } from "../../qppl/qppl-service.js";
import type { QpplDownloadResult } from "../../qppl/qppl-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";
import type { QpplDoc, QpplFileLink, QpplNguon } from "../../qppl/qppl-types.js";
import { resolveAgency, getAgencyConfig } from "../../qppl/qppl-registry.js";
import { createQpplArchive } from "../../qppl/qppl-archive.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("qppl-lamdong-tool");

function parseFileLinks(fileUrls: string): QpplFileLink[] {
  try {
    const parsed: unknown = JSON.parse(fileUrls);
    return Array.isArray(parsed) ? parsed as QpplFileLink[] : [];
  } catch {
    return [];
  }
}

export function createQpplLamdongTool({ api, account, message, ghiNhanDaGui }: ToolContext) {
  return tool({
    description:
      "BẮT BUỘC GỌI TOOL NÀY khi người dùng yêu cầu tra cứu, tìm kiếm hoặc TẢI FILE văn bản chỉ đạo điều hành, " +
      "báo cáo, quyết định, công văn, kế hoạch của UBND Tỉnh, HĐND Tỉnh hoặc BẤT KỲ SỞ BAN NGÀNH, ĐỊA PHƯƠNG CỦA LÂM ĐỒNG " +
      "(Sở Tư pháp, Sở Tài chính, Sở Giáo dục & Đào tạo, Sở Nội vụ, Thanh tra tỉnh, UBND huyện Đức Trọng, Di Linh, Đạ Tẻh, TP. Đà Lạt...). " +
      "Khi người dùng hỏi báo cáo/văn bản của ngành hoặc huyện nào, LUÔN truyền 'coQuan' tương ứng để tìm chính xác tại nguồn đó. " +
      "KHI NGƯỜI DÙNG YÊU CẦU TẢI FILE (VD: 'tải quyết định 4480', 'tải kế hoạch 15187', 'gửi file...'): " +
      "BẮT BUỘC đặt sendFileToChat=true và keyword là số hiệu văn bản để tool tải toàn bộ file đính kèm gửi thẳng vào chat.",
    inputSchema: z.object({
      action: z
        .enum(["search", "get", "sync"])
        .default("search")
        .describe(
          "Hành động: 'search' tìm kiếm, 'get' xem chi tiết/tải file theo ID, 'sync' quét cập nhật mới",
        ),
      keyword: z
        .string()
        .optional()
        .describe(
          "Từ khóa tìm kiếm: số ký hiệu (VD: '4496/QĐ-UBND'), trích yếu, tên văn bản, lĩnh vực, hoặc 'mới nhất'",
        ),
      coQuan: z
        .string()
        .optional()
        .describe(
          "Tên cơ quan, Sở ban ngành hoặc huyện/thành phố để tra cứu đích danh (VD: 'Sở Tư pháp', 'Sở Tài chính', 'Sở Giáo dục', 'Đức Trọng', 'UBND tỉnh'...). Hệ thống sẽ tự động đối chiếu và quét đúng cơ quan tương ứng.",
        ),
      loaiVanBan: z
        .string()
        .optional()
        .describe(
          "Lọc theo loại VB: 'Công văn', 'Quyết định', 'Nghị quyết', 'Chỉ thị', 'Báo cáo', 'Tờ trình'",
        ),
      nguon: z
        .string()
        .optional()
        .describe("Mã nguồn cơ quan nếu biết (VD: 'ubnd', 'hdnd', 'stp', 'stc', 'snv', 'ductrong', 'sgd_edu'...)"),
      docId: z
        .number()
        .optional()
        .describe("ID văn bản (dùng cho action 'get')"),
      dateFrom: z
        .string()
        .optional()
        .describe(
          "Ngày bắt đầu ISO (VD: '2026-01-01'). Dùng để lọc VB theo khoảng thời gian. " +
          "Ví dụ: tháng 1/2026 → dateFrom='2026-01-01', dateTo='2026-02-01'",
        ),
      dateTo: z
        .string()
        .optional()
        .describe(
          "Ngày kết thúc ISO (VD: '2026-02-01'). Kết hợp dateFrom. " +
          "Ví dụ: 6 tháng đầu 2026 → dateFrom='2026-01-01', dateTo='2026-07-01'",
        ),
      sendFileToChat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true, tải file PDF/DOC và gửi thẳng vào chat cho người dùng"),
      archiveFiles: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true cùng sendFileToChat, gom toàn bộ file thành một ZIP kèm MANIFEST.csv rồi gửi một lần"),
      maxSendDocs: z
        .number()
        .optional()
        .default(1)
        .describe(
          "Số VB tối đa gửi file vào chat (mặc định 1 = chỉ VB đầu tiên/mới nhất). " +
          "Đặt >1 khi user yêu cầu 'tất cả', 'mấy cái', 'các VB' — VD: 'gửi tất cả báo cáo CCHC' → maxSendDocs=10.",
        ),
    }),
    execute: async ({ action, keyword, coQuan, loaiVanBan, nguon, docId, dateFrom, dateTo, sendFileToChat, archiveFiles, maxSendDocs }) => {
      // 1. Phân giải targetNguon từ coQuan, nguon hoặc keyword
      let targetNguon: QpplNguon | undefined = undefined;
      if (coQuan) {
        const ag = resolveAgency(coQuan);
        if (ag) targetNguon = ag.code;
      }
      if (!targetNguon && nguon) {
        const ag = resolveAgency(nguon);
        targetNguon = ag ? ag.code : (nguon as QpplNguon);
      }
      if (!targetNguon && keyword) {
        const ag = resolveAgency(keyword);
        if (ag && ag.code !== "ubnd") {
          targetNguon = ag.code;
        }
      }

      // === SYNC ===
      if (action === "sync") {
        const target = targetNguon || "ubnd";
        const syncRes = await syncQpplDocuments(target, 200);
        const agConfig = getAgencyConfig(target);
        return (
          `Đã đồng bộ văn bản (nguồn: ${agConfig?.name || target.toUpperCase()}): ` +
          `Quét ${syncRes.totalScanned} mục, cập nhật ${syncRes.updated} mục. ` +
          `Tổng: ${countQpplDocs(target)} văn bản trong kho.`
        );
      }

      const sendArchive = async (
        docsToArchive: QpplDoc[],
        results: Array<{ doc: QpplDoc; download: QpplDownloadResult }>,
      ): Promise<string> => {
        const archiveEntries = results.flatMap(({ doc, download }) =>
          download.downloaded.map((filePath) => ({
            filePath,
            entryName: `${doc.ngayBanHanh?.slice(0, 4) || "unknown"}/${doc.soKyHieu.replace(/[\\/:*?"<>|]/g, "-")}/${path.basename(filePath)}`,
          })),
        );
        const manifest = results.flatMap(({ doc, download }) => {
          const links = parseFileLinks(doc.fileUrls);
          const rows = links.map((link) => {
            const localFile = download.downloaded.find((filePath) => path.basename(filePath).includes(path.basename(link.name)));
            return {
              documentId: doc.id,
              soKyHieu: doc.soKyHieu,
              loaiVanBan: doc.loaiVanBan,
              ngayBanHanh: doc.ngayBanHanh,
              trichYeu: doc.trichYeu,
              fileName: link.name,
              entryName: localFile ? path.basename(localFile) : "",
              status: localFile ? "downloaded" as const : "failed" as const,
              error: download.failed.find((failed) => failed.name === link.name)?.error,
            };
          });
          return rows.length > 0 ? rows : [{
            documentId: doc.id,
            soKyHieu: doc.soKyHieu,
            loaiVanBan: doc.loaiVanBan,
            ngayBanHanh: doc.ngayBanHanh,
            trichYeu: doc.trichYeu,
            fileName: "",
            entryName: "",
            status: "failed" as const,
            error: "Không có file tải thành công",
          }];
        });
        const archivePath = path.join(getQpplStorageDir(), `QPPL_${Date.now()}_${docsToArchive.length}VB.zip`);
        try {
          const archive = await createQpplArchive(archivePath, archiveEntries, manifest);
          const sentCaption = `QPPL Lâm Đồng: ${docsToArchive.length} văn bản, ${archiveEntries.length} file; kèm MANIFEST.csv`;
          await guiFileKemCaption(
            api,
            `${account.id}:${message.threadId}`,
            message.threadId,
            message.threadType,
            archive.path,
            sentCaption,
          );
          ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(archive.path), "ZIP QPPL"));
          const failed = results.reduce((sum, item) => sum + item.download.failed.length, 0);
          return `\n\n✅ ĐÃ GỬI 1 FILE ZIP (${Math.round(archive.bytes / 1024)} KB), gồm ${archiveEntries.length} file từ ${docsToArchive.length} văn bản.\n` +
            (failed > 0 ? `⚠️ MANIFEST.csv ghi nhận ${failed} file chưa tải được; không được nói là đã đủ toàn bộ.` : "Đã tải đủ các file đã phát hiện.");
        } finally {
          try { fs.unlinkSync(archivePath); } catch { /* archive đã được gửi hoặc tạo thất bại */ }
        }
      };

      // === GET (chi tiết + tải file) ===
      if (action === "get" && docId) {
        const doc = getQpplDocById(docId);
        if (!doc) return `Không tìm thấy văn bản QPPL có ID #${docId}.`;

        let sendNote = "";
        if (sendFileToChat) {
          // Tải TẤT CẢ file đính kèm
          const dl = await downloadAllFilesForDoc(docId);
          if (archiveFiles) {
            sendNote = await sendArchive([doc], [{ doc, download: dl }]);
          }
          const allPaths = dl.downloaded;

          if (allPaths.length > 0 && !archiveFiles) {
            const sentNames: string[] = [];
            const failedSends: string[] = [];
            for (const absPath of allPaths) {
              const fileName = path.basename(absPath);
              const caption = `VB ${doc.loaiVanBan}: ${doc.soKyHieu}\n📎 ${fileName}`;
              try {
                await guiFileKemCaption(
                  api,
                  `${account.id}:${message.threadId}`,
                  message.threadId,
                  message.threadType,
                  absPath,
                  caption,
                );
                sentNames.push(fileName);
              } catch (err) {
                failedSends.push(fileName);
                log.warn({ err, docId, file: fileName }, "Gửi file VB thất bại");
              }
            }
            if (sentNames.length > 0) {
              ghiNhanDaGui?.(ghiChuDaGuiFile(sentNames.join(", "), `VB ${doc.soKyHieu}`));
            }
            sendNote =
              `\n\n✅ ĐÃ GỬI ${sentNames.length}/${dl.expected} FILE TRỰC TIẾP VÀO CHAT. Model KHÔNG cần gọi thêm send_file.`;
            if (failedSends.length > 0) {
              sendNote +=
                `\n⚠️ ${failedSends.length} file gửi KHÔNG thành công (KHÔNG được nói đã gửi đủ): ${failedSends.join(", ")}`;
            }
            if (dl.failed.length > 0) {
              sendNote +=
                `\n⚠️ ${dl.failed.length} file tải từ cổng tỉnh thất bại: ${dl.failed.map((f) => f.name).join(", ")}`;
            }
          } else if (!archiveFiles) {
            // Không có file → cung cấp link trực tuyến
            let fileLinks: QpplFileLink[] = [];
            try { fileLinks = JSON.parse(doc.fileUrls) as QpplFileLink[]; } catch { /* empty */ }
            if (fileLinks.length > 0) {
              sendNote =
                "\n\n⚠️ Không tải được file về máy. Link tải trực tuyến:\n" +
                fileLinks.map((f) => `- ${f.name}: ${f.url}`).join("\n");
            } else {
              sendNote = "\n\n⚠️ Văn bản này không có file đính kèm trên cổng tỉnh.";
            }
          }
        }

        let fileLinks: QpplFileLink[] = [];
        try { fileLinks = JSON.parse(doc.fileUrls) as QpplFileLink[]; } catch { /* empty */ }

        return (
          `📄 **CHI TIẾT VĂN BẢN (ID #${doc.id})**\n` +
          `- **Số/Ký hiệu**: ${doc.soKyHieu}\n` +
          `- **Loại VB**: ${doc.loaiVanBan || "N/A"}\n` +
          `- **Trích yếu**: ${doc.trichYeu || "N/A"}\n` +
          `- **Cơ quan**: ${doc.coQuanBanHanh || "N/A"}\n` +
          `- **Ngày ban hành**: ${doc.ngayBanHanh ? doc.ngayBanHanh.slice(0, 10) : "N/A"}\n` +
          `- **Hiệu lực**: ${doc.hieuLuc}\n` +
          `- **Nguồn**: ${doc.nguon.toUpperCase()}\n` +
          `- **File đính kèm**: ${fileLinks.length > 0 ? fileLinks.map((f) => f.name).join(", ") : "Không có"}\n` +
          `- **Lưu trữ**: ${doc.localPath ? `Đã tải (${Math.round(doc.fileSize / 1024)} KB)` : "Chưa tải"}` +
          sendNote
        );
      }

      // === SEARCH (mặc định) ===
      // Lấy nhiều kết quả để không bỏ sót văn bản khi người dùng yêu cầu tải hết
      let docs = searchQpplDocs({
        keyword,
        loaiVanBan,
        nguon: targetNguon,
        dateFrom,
        dateTo,
        limit: 50,
      });

      // Nếu kho rỗng cho nguồn này (lần đầu), auto-sync rồi tìm lại
      if (docs.length === 0 && countQpplDocs(targetNguon) === 0) {
        if (targetNguon) {
          await syncQpplDocuments(targetNguon, 100);
        } else {
          await syncQpplDocuments("ubnd", 100);
          await syncQpplDocuments("hdnd", 50);
        }
        docs = searchQpplDocs({ keyword, loaiVanBan, nguon: targetNguon, dateFrom, dateTo, limit: 50 });
      }

      // Fallback 1: nếu có dateFrom/dateTo → tra API theo khoảng ngày
      if (docs.length === 0 && dateFrom && dateTo) {
        docs = await liveSearchByDateRange({ dateFrom, dateTo, keyword, loaiVanBan, targetNguon, limit: 30 });
      }

      // Fallback 2: local DB không có + không có dateRange → tra cứu live bằng keyword
      if (docs.length === 0 && keyword) {
        docs = await liveSearchAndUpsert(keyword, 30, targetNguon);
        // Nếu tìm được bằng keyword nhưng có dateFrom/dateTo → lọc lại theo ngày
        if (dateFrom || dateTo) {
          docs = docs.filter((d) => {
            const date = d.ngayBanHanh?.slice(0, 10) ?? "";
            if (dateFrom && date < dateFrom) return false;
            if (dateTo && date >= dateTo) return false;
            return true;
          });
        }
      }

      // Không được lấy văn bản mới nhất khi người dùng yêu cầu tải theo số hiệu:
      // fallback này có thể gửi nhầm một văn bản khác nhưng vẫn mang file hợp lệ.
      const hasExplicitNumber = /\b\d+\s*\/\s*[A-ZĐÀ-Ỹ0-9][A-ZĐÀ-Ỹ0-9-]*\b/i.test(keyword || "");
      // Fallback 3: chỉ dùng cho yêu cầu thật sự là "mới nhất", không có số hiệu cụ thể.
      if (docs.length === 0 && targetNguon && !hasExplicitNumber) {
        docs = await liveSearchAndUpsert("", 30, targetNguon);
        if (loaiVanBan) {
          const lvbLower = loaiVanBan.toLowerCase();
          const filtered = docs.filter((d) => d.loaiVanBan.toLowerCase().includes(lvbLower));
          if (filtered.length > 0) docs = filtered;
        }
      }

      if (docs.length === 0) {
        const agencyName = targetNguon ? (getAgencyConfig(targetNguon)?.name || targetNguon) : "Lâm Đồng";
        return (
          `Không tìm thấy văn bản nào của ${agencyName} phù hợp với "${keyword || ""}". ` +
          `Thử từ khóa rộng hơn (VD: số hiệu, loại VB, năm ban hành).`
        );
      }

      // Gửi file nếu được yêu cầu
      let sendStatusNote = "";
      if (sendFileToChat && docs.length > 0) {
        // Loại trùng soKyHieu (cùng VB có thể xuất hiện nhiều lần từ search)
        const seen = new Set<string>();
        let uniqueDocs = docs.filter((d) => {
          if (seen.has(d.soKyHieu)) return false;
          seen.add(d.soKyHieu);
          return true;
        });

        // Smart post-filter: khi dateFrom/dateTo là đúng 1 tháng, loại VB có
        // trích yếu nhắc tháng KHÁC (VD: user hỏi tháng 8, trích yếu ghi "tháng 7")
        if (dateFrom && dateTo && uniqueDocs.length > 1) {
          const dfDate = new Date(dateFrom);
          const dtDate = new Date(dateTo);
          const diffMonths =
            (dtDate.getFullYear() - dfDate.getFullYear()) * 12 +
            (dtDate.getMonth() - dfDate.getMonth());

          // Chỉ áp dụng khi khoảng thời gian <= 1 tháng
          if (diffMonths <= 1) {
            const requestedMonth = dfDate.getMonth() + 1; // 1-12

            // Danh sách tháng khác để loại trừ
            const otherMonthPatterns: RegExp[] = [];
            for (let m = 1; m <= 12; m++) {
              if (m === requestedMonth) continue;
              // Khớp các dạng: "tháng 7", "tháng 07", "thang 7", "T7", "T07"
              // Cẩn thận không match "tháng 7.2026" khi year khác
              otherMonthPatterns.push(
                new RegExp(`(?:tháng|thang|tháng\\s)\\s*0?${m}(?:\\b|[./])`, "i"),
              );
            }

            const filtered = uniqueDocs.filter((d) => {
              const text = `${d.trichYeu} ${d.soKyHieu}`;
              // Nếu VB nhắc tháng KHÁC VÀ KHÔNG nhắc tháng đúng → loại
              const mentionsOther = otherMonthPatterns.some((re) => re.test(text));
              const mentionsRequested = new RegExp(
                `(?:tháng|thang)\\s*0?${requestedMonth}(?:\\b|[./])`, "i",
              ).test(text);
              if (mentionsOther && !mentionsRequested) return false;
              return true;
            });

            // Chỉ áp dụng nếu sau khi lọc vẫn còn kết quả
            if (filtered.length > 0) {
              uniqueDocs = filtered;
            }
          }
        }

        // Giới hạn số VB gửi file: mặc định 1 (chỉ VB mới nhất).
        // User nói "tất cả" → model đặt maxSendDocs > 1.
        const toSend = uniqueDocs.slice(0, maxSendDocs);
        const sentFiles: string[] = [];
        const failedFiles: string[] = [];
        let totalFilesSent = 0;
        if (archiveFiles) {
          const archiveResults: Array<{ doc: QpplDoc; download: QpplDownloadResult }> = [];
          for (const targetDoc of toSend) {
            archiveResults.push({ doc: targetDoc, download: await downloadAllFilesForDoc(targetDoc.id) });
          }
          sendStatusNote = await sendArchive(toSend, archiveResults);
        } else for (const targetDoc of toSend) {
          const dl = await downloadAllFilesForDoc(targetDoc.id);
          const allPaths = dl.downloaded;
          const sentNamesForDoc: string[] = [];
          for (const absPath of allPaths) {
            const fileName = path.basename(absPath);
            try {
              await guiFileKemCaption(
                api,
                `${account.id}:${message.threadId}`,
                message.threadId,
                message.threadType,
                absPath,
                undefined,
              );
              totalFilesSent++;
              sentNamesForDoc.push(fileName);
            } catch (err) {
              failedFiles.push(`${targetDoc.soKyHieu} — ${fileName}`);
              log.warn({ err, docId: targetDoc.id, file: fileName }, "Gửi file VB thất bại");
            }
          }
          if (sentNamesForDoc.length > 0) {
            ghiNhanDaGui?.(ghiChuDaGuiFile(
              sentNamesForDoc.join(", "),
              `VB ${targetDoc.soKyHieu}`,
            ));
            sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (${sentNamesForDoc.length}/${dl.expected} file)`);
            if (dl.failed.length > 0) {
              failedFiles.push(...dl.failed.map((f) => `${targetDoc.soKyHieu} — ${f.name} (lỗi tải)`));
            }
          } else if (allPaths.length === 0) {
            if (dl.failed.length > 0) {
              failedFiles.push(...dl.failed.map((f) => `${targetDoc.soKyHieu} — ${f.name} (lỗi tải)`));
            }
            sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (0/${dl.expected} file)`);
          }
        }
        if (totalFilesSent > 0) {
          sendStatusNote =
            `\n\n✅ ĐÃ GỬI ${totalFilesSent} FILE TỪ ${sentFiles.length} VĂN BẢN VÀO CHAT:\n` +
            sentFiles.map((f) => `- ${f}`).join("\n");
          if (failedFiles.length > 0) {
            sendStatusNote +=
              `\n\n⚠️ ${failedFiles.length} file gửi KHÔNG thành công (model KHÔNG được nói là đã gửi đủ):\n` +
              failedFiles.map((f) => `- ${f}`).join("\n");
          }
          sendStatusNote += "\nModel KHÔNG cần gọi thêm send_file.";
        } else {
          sendStatusNote =
            "\n\n⚠️ KHÔNG gửi được file nào vào chat (tải/gửi thất bại toàn bộ). " +
            "Model KHÔNG được nói là đã gửi file; phải thông báo lỗi cho người dùng và đề xuất cách khác (VD: gửi link trực tuyến).";
        }
      }

      const lines = docs.map((d, idx) => {
        const dateStr = d.ngayBanHanh ? d.ngayBanHanh.slice(0, 10) : "";
        let fileLinks: QpplFileLink[] = [];
        try { fileLinks = JSON.parse(d.fileUrls) as QpplFileLink[]; } catch { /* empty */ }
        const fileStatus = d.localPath
          ? `[File sẵn sàng - ${Math.round(d.fileSize / 1024)} KB]`
          : fileLinks.length > 0
            ? `[Có ${fileLinks.length} file trực tuyến]`
            : "[Không có file]";
        const coQuanHienThi = d.coQuanBanHanh || (getAgencyConfig(d.nguon as QpplNguon)?.name ?? d.nguon.toUpperCase());
        return (
          `${idx + 1}. **[ID #${d.id}]** ${d.soKyHieu}\n` +
          `   - ${d.loaiVanBan} | ${dateStr} | CQ: ${coQuanHienThi} | ${d.hieuLuc}\n` +
          `   - ${d.trichYeu.slice(0, 120)}${d.trichYeu.length > 120 ? "..." : ""}\n` +
          `   - ${fileStatus}`
        );
      });

      const agencyInfo = targetNguon ? getAgencyConfig(targetNguon) : undefined;
      const titleHeader = agencyInfo ? agencyInfo.name.toUpperCase() : "TỈNH LÂM ĐỒNG (UBND, SỞ NGÀNH, ĐỊA PHƯƠNG)";

      return (
        `🔍 **DANH SÁCH VĂN BẢN CHỈ ĐẠO & ĐIỀU HÀNH [${titleHeader}]** (Tìm: "${keyword || "Mới nhất"}"):\n\n` +
        lines.join("\n\n") +
        sendStatusNote +
        `\n\n*(Mẹo: Nhắn "tải file VB số [ký hiệu]" hoặc chỉ ID cụ thể để bot gửi file.)*`
      );
    },
  });
}
