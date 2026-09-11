export type QpplDoc = {
  id: number;
  /** Số/Ký hiệu văn bản (VD: "15260/UBND-KGVX", "370/BC-KTNS") */
  soKyHieu: string;
  /** Trích yếu nội dung */
  trichYeu: string;
  /** Loại văn bản: Công văn, Quyết định, Nghị quyết, Báo cáo, Chỉ thị... */
  loaiVanBan: string;
  /** Cơ quan ban hành */
  coQuanBanHanh: string;
  /** Lĩnh vực */
  linhVuc: string;
  /** Hiệu lực: "Còn" | "Hết" */
  hieuLuc: string;
  /** Ngày ban hành (ISO date) */
  ngayBanHanh: string;
  /** Nguồn dữ liệu: "ubnd" | "hdnd" */
  nguon: string;
  /** JSON array chứa link file: [{name: string, url: string}] */
  fileUrls: string;
  /** Đường dẫn file đã tải trên đĩa (relative to dataDir) */
  localPath: string | null;
  /** Kích thước file đã tải (bytes) */
  fileSize: number;
  /** SharePoint item ID */
  spId: number | null;
  modifiedAt: string;
  createdAt: string;
};

/**
 * Cấu trúc raw item từ SharePoint REST API cho văn bản chỉ đạo.
 *
 * Tên cột SharePoint mã hóa Unicode vì tiêu đề cột tiếng Việt:
 * - `S_x1ed1__x002f_K_x00fd__x0020_hi` = Số/Ký hiệu
 * - `Ng_x00e0_y` = Ngày
 * - `Lo_x1ea1_i_x0020_v_x0103_n_x0020` = Loại văn bản
 * - `C_x01a1__x0020_quan_x0020_ban_x0` = Cơ quan ban hành
 * - `Tr_x00ed_ch_x0020_y_x1ebf_u` = Trích yếu
 * - `L_x0129_nh_x0020_V_x1ef1_c` = Lĩnh vực
 * - `Hi_x1ec7_u_x0020_l_x1ef1_c` = Hiệu lực
 * - `Ng_x01b0__x1edd_i_x0020_k_x00fd_` = Người ký
 */
export type QpplRawItem = {
  ID?: number;
  Title?: string;
  /* eslint-disable @typescript-eslint/naming-convention */
  S_x1ed1__x002f_K_x00fd__x0020_hi?: string;
  Ng_x00e0_y?: string;
  Lo_x1ea1_i_x0020_v_x0103_n_x0020?: string;
  C_x01a1__x0020_quan_x0020_ban_x0?: string;
  Tr_x00ed_ch_x0020_y_x1ebf_u?: string;
  L_x0129_nh_x0020_V_x1ef1_c?: string;
  Hi_x1ec7_u_x0020_l_x1ef1_c?: string;
  Ng_x01b0__x1edd_i_x0020_k_x00fd_?: string;
  Urls?: string;
  Modified?: string;
  Created?: string;
  /* eslint-enable @typescript-eslint/naming-convention */
};

export type QpplFileLink = {
  name: string;
  url: string;
};

export type QpplSyncResult = {
  totalScanned: number;
  newInserted: number;
  updated: number;
  errors: number;
};

/** Nguồn dữ liệu: UBND tỉnh hoặc HĐND tỉnh */
export type QpplNguon = "ubnd" | "hdnd";
