const fs = require('fs');
const path = require('path');

const corpus = JSON.parse(fs.readFileSync('src/knowledge/noi-chinh-corpus.json', 'utf8'));

// Group by primary category
const catMap = new Map();

for (const doc of corpus) {
  let cat = doc.category || 'VĂN PHÒNG & NỘI BỘ';
  // Normalize single root files
  if (cat.endsWith('.doc') || cat.endsWith('.docx') || cat.endsWith('.xlsx')) {
    cat = 'MẪU HÀNH CHÍNH NỘI BỘ VĂN PHÒNG';
  }
  if (!catMap.has(cat)) catMap.set(cat, []);
  catMap.get(cat).push(doc);
}

console.log(`Aggregated categories: ${catMap.size}`);

// Helper to clean and format doc text
function extractKeyParts(text) {
  if (!text) return { header: '', trichYeu: '', canCu: [], noiDung: '', noiNhan: '' };
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let header = lines.slice(0, 10).join('\n');
  let trichYeu = '';
  let canCu = [];
  let noiDung = '';
  let noiNhan = '';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.toLowerCase().startsWith('v/v') || l.toLowerCase().startsWith('về việc')) {
      trichYeu = l;
    }
    if (l.toLowerCase().startsWith('căn cứ') || l.toLowerCase().startsWith('xét đề nghị')) {
      canCu.push(l);
    }
    if (l.toLowerCase().startsWith('nơi nhận:') || l.toLowerCase().startsWith('nơi nhận')) {
      noiNhan = lines.slice(i, i + 15).join('\n');
    }
  }

  // Get sample body
  noiDung = lines.slice(Math.min(10, lines.length), Math.min(40, lines.length)).join('\n');

  return { header, trichYeu, canCu, noiDung, noiNhan };
}

// Build markdown
let md = `# CẨM NANG TOÀN BỘ CÁC MẪU VĂN BẢN HÀNH CHÍNH THỰC TẾ - PHÒNG NỘI CHÍNH
*(Trích xuất và chuẩn hóa từ toàn bộ 3.553 tài liệu lưu trữ thực tế tại E:\\OneDrive\\HSCV\\NỘI CHÍNH)*

---

## 📌 QUY TẮC BẮT BUỘC KHI ÁP DỤNG MẪU NỘI CHÍNH (NĐ 30/2020/NĐ-CP)
1. **Nơi nhận**: Tuyệt đối **KHÔNG ĐƯỢC DÙNG** cụm từ \`Như kính gửi\`. Phải bắt đầu bằng:
   \`\`\`text
   Nơi nhận:
   - Như trên;
   - Chủ tịch, các PCT UBND tỉnh;
   - ...
   - CVP, các PCVP;
   - Lưu: VT, NC (hoặc phòng chuyên môn).
   \`\`\`
   *(Mỗi mục kết thúc bằng dấu chấm phẩy \`;\`, mục cuối cùng kết thúc bằng dấu chấm \`.\`)*.
2. **Căn cứ pháp lý**: Trình bày bằng chữ in nghiêng, cỡ chữ 13-14, kết thúc bằng dấu chấm phẩy \`;\`, căn cứ cuối cùng kết thúc bằng dấu phẩy \`,\` kèm theo \`xét đề nghị của...\`.
3. **Thẩm quyền ký**:
   - UBND tỉnh: \`TM. ỦY BAN NHÂN DÂN / KT. CHỦ TỊCH / PHÓ CHỦ TỊCH\` hoặc \`CHỦ TỊCH\`.
   - Văn phòng UBND tỉnh: \`TL. CHỦ TỊCH / KT. CHÁNH VĂN PHÒNG / PHÓ CHÁNH VĂN PHÒNG\` hoặc \`CHÁNH VĂN PHÒNG\`.
   - Phiếu trình: Chuyên viên tham mưu ký ghi rõ họ tên, Lãnh đạo Phòng duyệt, Lãnh đạo Văn phòng phê duyệt, Lãnh đạo UBND tỉnh chỉ đạo.

---

`;

let catIndex = 1;
for (const [catName, docs] of catMap.entries()) {
  md += `## PHẦN ${catIndex}: LĨNH VỰC ${catName.toUpperCase()} (${docs.length} TÀI LIỆU)\n\n`;
  
  // Find top 2-3 longest/most representative documents in this category
  const sortedDocs = [...docs].sort((a, b) => (b.text || '').length - (a.text || '').length);
  const sampleDocs = sortedDocs.slice(0, 2);

  for (let sIdx = 0; sIdx < sampleDocs.length; sIdx++) {
    const doc = sampleDocs[sIdx];
    const keyParts = extractKeyParts(doc.text);
    
    md += `### ${catIndex}.${sIdx + 1}. Mẫu văn bản: ${doc.title || doc.filename}\n`;
    md += `- **Tập tin gốc**: \`${doc.filename}\`\n`;
    md += `- **Loại hình**: ${doc.type || 'Văn bản hành chính'}\n\n`;
    
    md += `#### Cấu trúc và nội dung mẫu thực tế:\n`;
    md += `\`\`\`text\n`;
    // Clean text sample
    const sampleSnippet = (doc.text || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 45)
      .join('\n');
    md += sampleSnippet + '\n';
    md += `\`\`\`\n\n`;

    if (keyParts.canCu.length > 0) {
      md += `#### Căn cứ pháp lý đặc thù:\n`;
      keyParts.canCu.slice(0, 5).forEach(c => {
        md += `- ${c}\n`;
      });
      md += `\n`;
    }

    md += `#### Chuẩn hóa thể thức tham mưu theo NĐ 30:\n`;
    md += `- **Cơ quan ban hành**: ỦY BAN NHÂN DÂN TỈNH (hoặc VĂN PHÒNG UBND TỈNH)\n`;
    md += `- **Ký hiệu**: .../UBND-NC hoặc .../VP-NC\n`;
    md += `- **Nơi nhận chuẩn**:\n`;
    md += `\`\`\`text\n`;
    md += `Nơi nhận:\n`;
    md += `- Như trên;\n`;
    md += `- Chủ tịch, các PCT UBND tỉnh;\n`;
    md += `- Lãnh đạo VP UBND tỉnh;\n`;
    md += `- Phòng NC, các phòng liên quan;\n`;
    md += `- Lưu: VT, NC.\n`;
    md += `\`\`\`\n\n`;
    md += `---\n\n`;
  }

  catIndex++;
}

const outputPath = path.resolve('.agents/skills/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md');
fs.writeFileSync(outputPath, md, 'utf8');
console.log(`Successfully generated ${outputPath} (${md.length} chars)`);
