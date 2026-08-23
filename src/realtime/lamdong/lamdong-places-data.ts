/**
 * CSDL Tuyển chọn các địa điểm ẩm thực, nhà hàng, quán cafe, khách sạn, resort nổi tiếng & hot trend tại tỉnh Lâm Đồng
 */

export type PlaceCategory = "an_uong" | "nha_hang" | "cafe_view" | "khach_san_resort" | "homestay_glamping";

export type LamDongPlace = {
  name: string;
  category: PlaceCategory;
  area: "da_lat_trung_tam" | "da_lat_ngoai_o" | "tuyen_lam" | "cau_dat" | "bao_loc" | "lac_duong" | "khac";
  address: string;
  specialty: string;
  highlights: string[];
  priceRange: string;
};

export const LAM_DONG_PLACES: LamDongPlace[] = [
  // --- 1. ẨM THỰC ĐẶC SẢN & ĂN UỐNG NỔI TIẾNG ---
  {
    name: "Lẩu gà lá é Tao Ngộ",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "Số 5 đường 3 Tháng 4, P. 3, TP. Đà Lạt",
    specialty: "Lẩu gà lá é chính gốc, nước lẩu ngọt thanh từ nấm và the cay nồng của lá é tươi",
    highlights: ["Quán gốc lâu năm nổi tiếng nhất Đà Lạt", "Thịt gà thả vườn chắc thịt", "Rất thích hợp ăn lúc se lạnh"],
    priceRange: "200.000đ - 400.000đ/nồi",
  },
  {
    name: "Lẩu gà lá é É Tre Mới",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "Số 1 Chu Văn An, P. 3, TP. Đà Lạt",
    specialty: "Lẩu gà lá é không gian tre mộc mạc rộng rãi, nước dùng ngọt đậm đà",
    highlights: ["Không gian sạch sẽ, bãi đậu xe rộng", "Lá é tươi non ăn thả ga", "Phục vụ nhanh"],
    priceRange: "250.000đ - 450.000đ/nồi",
  },
  {
    name: "Lẩu bò Ba Toa Quán Gỗ",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "1/29 Hoàng Diệu, P. 5, TP. Đà Lạt",
    specialty: "Lẩu bò thập cẩm gia truyền (nạm, đuôi, gân, bò viên, óc bò) siêu đầy đặn",
    highlights: ["Quán gỗ nguyên bản trong hẻm Ba Toa", "Nước lẩu đậm đà chuẩn vị Đà Lạt", "Ăn kèm mì trứng và rau xanh"],
    priceRange: "150.000đ - 400.000đ/nồi",
  },
  {
    name: "Bánh ướt lòng gà Quán Long",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "Hẻm 202 Phan Đình Phùng, P. 2, TP. Đà Lạt",
    specialty: "Bánh ướt mềm dẻo tráng nóng, ăn cùng thịt gà xé, lòng heo/gà, trứng non và nước mắm chua ngọt",
    highlights: ["Quán ruột của người bản địa", "Thịt gà đồi giòn dai", "Giá cả rất bình dân"],
    priceRange: "35.000đ - 60.000đ/phần",
  },
  {
    name: "Bánh mì xíu mại Hoàng Diệu",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "Số 26 Hoàng Diệu, P. 5, TP. Đà Lạt",
    specialty: "Bánh mì giòn rụm chấm chén xíu mại nóng hổi béo ngậy, kèm chả cây và da heo giòn dai",
    highlights: ["Điểm ăn sáng hot nhất Đà Lạt", "Sữa đậu nành nóng thơm phức", "Nên đến trước 8h sáng"],
    priceRange: "20.000đ - 35.000đ/phần",
  },
  {
    name: "Kem bơ Thanh Thảo",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "Số 76 Nguyễn Văn Trỗi, P. 2, TP. Đà Lạt",
    specialty: "Kem bơ dẻo mịn béo ngậy ăn cùng viên kem dừa và dừa sấy giòn",
    highlights: ["Thương hiệu kem bơ trứ danh nhiều thập kỷ", "Bơ sáp Đà Lạt xay sánh đặc", "Món tráng miệng phải thử"],
    priceRange: "25.000đ - 40.000đ/ly",
  },
  {
    name: "Nem nướng Bà Hùng",
    category: "an_uong",
    area: "da_lat_trung_tam",
    address: "328 Phan Đình Phùng, P. 2, TP. Đà Lạt",
    specialty: "Nem nướng than hoa thơm lừng, cuốn bánh tráng rau sống chấm sốt tương đậu phộng gia truyền",
    highlights: ["Nước chấm ấm nóng sền sệt độc quyền", "Rau sống Đà Lạt tươi giòn", "Đậm đà hương vị phố núi"],
    priceRange: "50.000đ - 70.000đ/phần",
  },
  {
    name: "Cơm niêu Thuận Thành Bảo Lộc",
    category: "an_uong",
    area: "bao_loc",
    address: "86 Lý Tự Trọng, P. 1, TP. Bảo Lộc",
    specialty: "Cơm niêu cháy giòn ăn kèm cá kho tộ, canh cua rau đay, thịt kho tàu",
    highlights: ["Quán ăn gia đình nức tiếng Bảo Lộc", "Món ăn thuần Việt đậm đà", "Không gian rộng rãi, lịch sự"],
    priceRange: "60.000đ - 150.000đ/người",
  },

  // --- 2. NHÀ HÀNG & ẨM THỰC CAO CẤP ---
  {
    name: "Nhà hàng Song Mây",
    category: "nha_hang",
    area: "da_lat_ngoai_o",
    address: "49 Dã Tượng, P. 5, TP. Đà Lạt",
    specialty: "Ẩm thực truyền thống Việt Nam kết hợp các món Tây Nguyên (bò nướng ống tre, chả cá Song Mây)",
    highlights: ["Kiến trúc nhà rường gỗ cổ kính tuyệt đẹp", "View nhìn ra thung lũng thông", "Phục vụ chuyên nghiệp"],
    priceRange: "200.000đ - 500.000đ/người",
  },
  {
    name: "Nhà hàng Memory Dalat",
    category: "nha_hang",
    area: "da_lat_trung_tam",
    address: "24B Hùng Vương, P. 10, TP. Đà Lạt",
    specialty: "Ẩm thực Âu - Á tinh tế, lẩu cá tầm măng chua, sườn cừu đút lò",
    highlights: ["Biệt thự cổ tích ngắm hoàng hôn", "Đêm nhạc Acoustic Trịnh Ca lãng mạn", "Không gian sang trọng ấm cúng"],
    priceRange: "150.000đ - 450.000đ/người",
  },
  {
    name: "Nhà hàng Cơm Niêu Như Ngọc",
    category: "nha_hang",
    area: "da_lat_trung_tam",
    address: "19/8 Hồ Tùng Mậu, P. 3, TP. Đà Lạt",
    specialty: "Cơm đập, cơm niêu giòn 2 mặt cùng các món ăn thuần Việt 3 miền",
    highlights: ["Nằm ngay trung tâm gần Hồ Xuân Hương", "Phù hợp đoàn du lịch và gia đình", "Hơn 20 năm phục vụ"],
    priceRange: "100.000đ - 250.000đ/người",
  },
  {
    name: "Nhà hàng Léguda Buffet Rau",
    category: "nha_hang",
    area: "da_lat_ngoai_o",
    address: "Lầu 1 Nhà ga Cáp Treo, Đồi Robin, P. 3, TP. Đà Lạt",
    specialty: "Buffet rau sạch Đà Lạt không giới hạn ăn kèm lẩu 2 ngăn thanh ngọt",
    highlights: ["View toàn cảnh thành phố từ đỉnh đồi Robin", "Hàng chục loại rau củ tươi non thu hoạch tại vườn", "Giá vé rất hợp lý"],
    priceRange: "89.000đ - 250.000đ/người",
  },

  // --- 3. QUÁN CAFE VIEW ĐẸP, SĂN MÂY & ACOUSTIC ---
  {
    name: "Tiệm Cà Phê Túi Mơ To",
    category: "cafe_view",
    area: "da_lat_ngoai_o",
    address: "Hẻm 31 Sào Nam, P. 11, TP. Đà Lạt",
    specialty: "Cafe ngắm nhà lồng thung lũng đèn về đêm, vườn cúc họa mi nở rực rỡ quanh năm",
    highlights: ["Top 1 điểm check-in hot nhất Đà Lạt", "Ngôi nhà gỗ mộc view triệu đô", "Đồ uống ngon, có phục vụ đồ ăn nhẹ"],
    priceRange: "50.000đ - 80.000đ/món",
  },
  {
    name: "Lululola Coffee+ (Sân khấu Acoustic)",
    category: "cafe_view",
    area: "da_lat_trung_tam",
    address: "Đầu đèo Prenn, đường 3/4, Đồi Cà Rốt, P. 3, TP. Đà Lạt",
    specialty: "Không gian biểu diễn live show âm nhạc hoàng hôn cùng các ca sĩ nổi tiếng",
    highlights: ["Sân khấu ca nhạc ngoài trời view thung lũng đẹp nhất Đà Lạt", "Ngắm trọn vẹn hoàng hôn buông xuống", "Không gian cực kỳ lãng mạn"],
    priceRange: "60.000đ - 100.000đ (Vé show ca nhạc riêng)",
  },
  {
    name: "Tiệm Cà Phê Cheo Veooo",
    category: "cafe_view",
    area: "da_lat_ngoai_o",
    address: "116 Hùng Vương, Hẻm Dã Chiến, P. 11, TP. Đà Lạt",
    specialty: "Quán cafe gỗ nhỏ mộc mạc nép mình bên sườn đồi ngắm hoàng hôn và sương mây",
    highlights: ["Không gian yên tĩnh, hòa mình vào thiên nhiên", "Góc hiên gỗ chụp ảnh cực chill", "Nhạc nhẹ nhàng thư giãn"],
    priceRange: "45.000đ - 70.000đ/món",
  },
  {
    name: "Cà Phê Bình Minh Ơi",
    category: "cafe_view",
    area: "da_lat_ngoai_o",
    address: "89 Hoàng Hoa Thám, P. 10, TP. Đà Lạt",
    specialty: "Điểm săn mây đón bình minh sáng sớm tuyệt đẹp cùng vườn hoa cúc",
    highlights: ["Mở cửa từ 5h sáng để du khách săn mây", "Có phục vụ ăn sáng bánh mì xíu mại", "Đêm có nhạc acoustic"],
    priceRange: "50.000đ - 85.000đ/món",
  },
  {
    name: "Đôi Dép Tea Resort & Cafe Bảo Lộc",
    category: "cafe_view",
    area: "bao_loc",
    address: "27 Cao Thắng, Lộc Nga, TP. Bảo Lộc",
    specialty: "Thưởng thức trà Ô Long Bảo Lộc thượng hạng và cafe giữa không gian xanh mát",
    highlights: ["Thương hiệu Không thể thiếu nhau nổi tiếng", "Khuôn viên suối khoáng bùn và resort cao cấp", "Check-in cực đẹp"],
    priceRange: "40.000đ - 90.000đ/món",
  },

  // --- 4. KHÁCH SẠN, RESORT & LƯU TRÚ CAO CẤP ---
  {
    name: "Dalat Palace Heritage Hotel (5 Sao)",
    category: "khach_san_resort",
    area: "da_lat_trung_tam",
    address: "Số 2 Trần Phú, P. 3, TP. Đà Lạt",
    specialty: "Khách sạn cổ kính bậc nhất Đông Dương xây dựng từ năm 1922 với view trọn vẹn Hồ Xuân Hương",
    highlights: ["Kiến trúc Pháp cổ điển xa hoa", "Sân golf cổ và hầm rượu vang", "Vị trí kim cương trung tâm"],
    priceRange: "3.500.000đ - 12.000.000đ/đêm",
  },
  {
    name: "Ana Mandara Villas Dalat Resort & Spa (5 Sao)",
    category: "khach_san_resort",
    area: "da_lat_trung_tam",
    address: "Đường Lê Lai, P. 5, TP. Đà Lạt",
    specialty: "Quần thể 17 biệt thự cổ kiểu Pháp nguyên bản ẩn mình giữa đồi thông xanh mát",
    highlights: ["Hồ bơi nước ấm ngoài trời", "Không gian tĩnh dưỡng đẳng cấp thượng lưu", "Dịch vụ spa La Cochinchine danh tiếng"],
    priceRange: "2.800.000đ - 8.500.000đ/đêm",
  },
  {
    name: "Terracotta Hotel & Resort Dalat (4 Sao)",
    category: "khach_san_resort",
    area: "tuyen_lam",
    address: "Phân khu chức năng 7.9, KDL Hồ Tuyền Lâm, P. 3, TP. Đà Lạt",
    specialty: "Resort bán đảo ven hồ Tuyền Lâm với view mặt nước và rừng thông ngút ngàn",
    highlights: ["Khuôn viên hoa và thông rộng lớn", "Khu biệt thự ven hồ cực đẹp", "Hồ bơi trong nhà và khu vui chơi"],
    priceRange: "1.600.000đ - 6.000.000đ/đêm",
  },
  {
    name: "Hôtel Colline Đà Lạt (4 Sao)",
    category: "khach_san_resort",
    area: "da_lat_trung_tam",
    address: "Số 10 Phan Bội Châu, P. 1, TP. Đà Lạt",
    specialty: "Khách sạn phong cách châu Âu hiện đại tọa lạc ngay khu phức hợp Đà Lạt Center / Chợ Mới",
    highlights: ["Bước chân xuống là Chợ đêm Đà Lạt", "Kiến trúc gạch nung độc đáo check-in siêu hot", "Nhiều nhà hàng ẩm thực phong phú"],
    priceRange: "1.400.000đ - 4.500.000đ/đêm",
  },

  // --- 5. HOMESTAY & GLAMPING SĂN MÂY HOT TREND ---
  {
    name: "The Kupid Homestay",
    category: "homestay_glamping",
    area: "da_lat_ngoai_o",
    address: "47 Đặng Thái Thân, P. 3, TP. Đà Lạt",
    specialty: "Phòng ngủ kính trong suốt view rừng thông thung lũng, đón nắng sớm ngập tràn",
    highlights: ["Homestay triệu view dành cho giới trẻ", "Sân vườn nướng BBQ chill buổi tối", "Tone màu gỗ và trắng tinh tế"],
    priceRange: "600.000đ - 1.800.000đ/đêm",
  },
  {
    name: "CampArt by #MợJen (Glamping Hồ Tuyền Lâm)",
    category: "homestay_glamping",
    area: "tuyen_lam",
    address: "Thung lũng hồ Tuyền Lâm, TP. Đà Lạt",
    specialty: "Mô hình cắm trại Glamping cao cấp giữa rừng thông ven hồ, trọn gói tiệc nướng steak và rượu vang",
    highlights: ["Trải nghiệm ngủ lều bên hồ thơ mộng", "Bình minh sương giăng mặt hồ tuyệt tác", "Dịch vụ chu đáo, ấm cúng"],
    priceRange: "890.000đ - 1.200.000đ/người",
  },
  {
    name: "Twin Beans Farm (Nông trại Glamping Lạc Dương)",
    category: "homestay_glamping",
    area: "lac_duong",
    address: "Thôn 1, Xã Đạ Sar, Huyện Lạc Dương, Lâm Đồng",
    specialty: "Cắm trại cao cấp giữa nông trại cà phê Arabica và suối nước tự nhiên",
    highlights: ["Không gian yên bình tách biệt đô thị", "Trải nghiệm hái cà phê và tắm suối", "Thưởng thức cà phê đặc sản"],
    priceRange: "700.000đ - 1.500.000đ/người",
  },
];
