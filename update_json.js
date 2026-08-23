import fs from 'fs';

const filePath = 'e:/OneDrive/HSCV/Antigravity/zaloagent/src/legal/data/administrative-divisions-2025.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let added = 0;

// 1. Lâm Đồng (code 34)
const lamDong = data.provinces.find(p => p.code === "34");
if (lamDong) {
  lamDong.old_names = ["Bình Thuận", "Đắk Nông"];
  lamDong.communes.push({
    "code": "34001",
    "name": "Đặc khu Phú Quý",
    "type": "dac_khu",
    "old_district": "Huyện Phú Quý (Bình Thuận cũ)",
    "old_names": []
  });
  added++;
}

// 2. Quảng Ninh (code 12)
const quangNinh = data.provinces.find(p => p.code === "12");
if (quangNinh) {
  quangNinh.communes.push(
    {"code": "12001", "name": "Đặc khu Vân Đồn", "type": "dac_khu", "old_district": "Huyện Vân Đồn", "old_names": []},
    {"code": "12002", "name": "Đặc khu Cô Tô", "type": "dac_khu", "old_district": "Huyện Cô Tô", "old_names": []}
  );
  added += 2;
}

// 3. Hải Phòng (code 02)
const haiPhong = data.provinces.find(p => p.code === "02");
if (haiPhong) {
  haiPhong.communes.push(
    {"code": "02002", "name": "Đặc khu Cát Hải", "type": "dac_khu", "old_district": "Huyện Cát Hải", "old_names": []},
    {"code": "02003", "name": "Đặc khu Bạch Long Vĩ", "type": "dac_khu", "old_district": "Huyện Bạch Long Vĩ", "old_names": []}
  );
  added += 2;
}

// 4. Đà Nẵng (code 03)
const daNang = data.provinces.find(p => p.code === "03");
if (daNang) {
  daNang.communes.push(
    {"code": "03002", "name": "Đặc khu Hoàng Sa", "type": "dac_khu", "old_district": "Huyện Hoàng Sa", "old_names": []}
  );
  added += 1;
}

// Quảng Trị, Quảng Ngãi, Khánh Hòa, Bà Rịa - Vũng Tàu, Kiên Giang
const findProvince = (name) => data.provinces.find(p => p.name.includes(name) || p.old_names.includes(name));

const khanhHoa = findProvince("Khánh Hòa");
if (khanhHoa) {
  khanhHoa.communes.push({
    "code": khanhHoa.code + "001",
    "name": "Đặc khu Trường Sa",
    "type": "dac_khu",
    "old_district": "Huyện Trường Sa",
    "old_names": []
  });
  added++;
}

const baRia = findProvince("Bà Rịa - Vũng Tàu") || findProvince("Vũng Tàu");
if (baRia) {
  baRia.communes.push({
    "code": baRia.code + "001",
    "name": "Đặc khu Côn Đảo",
    "type": "dac_khu",
    "old_district": "Huyện Côn Đảo",
    "old_names": []
  });
  added++;
}

const kienGiang = findProvince("Kiên Giang");
if (kienGiang) {
  kienGiang.communes.push(
    {"code": kienGiang.code + "001", "name": "Đặc khu Kiên Hải", "type": "dac_khu", "old_district": "Huyện Kiên Hải", "old_names": []},
    {"code": kienGiang.code + "002", "name": "Đặc khu Phú Quốc", "type": "dac_khu", "old_district": "Thành phố Phú Quốc", "old_names": []}
  );
  added += 2;
}

const quangTri = findProvince("Quảng Trị");
if (quangTri) {
  quangTri.communes.push({
    "code": quangTri.code + "001", "name": "Đặc khu Cồn Cỏ", "type": "dac_khu", "old_district": "Huyện Cồn Cỏ", "old_names": []
  });
  added++;
}

const quangNgai = findProvince("Quảng Ngãi");
if (quangNgai) {
  quangNgai.communes.push({
    "code": quangNgai.code + "001", "name": "Đặc khu Lý Sơn", "type": "dac_khu", "old_district": "Huyện Lý Sơn", "old_names": []
  });
  added++;
}


// Metadata update
data.metadata.total_communes += added;
data.metadata.updated = "2026-08-01";

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log("Updated JSON. Added:", added);
