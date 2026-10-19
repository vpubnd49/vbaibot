/**
 * mock-data.ts
 *
 * Dữ liệu giả lập thực tế:
 * - Sao kê Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN Lâm Đồng
 * - Sổ Kế toán Chi tiết Tiền gửi Ngân hàng (TK 1121) - Tháng 10/2026
 *
 * Thiết kế bao quát các tình huống nghiệp vụ:
 * 1. Khớp chính xác 1:1 theo Mã tham chiếu (FT...)
 * 2. Khớp 1:1 theo quy tắc (Số tiền + Tên đối tác)
 * 3. Khớp 1-Nhiều (1 lệnh chi gộp 2 hóa đơn nhà cung cấp)
 * 4. Tình huống mơ hồ (Ambiguous): 2 giao dịch cùng tiền, cùng ngày
 * 5. Phí ngân hàng chưa vào sổ (Nợ 642 / Có 1121)
 * 6. Lãi tiền gửi chưa vào sổ (Nợ 1121 / Có 515)
 * 7. Tiền đang chuyển cuối kỳ (Deposits in transit)
 * 8. Ủy nhiệm chi chưa thanh toán (Outstanding checks/disbursements)
 */

import type { BankTransaction, LedgerEntry, User } from "./types.js";

export const MOCK_USERS: Record<string, User> = {
  maker: {
    id: "USR-KT01",
    name: "Nguyễn Thị Mai (Kế toán thanh toán)",
    role: "MAKER",
    department: "Phòng Kế toán Tài chính",
  },
  checker: {
    id: "USR-KTT01",
    name: "Trần Văn Bình (Kế toán trưởng)",
    role: "CHECKER",
    department: "Phòng Kế toán Tài chính",
  },
  auditor: {
    id: "USR-KTNB",
    name: "Lê Hoàng Quân (Kiểm toán nội bộ)",
    role: "AUDITOR",
    department: "Ban Kiểm soát",
  },
};

export const MOCK_OPENING_BALANCES = {
  bank: 500_000_000n,    // Dư đầu kỳ tại VCB: 500.000.000 VND
  ledger: 500_000_000n,  // Dư đầu kỳ Sổ 1121: 500.000.000 VND
};

export const MOCK_CLOSING_BALANCES = {
  bank: 579_740_000n,    // Dư cuối kỳ tại VCB: 579.740.000 VND
  ledger: 564_000_000n,  // Dư cuối kỳ Sổ 1121: 564.000.000 VND
};

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [
  {
    id: "BTX-01",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-05",
    valueDate: "2026-10-05",
    txType: "CREDIT",
    amount: 150_000_000n,
    currency: "VND",
    referenceNumber: "FT26284001",
    description: "CONG TY CP SAO MAI THANH TOAN HD 0012 NGAY 01/10/2026",
    counterpartyAccount: "0011009876543",
    counterpartyName: "CONG TY CP SAO MAI",
  },
  {
    id: "BTX-02",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-10",
    valueDate: "2026-10-10",
    txType: "DEBIT",
    amount: 80_000_000n,
    currency: "VND",
    referenceNumber: "FT26284002",
    description: "CHUYEN TIEN MUA THIET BI NCC MINH THONG THEO HD 554/MT",
    counterpartyAccount: "0451000332211",
    counterpartyName: "CONG TY TNHH MINH THONG",
  },
  {
    id: "BTX-03",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-14",
    valueDate: "2026-10-14",
    txType: "CREDIT",
    amount: 45_000_000n,
    currency: "VND",
    referenceNumber: "FT26284003",
    description: "DAI PHAT CHUYEN TIEN MUA GOI DICH VU PHAN MEM",
    counterpartyAccount: "0181005544332",
    counterpartyName: "CONG TY DAI PHAT",
  },
  {
    id: "BTX-04",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-18",
    valueDate: "2026-10-18",
    txType: "DEBIT",
    amount: 60_000_000n,
    currency: "VND",
    referenceNumber: "FT26284004",
    description: "THANH TOAN TIEN THUE VA PHI BAO TRI VAN PHONG THANG 10",
    counterpartyAccount: "0341009988776",
    counterpartyName: "TOA NHA VAN PHONG DALAT CENTER",
  },
  {
    id: "BTX-05",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-22",
    valueDate: "2026-10-22",
    txType: "CREDIT",
    amount: 12_000_000n,
    currency: "VND",
    referenceNumber: "FT26284005",
    description: "THANH TOAN TIEN BAN QUYEN THANG 10",
  },
  {
    id: "BTX-06",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-22",
    valueDate: "2026-10-22",
    txType: "CREDIT",
    amount: 12_000_000n,
    currency: "VND",
    referenceNumber: "FT26284006",
    description: "THANH TOAN TIEN BAN QUYEN THANG 10",
  },
  {
    id: "BTX-07",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-31",
    valueDate: "2026-10-31",
    txType: "DEBIT",
    amount: 110_000n,
    currency: "VND",
    referenceNumber: "FEE-2610-01",
    description: "PHI QUAN LY TAI KHOAN VA PHI SMS BANKING KY 10/2026",
  },
  {
    id: "BTX-08",
    bankAccount: "0071001234567",
    bankName: "Vietcombank - CN Lâm Đồng",
    transactionDate: "2026-10-31",
    valueDate: "2026-10-31",
    txType: "CREDIT",
    amount: 850_000n,
    currency: "VND",
    referenceNumber: "INT-2610-01",
    description: "TRA LAI TIEN GUI TIET KIEM KHONG KY HAN KY 10/2026",
  },
];

