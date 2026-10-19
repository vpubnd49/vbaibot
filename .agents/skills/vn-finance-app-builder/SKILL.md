---
name: Xây dựng Ứng dụng Tài chính - Kế toán - Thuế (vn-finance-app-builder)
description: "Thiết kế, xây dựng và kiểm thử ứng dụng ngân hàng, kế toán, thuế và tài chính doanh nghiệp trên Antigravity: thiết kế schema cơ sở dữ liệu, API RESTful, engine tính thuế/lãi vay/định khoản theo phiên bản ngày hiệu lực, kiểm soát tính toán Decimal, bảo mật dữ liệu và kiểm thử chấp nhận (acceptance test). Triggers: 'xây ứng dụng tài chính', 'phần mềm kế toán', 'phần mềm thuế', 'app tài chính', 'engine tài chính', 'schema kế toán', 'api ngân hàng', 'rule engine', 'hóa đơn api', 'đối soát tự động'."
triggers: ['xây ứng dụng tài chính', 'phần mềm kế toán', 'phần mềm thuế', 'app tài chính', 'engine tài chính', 'schema kế toán', 'api ngân hàng', 'rule engine', 'hóa đơn api', 'đối soát tự động']
---

# Thiết kế & Xây dựng Ứng dụng Tài chính, Kế toán, Thuế — v2.0

## 1. Nguyên tắc Bất biến khi Thiết kế Hệ thống Tài chính
1. **Tuyệt đối KHÔNG Hardcode Quy tắc / Thuế suất / Tỷ lệ**:
   - Mọi thông số thuế (thuế suất GTGT, bậc thuế TNCN, mức giảm trừ gia cảnh, thuế TNDN), lãi suất ngân hàng, tỷ lệ trích nộp bảo hiểm... PHẢI được thiết kế dưới dạng **Quy tắc có phiên bản theo thời gian (Temporal Rule Engine)**.
   - Mỗi quy tắc lưu trữ tối thiểu các trường: `rule_code`, `valid_from` (ngày bắt đầu hiệu lực), `valid_to` (ngày hết hiệu lực hoặc NULL), `legal_reference` (căn cứ pháp lý: Luật/NĐ/TT), `status` (DRAFT / APPROVED / RETIRED), `parameters_json`.
2. **Số học Chính xác (Decimal Arithmetic)**:
   - Trong cơ sở dữ liệu: Dùng kiểu `DECIMAL(18, 4)` hoặc lưu trữ theo đơn vị nhỏ nhất (số nguyên integer/cents/đồng).
   - Trong code (Node.js/TypeScript/Python): Tuyệt đối KHÔNG dùng kiểu số thực dấu phẩy động `float` hay `number` cho phép tính nhân/chia tiền tệ. Dùng thư viện số học chính xác như `decimal.js`, `bignumber.js` (TypeScript) hoặc `decimal` (Python).
   - Chuỗi tiền tệ truyền qua API JSON phải định dạng dạng chuỗi (string) để tránh làm tròn phía client.
3. **Tính Bất biến & Nhật ký Dấu vết (Immutability & Audit Trail)**:
   - Bút toán kế toán, giao dịch ngân hàng, hóa đơn điện tử một khi đã phát hành/khóa sổ: **TUYỆT ĐỐI KHÔNG XÓA (NO HARD DELETE)**.
   - Điều chỉnh phải thực hiện thông qua bút toán đảo (reversal) hoặc bút toán bổ sung kèm lý do và định danh người duyệt.
   - Đáp ứng chuẩn Điều 28 Thông tư 99/2025/TT-BTC về phần mềm kế toán.

## 2. Kiến trúc Schema Cơ sở Dữ liệu Mẫu
1. **Bảng Bút toán Kế toán Kép (Double-Entry Journal)**:
   - `journal_entries`: `id`, `tenant_id`, `entry_date`, `posting_date`, `voucher_type`, `voucher_no`, `description`, `created_by`, `approved_by`, `status` (draft/posted/cancelled).
   - `journal_lines`: `id`, `entry_id`, `account_code`, `debit_amount`, `credit_amount`, `currency`, `partner_id`, `cost_center_id`.
   - Ràng buộc cứng: `CHECK (debit_amount >= 0 AND credit_amount >= 0)`, Trigger kiểm tra `SUM(debit) = SUM(credit)` khi chuyển trạng thái sang `posted`.
2. **Bảng Quy tắc Thuế Động (Tax Rules)**:
   - `tax_rules`: `id`, `tax_type` (PIT/CIT/VAT), `version`, `effective_from`, `effective_to`, `brackets_json`, `deductions_json`, `legal_doc_no`, `status`.

## 3. Tiêu chuẩn Kiểm thử Nghiệp vụ (Acceptance Testing)
Trước khi bàn giao hoặc đưa vào sản xuất, bắt buộc vượt qua bộ kiểm thử:
1. **Kiểm thử biên ngày chuyển tiếp (Temporal boundary test)**:
   - Tính thuế TNCN cho kỳ trước 2026 (biểu cũ 7 bậc, giảm trừ 11tr/4.4tr).
   - Tính thuế TNCN cho kỳ từ 2026 (biểu mới 5 bậc Luật 109/2025, giảm trừ 15.5tr/6.2tr).
   - Kiểm tra khoản vay trước và sau 15/08/2026 theo TT 29/2026/TT-NHNN.
2. **Kiểm thử tính toàn vẹn (Integrity test)**:
   - Tổng Nợ bằng Tổng Có trong mọi tình huống.
   - Không xuất hiện số âm tại các trường tiền tệ không hợp lệ.
3. **Kiểm thử tải đồng thời (Concurrency & Idempotency)**:
   - Các API ghi nhận giao dịch thanh toán hoặc phát hành hóa đơn phải có `Idempotency-Key` để tránh ghi trùng lặp khi mạng bị gián đoạn.
