#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import docx

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from scripts.edit_phieu_trinh_template import fill_phieu_trinh

bc559_data = {
    "so_ky_hieu": "07-10/26/PT-NC",
    "van_ban_trinh": "Báo cáo số 559/BC-STP ngày 02/10/2026 của Sở Tư pháp và Công văn số 2182/BQLDA3-KHTĐ ngày 29/9/2026 của Ban Quản lý dự án ĐTXD số 3.",
    "trich_yeu": "Nội dung liên quan đến Công văn số 16064/UBND-NC ngày 23/9/2026 về việc xử lý Tờ trình số 245/TTr-STP của Sở Tư pháp.",
    "cac_co_quan_trinh": "Sở Tư pháp.",
    "tham_quyen": "Chủ tịch Ủy ban nhân dân tỉnh.",
    "de_xuat_phuong_an": (
        "Lĩnh vực xây dựng, quy hoạch và ban hành văn bản quy phạm pháp luật do Phó Chủ tịch UBND tỉnh phụ trách; "
        "Căn cứ chức năng, nhiệm vụ, lĩnh vực phụ trách và kết quả rà soát Báo cáo số 559/BC-STP của Sở Tư pháp, "
        "Công văn số 2182/BQLDA3-KHTĐ của Ban Quản lý dự án ĐTXD số 3, Phòng Nội chính nhận thấy:\n\n"
        "- Việc Sở Tư pháp đề xuất giao Ban Quản lý dự án ĐTXD số 1, số 2, số 3 là cơ quan chủ trì soạn thảo văn bản quy phạm pháp luật "
        "và ký Tờ trình trình UBND tỉnh ban hành Quyết định quy phạm pháp luật là CHƯA PHÙ HỢP với Luật Ban hành văn bản quy phạm pháp luật "
        "năm 2025 và Luật Tổ chức chính quyền địa phương năm 2025 (do các Ban Quản lý dự án là đơn vị sự nghiệp công lập trực thuộc UBND tỉnh, "
        "không có chức năng tham mưu quản lý nhà nước nên không đủ tư cách pháp lý đứng tên ký Tờ trình trình UBND tỉnh ban hành văn bản quy phạm pháp luật).\n\n"
        "- Căn cứ Luật Kiến trúc năm 2019 và Nghị định số 85/2020/NĐ-CP, cần phân định rõ:\n"
        "  + Ban Quản lý dự án ĐTXD số 1, 2, 3 là cơ quan lập đồ án Quy chế quản lý kiến trúc (chịu trách nhiệm về hồ sơ kỹ thuật, bản vẽ, khảo sát, dự toán).\n"
        "  + Sở Xây dựng là cơ quan quản lý nhà nước chuyên ngành, có trách nhiệm chủ trì soạn thảo văn bản quy phạm pháp luật, tiếp nhận hồ sơ đồ án từ các Ban QLDA, "
        "lấy ý kiến các cơ quan, gửi Sở Tư pháp thẩm định và ký Tờ trình trình UBND tỉnh xem xét, ban hành (thực tế ngày 24/9/2026, Ban QLDA 3 đã có Tờ trình số 2131/TTr-BQLDA3 "
        "trình Sở Xây dựng thẩm định đồ án Quy chế kiến trúc Gia Nghĩa).\n\n"
        "Chuyên viên đề xuất Chánh Văn phòng UBND tỉnh ký thừa lệnh Chủ tịch UBND tỉnh Công văn giải quyết dứt điểm các nội dung liên quan:\n"
        "1. Không chấp thuận đề xuất của Sở Tư pháp về việc giao các Ban Quản lý dự án ĐTXD số 1, số 2, số 3 làm cơ quan chủ trì soạn thảo văn bản quy phạm pháp luật.\n"
        "2. Giao Sở Xây dựng là cơ quan chủ trì soạn thảo văn bản quy phạm pháp luật; tiếp nhận hồ sơ kỹ thuật đồ án Quy chế kiến trúc từ các Ban QLDA để hoàn thiện hồ sơ dự thảo Quyết định quy phạm pháp luật, gửi Sở Tư pháp thẩm định và ký Tờ trình trình UBND tỉnh ban hành.\n"
        "3. Giao Ban QLDA ĐTXD số 1, số 2, số 3 bàn giao toàn bộ hồ sơ kỹ thuật đồ án cho Sở Xây dựng và phối hợp hoàn thiện; không đứng tên chủ trì soạn thảo thể chế.\n"
        "4. Giao Sở Tư pháp khẩn trương hoàn chỉnh lại dự thảo Quyết định ban hành Danh mục văn bản quy phạm pháp luật quy định chi tiết theo đúng thẩm quyền nêu trên, trình UBND tỉnh trước ngày 20/10/2026.\n\n"
        "(Kèm theo dự thảo Công văn chỉ đạo của UBND tỉnh). Kính trình./."
    ),
    "chuyen_vien": "Trương Hải Châu",
    "lanh_dao_phong": "Lương Thị Nguyệt Thành",
    "lanh_dao_vp": "Trần Thanh Toàn",
    "lanh_dao_tinh": "Đinh Văn Tuấn",
    "ngay_thang": "Ngày 07 tháng 10 năm 2026",
    "do_mat": "Không",
}

out_path = os.path.join(os.path.dirname(__file__), "..", "bosung", "Phieu_trinh_BC_559_co_ke_o_chuan.docx")
fill_phieu_trinh(bc559_data, out_path)
print("✅ Đã xuất file Phiếu trình có kẻ ô chuẩn 100% tại:", out_path)
