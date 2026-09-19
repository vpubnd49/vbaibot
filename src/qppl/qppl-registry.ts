import type { QpplNguon } from "./qppl-types.js";

export interface AgencyConfig {
  code: QpplNguon;
  name: string;
  shortName: string;
  baseUrl: string;
  listTitle: string;
  type: "tinh" | "so_nganh" | "dia_phuong" | "khac";
  tier: 1 | 2; // 1 = Đồng bộ định kỳ; 2 = Tra cứu tức thời on-demand
  aliases: string[];
}

export const AGENCY_REGISTRY: Record<string, AgencyConfig> = {
  // === KHỐI CƠ QUAN CẤP TỈNH (TIER 1) ===
  ubnd: {
    code: "ubnd",
    name: "Ủy ban nhân dân tỉnh Lâm Đồng",
    shortName: "UBND tỉnh",
    baseUrl: "https://w3.lamdong.gov.vn/sites/vpubnd",
    listTitle: "Quản lý văn bản chỉ đạo",
    type: "tinh",
    tier: 1,
    aliases: ["ubnd", "ubnd tỉnh", "vpubnd", "văn phòng ubnd", "chủ tịch ubnd", "ủy ban", "uy ban", "tỉnh", "tinh"]
  },
  hdnd: {
    code: "hdnd",
    name: "Hội đồng nhân dân tỉnh Lâm Đồng",
    shortName: "HĐND tỉnh",
    baseUrl: "https://w3.lamdong.gov.vn/sites/dbnd",
    listTitle: "Quản lý văn bản",
    type: "tinh",
    tier: 1,
    aliases: ["hdnd", "hđnd", "hđnd tỉnh", "hội đồng nhân dân", "đoàn đbqh", "dbnd", "đại biểu nhân dân"]
  },
  stp: {
    code: "stp",
    name: "Sở Tư pháp tỉnh Lâm Đồng",
    shortName: "Sở Tư pháp",
    baseUrl: "https://w3.lamdong.gov.vn/sites/stp",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 1,
    aliases: ["stp", "tư pháp", "sở tư pháp", "tu phap", "so tu phap", "giám định tư pháp", "lý lịch tư pháp", "thads"]
  },
  stc: {
    code: "stc",
    name: "Sở Tài chính tỉnh Lâm Đồng",
    shortName: "Sở Tài chính",
    baseUrl: "https://w3.lamdong.gov.vn/sites/stc",
    listTitle: "Quản Lý Văn Bản",
    type: "so_nganh",
    tier: 1,
    aliases: ["stc", "tài chính", "sở tài chính", "tai chinh", "so tai chinh", "ngân sách", "ngan sach"]
  },
  snv: {
    code: "snv",
    name: "Sở Nội vụ tỉnh Lâm Đồng",
    shortName: "Sở Nội vụ",
    baseUrl: "https://w3.lamdong.gov.vn/sites/snv",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 1,
    aliases: ["snv", "nội vụ", "sở nội vụ", "noi vu", "so noi vu", "tổ chức bộ máy", "công chức", "viên chức", "thi đua"]
  },
  thanhtra: {
    code: "thanhtra",
    name: "Thanh tra tỉnh Lâm Đồng",
    shortName: "Thanh tra tỉnh",
    baseUrl: "https://w3.lamdong.gov.vn/sites/thanhtra",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 1,
    aliases: ["thanhtra", "thanh tra", "thanh tra tỉnh", "khieunai", "khiếu nại", "tố cáo", "phòng chống tham nhũng"]
  },

  // === KHỐI CÁC SỞ, BAN, NGÀNH CHUYÊN MÔN (TIER 2 - LIVE SEARCH) ===
  syt: {
    code: "syt",
    name: "Sở Y tế tỉnh Lâm Đồng",
    shortName: "Sở Y tế",
    baseUrl: "https://w3.lamdong.gov.vn/sites/syt",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["syt", "y tế", "sở y tế", "y te", "so y te", "bệnh viện", "dược", "y tế dự phòng"]
  },
  sxd: {
    code: "sxd",
    name: "Sở Xây dựng tỉnh Lâm Đồng",
    shortName: "Sở Xây dựng",
    baseUrl: "https://w3.lamdong.gov.vn/sites/sxd",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["sxd", "xây dựng", "sở xây dựng", "xay dung", "so xay dung", "quy hoạch", "giấy phép xây dựng", "bất động sản"]
  },
  svhttdl: {
    code: "svhttdl",
    name: "Sở Văn hóa, Thể thao và Du lịch tỉnh Lâm Đồng",
    shortName: "Sở VHTT&DL",
    baseUrl: "https://w3.lamdong.gov.vn/sites/svhttdl",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["svhttdl", "văn hóa", "thể thao", "du lịch", "sở văn hóa", "van hoa", "du lich", "festival hoa"]
  },
  sct: {
    code: "sct",
    name: "Sở Công thương tỉnh Lâm Đồng",
    shortName: "Sở Công thương",
    baseUrl: "https://w3.lamdong.gov.vn/sites/sct",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["sct", "công thương", "sở công thương", "cong thuong", "so cong thuong", "thương mại", "quản lý thị trường", "điện lực"]
  },
  skhcn: {
    code: "skhcn",
    name: "Sở Khoa học và Công nghệ tỉnh Lâm Đồng",
    shortName: "Sở KH&CN",
    baseUrl: "https://w3.lamdong.gov.vn/sites/skhcn",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["skhcn", "khoa học", "công nghệ", "sở khoa học", "khoa hoc cong nghe", "đổi mới sáng tạo"]
  },
  snnptnt: {
    code: "snnptnt",
    name: "Sở Nông nghiệp và Môi trường tỉnh Lâm Đồng",
    shortName: "Sở NN&MT",
    baseUrl: "https://w3.lamdong.gov.vn/sites/snnptnt",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["snnptnt", "snn", "nông nghiệp", "môi trường", "sở nông nghiệp", "lâm nghiệp", "bảo vệ rừng", "trồng trọt"]
  },
  songoaivu: {
    code: "songoaivu",
    name: "Sở Ngoại vụ tỉnh Lâm Đồng",
    shortName: "Sở Ngoại vụ",
    baseUrl: "https://w3.lamdong.gov.vn/sites/songoaivu",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["songoaivu", "sngv", "ngoại vụ", "sở ngoại vụ", "ngoai vu", "so ngoai vu", "hợp tác quốc tế", "biên giới"]
  },
  bandantoc: {
    code: "bandantoc",
    name: "Sở Dân tộc và Tôn giáo tỉnh Lâm Đồng",
    shortName: "Sở Dân tộc & Tôn giáo",
    baseUrl: "https://w3.lamdong.gov.vn/sites/bandantoc",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["bandantoc", "dân tộc", "tôn giáo", "sở dân tộc", "dan toc", "ton giao", "đồng bào"]
  },
  liza: {
    code: "liza",
    name: "Ban Quản lý các Khu công nghiệp tỉnh Lâm Đồng",
    shortName: "BQL Khu CN",
    baseUrl: "https://w3.lamdong.gov.vn/sites/liza",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["liza", "khu công nghiệp", "kcn", "ban quản lý khu công nghiệp", "lộc sơn", "phú hội"]
  },
  bqlgt: {
    code: "bqlgt",
    name: "Ban QLDA Giao thông tỉnh Lâm Đồng",
    shortName: "Ban QLDA Giao thông",
    baseUrl: "https://w3.lamdong.gov.vn/sites/bqlgt",
    listTitle: "Quản lý văn bản",
    type: "so_nganh",
    tier: 2,
    aliases: ["bqlgt", "giao thông", "ban giao thông", "dự án giao thông", "đường bộ", "cao tốc"]
  },

  // === KHỐI ĐỊA PHƯƠNG / CẤP CƠ SỞ (TIER 2 - LIVE SEARCH) ===
  ductrong: {
    code: "ductrong",
    name: "UBND Xã Đức Trọng (cụm huyện Đức Trọng)",
    shortName: "Đức Trọng",
    baseUrl: "https://w3.lamdong.gov.vn/sites/ductrong",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["ductrong", "đức trọng", "duc trong", "huyện đức trọng", "xã đức trọng"]
  },
  dilinh: {
    code: "dilinh",
    name: "UBND Xã Gia Hiệp (cụm huyện Di Linh)",
    shortName: "Di Linh",
    baseUrl: "https://w3.lamdong.gov.vn/sites/dilinh",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["dilinh", "di linh", "huyện di linh", "gia hiệp", "xã gia hiệp"]
  },
  dateh: {
    code: "dateh",
    name: "UBND Xã Đạ Tẻh 3 (cụm huyện Đạ Tẻh)",
    shortName: "Đạ Tẻh",
    baseUrl: "https://w3.lamdong.gov.vn/sites/dateh",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["dateh", "đạ tẻh", "da teh", "huyện đạ tẻh", "đạ tẻh 3"]
  },
  dalat: {
    code: "dalat",
    name: "UBND Thành phố Đà Lạt (cũ)",
    shortName: "TP Đà Lạt",
    baseUrl: "https://w3.lamdong.gov.vn/sites/dalat",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["dalat", "đà lạt", "da lat", "tp đà lạt", "thành phố đà lạt"]
  },
  baoloc: {
    code: "baoloc",
    name: "UBND Thành phố Bảo Lộc (cũ)",
    shortName: "TP Bảo Lộc",
    baseUrl: "https://w3.lamdong.gov.vn/sites/baoloc",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["baoloc", "bảo lộc", "bao loc", "tp bảo lộc", "thành phố bảo lộc"]
  },
  donduong: {
    code: "donduong",
    name: "UBND Huyện Đơn Dương (cũ)",
    shortName: "Đơn Dương",
    baseUrl: "https://w3.lamdong.gov.vn/sites/donduong",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["donduong", "đơn dương", "don duong", "huyện đơn dương"]
  },
  lacduong: {
    code: "lacduong",
    name: "UBND Huyện Lạc Dương (cũ)",
    shortName: "Lạc Dương",
    baseUrl: "https://w3.lamdong.gov.vn/sites/lacduong",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["lacduong", "lạc dương", "lac duong", "huyện lạc dương"]
  },
  lamha: {
    code: "lamha",
    name: "UBND Huyện Lâm Hà (cũ)",
    shortName: "Lâm Hà",
    baseUrl: "https://w3.lamdong.gov.vn/sites/lamha",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["lamha", "lâm hà", "lam ha", "huyện lâm hà"]
  },
  damrong: {
    code: "damrong",
    name: "UBND Huyện Đam Rông (cũ)",
    shortName: "Đam Rông",
    baseUrl: "https://w3.lamdong.gov.vn/sites/damrong",
    listTitle: "Quản lý văn bản 1",
    type: "dia_phuong",
    tier: 2,
    aliases: ["damrong", "đam rông", "dam rong", "huyện đam rông"]
  },
  baolam: {
    code: "baolam",
    name: "UBND Huyện Bảo Lâm (cũ)",
    shortName: "Bảo Lâm",
    baseUrl: "https://w3.lamdong.gov.vn/sites/baolam",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["baolam", "bảo lâm", "bao lam", "huyện bảo lâm"]
  },
  dahuoai: {
    code: "dahuoai",
    name: "UBND Huyện Đạ Huoai (cũ)",
    shortName: "Đạ Huoai",
    baseUrl: "https://w3.lamdong.gov.vn/sites/dahuoai",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["dahuoai", "đạ huoai", "da huoai", "huyện đạ huoai"]
  },
  cattien: {
    code: "cattien",
    name: "UBND Huyện Cát Tiên (cũ)",
    shortName: "Cát Tiên",
    baseUrl: "https://w3.lamdong.gov.vn/sites/cattien",
    listTitle: "Quản lý văn bản",
    type: "dia_phuong",
    tier: 2,
    aliases: ["cattien", "cát tiên", "cat tien", "huyện cát tiên"]
  },

  // === KHỐI CỔNG VĂN BẢN NGOÀI SHAREPOINT ===
  sgd_edu: {
    code: "sgd_edu",
    name: "Sở Giáo dục và Đào tạo tỉnh Lâm Đồng",
    shortName: "Sở GD&ĐT",
    baseUrl: "https://lamdong.edu.vn/vi/sgd-van-ban/?param=sgd_document",
    listTitle: "Cổng Văn bản Giáo dục",
    type: "khac",
    tier: 2,
    aliases: ["sgd_edu", "giáo dục", "sở giáo dục", "giao duc", "so giao duc", "học sinh", "giáo viên", "trường học"]
  }
};

