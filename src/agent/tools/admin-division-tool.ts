import { tool } from 'ai';
import { z } from 'zod';
import { searchAdministrativeUnit, getStats } from '../../legal/services/admin-division-service.js';

export function createAdminDivisionTool() {
  return tool({
    description: 'Tra cứu đơn vị hành chính 34 tỉnh/thành phố theo mô hình 2 cấp (Luật 72/2025/QH15): Tỉnh → Xã/Phường/Đặc khu. KHÔNG CÒN cấp huyện/quận/thị xã/thị trấn. Huyện đảo cũ nay là Đặc khu. Hỗ trợ tra ngược địa chỉ cũ sang mới',
    inputSchema: z.object({
      query: z.string().describe('Tên xã/phường/tỉnh cần tra cứu, hoặc tên đơn vị cũ (huyện, quận) để tra ngược'),
    }),
    execute: async ({ query }: { query: string }) => {
      const { provinces, communes } = searchAdministrativeUnit(query);
      
      let resultText = `Kết quả tra cứu cho "${query}":\n\n`;
      
      if (provinces.length === 0 && communes.length === 0) {
        return resultText + 'Không tìm thấy đơn vị hành chính nào khớp với từ khóa. Lưu ý hiện nay Việt Nam áp dụng mô hình 2 cấp: Tỉnh → Xã/Phường (không còn cấp huyện).';
      }

      if (provinces.length > 0) {
        resultText += `### Tỉnh/Thành phố (${provinces.length}):\n`;
        provinces.forEach(p => {
          resultText += `- ${p.name} (Mã: ${p.code})`;
          if (p.old_names && p.old_names.length > 0) {
            resultText += ` - Gộp từ: ${p.old_names.join(', ')}`;
          }
          resultText += '\n';
        });
        resultText += '\n';
      }

      // Tách đặc khu (huyện đảo cũ) ra khỏi xã/phường thường
      const dacKhu = communes.filter(c => c.type === 'dac_khu');
      const xaPhuong = communes.filter(c => c.type !== 'dac_khu');

      if (dacKhu.length > 0) {
        resultText += `### Đặc khu (${dacKhu.length}) — huyện đảo cũ, nay trực thuộc tỉnh:\n`;
        dacKhu.forEach(c => {
          resultText += `- ${c.name} (Mã: ${c.code}) trực thuộc ${c.provinceName}`;
          if (c.old_district) {
            resultText += `\n  *Trước đây:* ${c.old_district}, nay là Đặc khu trực thuộc trực tiếp ${c.provinceName} theo Luật 72/2025/QH15.`;
          }
          resultText += '\n';
        });
        resultText += '\n';
      }

      if (xaPhuong.length > 0) {
        resultText += `### Xã/Phường (${xaPhuong.length}):\n`;
        xaPhuong.forEach(c => {
          resultText += `- ${c.name} (Mã: ${c.code}) trực thuộc ${c.provinceName}`;
          if (c.old_district) {
            resultText += `\n  *Mô hình 2 cấp:* Trước đây thuộc ${c.old_district}, nay trực thuộc trực tiếp ${c.provinceName} do cấp huyện đã bị bãi bỏ.`;
          }
          if (c.old_names && c.old_names.length > 0) {
            resultText += `\n  *Tên cũ:* ${c.old_names.join(', ')}`;
          }
          resultText += '\n';
        });
      }

      const stats = getStats();
      resultText += `\n---\n*Dữ liệu áp dụng theo NQ 202/2025/QH15, NQ 30/2026/QH16 & Luật 72/2025/QH15 (${stats.totalProvinces} tỉnh/thành, ${stats.totalCommunes} xã/phường/đặc khu, mô hình 2 cấp: Tỉnh → Xã/Phường/Đặc khu, KHÔNG còn cấp huyện).*`;
      
      return resultText;
    },
  });
}
