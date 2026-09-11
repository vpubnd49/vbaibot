import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { once } from "node:events";
import type { Archiver } from "archiver";

type ArchiverModule = { ZipArchive: new (options: { zlib: { level: number } }) => Archiver };

const require = createRequire(import.meta.url);
const archiverModule = require("archiver") as ArchiverModule;

export type QpplArchiveEntry = {
  filePath: string;
  entryName: string;
};

export type QpplArchiveManifestRow = {
  documentId: number;
  soKyHieu: string;
  loaiVanBan: string;
  ngayBanHanh: string;
  trichYeu: string;
  fileName: string;
  entryName: string;
  status: "downloaded" | "failed";
  error?: string;
};

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function safeEntryName(name: string): string {
  return name
    .replace(/^[a-zA-Z]:[\\/]+/, "")
    .replace(/\.\.(?:[\\/]|$)/g, "")
    .replace(/[\\/]+/g, "/")
    .replace(/^\/+/, "") || "file";
}

export async function createQpplArchive(
  outputPath: string,
  entries: QpplArchiveEntry[],
  manifest: QpplArchiveManifestRow[],
): Promise<{ path: string; bytes: number }> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const output = fs.createWriteStream(outputPath);
  const archive = new archiverModule.ZipArchive({ zlib: { level: 6 } });
  const errorPromise = new Promise<never>((_, reject) => {
    output.once("error", reject);
    archive.once("error", reject);
  });
  archive.pipe(output);

  for (const entry of entries) {
    if (!fs.existsSync(entry.filePath)) continue;
    archive.file(entry.filePath, { name: safeEntryName(entry.entryName) });
  }

  const manifestHeader = ["documentId", "soKyHieu", "loaiVanBan", "ngayBanHanh", "trichYeu", "fileName", "entryName", "status", "error"];
  const manifestCsv = [
    manifestHeader,
    ...manifest.map((row) => [row.documentId, row.soKyHieu, row.loaiVanBan, row.ngayBanHanh, row.trichYeu, row.fileName, row.entryName, row.status, row.error ?? ""]),
  ].map((row) => row.map((value) => csvCell(value)).join(",")).join("\r\n") + "\r\n";
  archive.append("\uFEFF" + manifestCsv, { name: "MANIFEST.csv" });
  await archive.finalize();
  await Promise.race([once(output, "close"), errorPromise]);
  return { path: outputPath, bytes: fs.statSync(outputPath).size };
}
