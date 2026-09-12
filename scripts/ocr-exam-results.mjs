import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function decryptWith(k, p) {
  const b = Buffer.from(p, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(k, "hex"), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf-8");
}

function loadConfig() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
  const key = env.split("\n").find(l => l.startsWith("CREDENTIALS_ENCRYPTION_KEY="))?.split("=")[1]?.trim();
  if (!key) throw new Error("No CREDENTIALS_ENCRYPTION_KEY");
  const db = new DatabaseSync(path.join(ROOT, "data", "zalo-agent.db"));
  const get = k => db.prepare("SELECT value FROM runtime_settings WHERE key = ?").get(k)?.value ?? "";
  let apiKey = "", base = "", model = "";
  const vk = get("vision_sidecar_api_key"), vu = get("vision_sidecar_base_url"), vm = get("vision_sidecar_model");
  if (vk && vu) { try { apiKey = decryptWith(key, vk); base = vu; model = vm || "gemini-2.5-flash"; } catch {} }
  if (!apiKey) {
    const gk = get("google_api_key"), gu = get("google_base_url"), gm = get("google_model");
    if (gk && gu) { try { apiKey = decryptWith(key, gk); base = gu; model = gm || "gemini-2.5-flash"; } catch {} }
  }
  if (!apiKey) throw new Error("No API key");
  console.log("Config OK:", base, model);
  return { apiKey, base, model };
}

function parseJson(content) {
  // Remove markdown code fences if present
  let s = content.replace(/^```[\w]*\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
  const m = s.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

async function ocrPage(imgPath, { apiKey, base, model }) {
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const mime = imgPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const res = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 8192,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: "data:" + mime + ";base64," + b64 } },
        { type: "text", text: "This is a Vietnamese exam result table. Extract ALL rows as JSON array. Each element: {\"stt\":number,\"so_bao_danh\":string,\"ho_ten\":string,\"ngay_sinh\":string,\"don_vi\":string,\"diem_viet\":number,\"diem_trac_nghiem\":number,\"tong_diem\":number,\"ghi_chu\":string}. Return ONLY the JSON array, no other text." }
      ]}]
    })
  });
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 100));
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";
  return parseJson(content);
}

async function exportExcel(rows, outPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "vbaibot"; wb.created = new Date();
  const ws = wb.addWorksheet("Diem cao den thap", { pageSetup: { paperSize: 9, orientation: "landscape" } });
  ws.columns = [
    { header: "Hang", key: "rank", width: 7 },
    { header: "So bao danh", key: "so_bao_danh", width: 14 },
    { header: "Ho va ten", key: "ho_ten", width: 28 },
    { header: "Ngay sinh", key: "ngay_sinh", width: 13 },
    { header: "Don vi", key: "don_vi", width: 36 },
    { header: "Diem Viet", key: "diem_viet", width: 12 },
    { header: "Diem TN", key: "diem_trac_nghiem", width: 12 },
    { header: "Tong diem", key: "tong_diem", width: 13 },
    { header: "Ghi chu", key: "ghi_chu", width: 22 }
  ];
  const hdr = ws.getRow(1);
  hdr.height = 28;
  hdr.eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    c.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  rows.forEach((row, i) => {
    const r = ws.addRow({ rank: i+1, so_bao_danh: row.so_bao_danh, ho_ten: row.ho_ten,
      ngay_sinh: row.ngay_sinh, don_vi: row.don_vi, diem_viet: row.diem_viet,
      diem_trac_nghiem: row.diem_trac_nghiem, tong_diem: row.tong_diem, ghi_chu: row.ghi_chu ?? "" });
    const bg = i===0?"FFFFF176":i===1?"FFFFFFB3":i===2?"FFFFECB3":i<10?"FFFFE082":i%2===1?"FFE9EFF7":"FFFFFFFF";
    r.height = 18;
    r.eachCell((c, ci) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      c.font = { bold: i < 3 };
      c.alignment = ci >= 6 ? { horizontal: "center", vertical: "middle" } : { vertical: "middle", wrapText: true };
      c.border = { top:{style:"hair"},left:{style:"thin"},bottom:{style:"hair"},right:{style:"thin"} };
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "I" + (rows.length+1) };

  // Sheet 2 - thong ke
  const grps = {};
  for (const r of rows) {
    const p = (r.so_bao_danh ?? "").replace(/\d+$/, "") || "Khac";
    if (!grps[p]) grps[p] = [];
    grps[p].push(r);
  }
  const ws2 = wb.addWorksheet("Thong ke theo nhom");
  ws2.columns = [
    { header: "Nhom SBD", key: "group", width: 18 },
    { header: "So thi sinh", key: "count", width: 13 },
    { header: "Cao nhat", key: "max", width: 12 },
    { header: "Thap nhat", key: "min", width: 13 },
    { header: "Trung binh", key: "avg", width: 13 }
  ];
  ws2.getRow(1).eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
    c.font = { color: { argb: "FFFFFFFF" }, bold: true };
    c.alignment = { horizontal: "center" };
  });
  for (const [g, rs] of Object.entries(grps).sort()) {
    const sc = rs.map(r => r.tong_diem).filter(s => typeof s==="number" && !isNaN(s) && s>0);
    ws2.addRow({ group: g, count: rs.length,
      max: sc.length ? Math.max(...sc) : "",
      min: sc.length ? Math.min(...sc) : "",
      avg: sc.length ? +(sc.reduce((a,b)=>a+b,0)/sc.length).toFixed(2) : "" });
  }

  await wb.xlsx.writeFile(outPath);
  console.log("\nExcel saved:", outPath);
}

async function main() {
  const imgDir = path.join(ROOT, "bosung", "DS");
  const cfg = loadConfig();
  const files = fs.readdirSync(imgDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort((a,b) => {
      const na = parseInt(a.match(/Page(\d+)/i)?.[1]??"0");
      const nb = parseInt(b.match(/Page(\d+)/i)?.[1]??"0");
      return na - nb;
    });
  console.log("Found", files.length, "images");

  const all = [], seen = new Set();
  for (let i = 0; i < files.length; i++) {
    const f = files[i], imgPath = path.join(imgDir, f);
    const pg = f.match(/Page(\d+)/i)?.[1] ?? (i+1);
    process.stdout.write("  [" + (i+1) + "/" + files.length + "] P" + pg + " " + f.slice(0,40) + " ... ");
    try {
      const rows = await ocrPage(imgPath, cfg);
      let added = 0;
      for (const r of rows) {
        if (!r.so_bao_danh) continue;
        const k = String(r.so_bao_danh).trim().toUpperCase();
        if (!seen.has(k)) { seen.add(k); all.push(r); added++; }
      }
      console.log("OK", rows.length, "rows (" + added + " new)");
    } catch(e) { console.log("ERR:", e.message); }
    if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  console.log("\nTotal:", all.length, "candidates");
  const valid = all
    .filter(r => r.ho_ten && typeof r.tong_diem==="number" && !isNaN(r.tong_diem) && r.tong_diem>0)
    .sort((a,b) => b.tong_diem - a.tong_diem);
  console.log("Valid:", valid.length);

  console.log("\n=== TOP 20 ===");
  valid.slice(0,20).forEach((r,i) => {
    console.log(String(i+1).padEnd(4) + (r.so_bao_danh??"").padEnd(12) + (r.ho_ten??"").padEnd(28) + String(r.tong_diem).padStart(8));
  });

  const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,16);
  const out = path.join(ROOT, "bosung", "KetQua_DiemThi_ThamPhan2026_" + ts + ".xlsx");
  await exportExcel(valid, out);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
