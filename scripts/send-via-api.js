import fs from "node:fs";
import path from "node:path";

async function main() {
  const envPath = path.resolve("./.env");
  const envText = fs.readFileSync(envPath, "utf8");
  const match = envText.match(/CREDENTIALS_ENCRYPTION_KEY=([a-f0-9]+)/);
  const secret = match ? match[1] : "";

  const filePath = path.resolve("./Thong_bao_ket_luan_cuoc_hop_UBND_Thao_go_kho_khan_du_an.docx");
  if (!fs.existsSync(filePath)) {
    console.error("File docx không tồn tại:", filePath);
    process.exit(1);
  }

  console.log("Đang gửi file qua internal broadcast API:", filePath);
  const res = await fetch("http://127.0.0.1:3900/api/broadcast/send-file", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({
      accountId: "acc-0984310011",
      threadId: "1049933544839800796",
      filePath,
      caption: "📄 Văn bản: Thông báo Kết luận của Lãnh đạo UBND tỉnh về tháo gỡ khó khăn các dự án và triển khai nhiệm vụ trọng tâm (Chuẩn NĐ 30/2020/NĐ-CP)",
    }),
  });

  const text = await res.text();
  console.log("Kết quả gửi:", res.status, text);
}

main().catch(console.error);