export const MOCK_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: "LED-01",
    voucherNumber: "BC-2610-001",
    voucherDate: "2026-10-05",
    postingDate: "2026-10-05",
    accountNumber: "1121",
    correspondingAccount: "131",
    txType: "DEBIT",
    amount: 150_000_000n,
    currency: "VND",
    description: "Thu nợ khách hàng Sao Mai HĐ 0012 FT26284001",
    partnerName: "Công ty Cổ phần Sao Mai",
    partnerCode: "KH_SAOMAI",
  },
  {
    id: "LED-02",
    voucherNumber: "UNC-2610-015",
    voucherDate: "2026-10-10",
    postingDate: "2026-10-10",
    accountNumber: "1121",
    correspondingAccount: "331",
    txType: "CREDIT",
    amount: 80_000_000n,
    currency: "VND",
    description: "Thanh toán tiền thiết bị NCC Minh Thông HĐ 554/MT FT26284002",
    partnerName: "Công ty TNHH Minh Thông",
    partnerCode: "NCC_MINHTHONG",
  },
  {
    id: "LED-03",
    voucherNumber: "BC-2610-002",
    voucherDate: "2026-10-14",
    postingDate: "2026-10-15", // Chênh 1 ngày hạch toán
    accountNumber: "1121",
    correspondingAccount: "511",
    txType: "DEBIT",
    amount: 45_000_000n,
    currency: "VND",
    description: "Thu tiền bán gói phần mềm cty Đại Phát",
    partnerName: "Công ty Đại Phát",
    partnerCode: "KH_DAIPHAT",
  },
  {
    id: "LED-04",
    voucherNumber: "UNC-2610-018A",
    voucherDate: "2026-10-18",
    postingDate: "2026-10-18",
    accountNumber: "1121",
    correspondingAccount: "331",
    txType: "CREDIT",
    amount: 25_000_000n,
    currency: "VND",
    description: "Chi tiền thuê văn phòng Dalat Center tháng 10 đợt 1",
    partnerName: "Dalat Center",
  },
  {
    id: "LED-05",
    voucherNumber: "UNC-2610-018B",
    voucherDate: "2026-10-18",
    postingDate: "2026-10-18",
    accountNumber: "1121",
    correspondingAccount: "331",
    txType: "CREDIT",
    amount: 35_000_000n,
    currency: "VND",
    description: "Chi phí bảo trì thang máy và hạ tầng Dalat Center đợt 2",
    partnerName: "Dalat Center",
  },
  {
    id: "LED-06",
    voucherNumber: "BC-2610-003",
    voucherDate: "2026-10-22",
    postingDate: "2026-10-22",
    accountNumber: "1121",
    correspondingAccount: "131",
    txType: "DEBIT",
    amount: 12_000_000n,
    currency: "VND",
    description: "Thu tiền phí bản quyền tháng 10 của KH An Phú",
    partnerName: "Công ty An Phú",
  },
  {
    id: "LED-07",
    voucherNumber: "BC-2610-004",
    voucherDate: "2026-10-22",
    postingDate: "2026-10-22",
    accountNumber: "1121",
    correspondingAccount: "131",
    txType: "DEBIT",
    amount: 12_000_000n,
    currency: "VND",
    description: "Thu tiền phí bản quyền tháng 10 của KH Bình Minh",
    partnerName: "Công ty Bình Minh",
  },
  {
    id: "LED-08",
    voucherNumber: "PT-2610-099",
    voucherDate: "2026-10-31",
    postingDate: "2026-10-31",
    accountNumber: "1121",
    correspondingAccount: "1111",
    txType: "DEBIT",
    amount: 35_000_000n,
    currency: "VND",
    description: "Nộp tiền mặt doanh thu bán lẻ vào TK VCB cuối ngày 31/10 (Tiền đang chuyển)",
  },
  {
    id: "LED-09",
    voucherNumber: "UNC-2610-089",
    voucherDate: "2026-10-31",
    postingDate: "2026-10-31",
    accountNumber: "1121",
    correspondingAccount: "331",
    txType: "CREDIT",
    amount: 50_000_000n,
    currency: "VND",
    description: "Ủy nhiệm chi trả NCC thiết bị mạng lúc 16h50 ngày 31/10 (NH chưa trích nợ)",
  },
];