/**
 * Tìm kiếm cấu hình cơ quan dựa trên từ khóa hoặc tên người dùng nhập.
 */
export function resolveAgency(input: string | undefined): AgencyConfig | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  
  // 1. Khớp chính xác code
  if (AGENCY_REGISTRY[normalized]) {
    return AGENCY_REGISTRY[normalized];
  }

  // 2. Khớp trong alias hoặc tên viết tắt / tên đầy đủ
  for (const cfg of Object.values(AGENCY_REGISTRY)) {
    if (cfg.aliases.some(a => normalized === a || normalized.includes(a) || a.includes(normalized))) {
      return cfg;
    }
    if (cfg.name.toLowerCase().includes(normalized) || cfg.shortName.toLowerCase().includes(normalized)) {
      return cfg;
    }
  }

  return null;
}

/**
 * Lấy danh sách các cơ quan thuộc Tier 1 (Đồng bộ cốt lõi định kỳ).
 */
export function getTier1Agencies(): AgencyConfig[] {
  return Object.values(AGENCY_REGISTRY).filter(a => a.tier === 1);
}

/**
 * Lấy toàn bộ danh sách cơ quan được hỗ trợ.
 */
export function getAllAgencies(): AgencyConfig[] {
  return Object.values(AGENCY_REGISTRY);
}

/**
 * Lấy cấu hình cơ quan theo mã code.
 */
export function getAgencyConfig(code: string): AgencyConfig | undefined {
  return AGENCY_REGISTRY[code];
}
