// test_hd05.js — Kiểm tra engine đã cập nhật HD05 đúng
const core = require('./engine/docx_core.js');
const fs = require('fs');

console.log('=== TEST 1: Module loads OK ===');
console.log('LAYOUT.MARGIN.right:', core.LAYOUT.MARGIN.right, '(expect 850)');
console.log('BODY_SPACING.line:', core.BODY_SPACING.line, '(expect 360)');

console.log('\n=== TEST 2: Kính trình for Tờ trình ===');
const ttData = {
    loai_van_ban: 'to_trinh',
    kinh_gui: ['Ban Thường vụ Tỉnh uỷ'],
};
const ttElements = core.createKinhGui(ttData);
// Check that elements contain "Kính trình"
const ttText = JSON.stringify(ttElements);
const hasKinhTrinh = ttText.includes('Kính trình');
console.log('Tờ trình uses "Kính trình":', hasKinhTrinh ? 'PASS ✓' : 'FAIL ✗');

console.log('\n=== TEST 3: Kính gửi for Công văn ===');
const cvData = {
    loai_van_ban: 'cong_van',
    kinh_gui: ['Ban Bí thư Trung ương Đảng'],
};
const cvElements = core.createKinhGui(cvData);
const cvText = JSON.stringify(cvElements);
const hasKinhGui = cvText.includes('Kính gửi');
console.log('Công văn uses "Kính gửi":', hasKinhGui ? 'PASS ✓' : 'FAIL ✗');

console.log('\n=== TEST 4: Nơi nhận semicolon ===');
const noiNhanData = {
    loai_van_ban: 'nghi_quyet',
    noi_nhan: ['Các huyện uỷ trực thuộc', 'Lưu VPTU'],
};
const noiNhanElements = core.createNoiNhan(noiNhanData);
const noiNhanText = JSON.stringify(noiNhanElements);
const hasSemicolon = noiNhanText.includes('trực thuộc;');
const hasDot = noiNhanText.includes('VPTU.');
console.log('Nơi nhận has semicolon (;):', hasSemicolon ? 'PASS ✓' : 'FAIL ✗');
console.log('Nơi nhận ends with dot (.):', hasDot ? 'PASS ✓' : 'FAIL ✗');

console.log('\n=== TEST 5: "Như trên" for CV/TTr ===');
const cvNoiNhanData = {
    loai_van_ban: 'cong_van',
    kinh_gui: ['Ban Bí thư'],
    noi_nhan: ['Các ban TW', 'Lưu VPTW'],
};
const cvNoiNhanElements = core.createNoiNhan(cvNoiNhanData);
const cvNoiNhanText = JSON.stringify(cvNoiNhanElements);
const hasNhuTren = cvNoiNhanText.includes('Như trên');
console.log('CV Nơi nhận has "Như trên":', hasNhuTren ? 'PASS ✓' : 'FAIL ✗');

console.log('\n=== TEST 6: NQ (no Kính gửi) Nơi nhận NO "Như trên" ===');
const nqNoiNhanData = {
    loai_van_ban: 'nghi_quyet',
    noi_nhan: ['Các huyện uỷ', 'Lưu VPTU'],
};
const nqNoiNhanElements = core.createNoiNhan(nqNoiNhanData);
const nqNoiNhanText = JSON.stringify(nqNoiNhanElements);
const nqHasNhuTren = nqNoiNhanText.includes('Như trên');
console.log('NQ Nơi nhận has NO "Như trên":', !nqHasNhuTren ? 'PASS ✓' : 'FAIL ✗');

console.log('\n=== ALL TESTS DONE ===');
