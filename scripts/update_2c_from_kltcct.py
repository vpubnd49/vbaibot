import docx
import copy
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

template_path = 'bosung/lylich/2C_converted.docx'
output_docx = 'bosung/lylich/2C_TruongHaiChau.docx'

doc = docx.Document(template_path)

def set_para_text(p, text):
    p.text = text
    for r in p.runs:
        r.font.name = 'Times New Roman'

# P4: 1) Họ và tên khai sinh: 	
set_para_text(doc.paragraphs[4], "1) Họ và tên khai sinh: TRƯƠNG HẢI CHÂU")
# P5: 2) Các tên gọi khác: 	
set_para_text(doc.paragraphs[5], "2) Các tên gọi khác: Không")
# P6: 3) Ngày, tháng, năm sinh: .............../.…....../............. 4) Giới tính: 	
set_para_text(doc.paragraphs[6], "3) Ngày, tháng, năm sinh: 24/04/1981       4) Giới tính: Nam")
# P7: 5) Nơi đăng ký khai sinh: 	
set_para_text(doc.paragraphs[7], "5) Nơi đăng ký khai sinh: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)")
# P8: 6) Quê quán: 	
set_para_text(doc.paragraphs[8], "6) Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)")
# P9: 7) Nơi thường trú :	
set_para_text(doc.paragraphs[9], "7) Nơi thường trú: 25/1 Võ Liêm Sơn, Tổ 4, Khu phố 11, phường Phú Thủy, tỉnh Lâm Đồng")
# P10: Nơi ở hiện nay :	
set_para_text(doc.paragraphs[10], "Nơi ở hiện nay: 25/1 Võ Liêm Sơn, Tổ 4, Khu phố 11, phường Phú Thủy, tỉnh Lâm Đồng")
# P11: Số thuê bao di động:	
set_para_text(doc.paragraphs[11], "Số thuê bao di động: 0911 667 209")
# P12: 8) Dân tộc:……………………… 9) Tôn giáo:	 
set_para_text(doc.paragraphs[12], "8) Dân tộc: Kinh                   9) Tôn giáo: Không")
# P13: 10) Số Căn cước/Hộ chiếu: ………….…............…., ngày cấp….../...../.........., nơi cấp………….. 
set_para_text(doc.paragraphs[13], "10) Số Căn cước/Hộ chiếu: 060081000276, ngày cấp: 15/08/2025, nơi cấp: Bộ Công an")
# P14: 11) Cấp ủy hiện tại: ..............…......………………………………………………………………...
set_para_text(doc.paragraphs[14], "11) Cấp ủy hiện tại: Chi bộ Nội chính, Đảng bộ Văn phòng UBND tỉnh Lâm Đồng")
# P15: 12) Cấp ủy kiêm nhiệm: ....................................................................................................................
set_para_text(doc.paragraphs[15], "12) Cấp ủy kiêm nhiệm: Không")
# P16: 13) Chức vụ hiện tại: ………............................................................................................................
set_para_text(doc.paragraphs[16], "13) Chức vụ hiện tại: Chuyên viên Phòng Nội chính, Văn phòng Ủy ban nhân dân tỉnh Lâm Đồng")
# P17: Ngày bổ nhiệm giữ chức vụ/ngày phê chuẩn, chuẩn y:….../.…./…...; Ngày bổ nhiệm lại ……./…./……..
set_para_text(doc.paragraphs[17], "Ngày bổ nhiệm giữ chức vụ/ngày phê chuẩn, chuẩn y: 01/07/2025; Ngày bổ nhiệm lại: Không")
# P18: 14) Chức vụ kiêm nhiệm: 		
set_para_text(doc.paragraphs[18], "14) Chức vụ kiêm nhiệm: Không")
# P19: 15) Nghề nghiệp trước khi được tuyển dụng: …….................................................……………......
set_para_text(doc.paragraphs[19], "15) Nghề nghiệp trước khi được tuyển dụng: Cán bộ Tin học Tổ chức Phi chính phủ Vietnam Plus (Pháp) - Dự án khu vực Đức Linh, Tánh Linh")
# P20: 16) Ngày được tuyển dụng lần đầu:....../….../..........; Cơ quan tuyển dụng:.....................................
set_para_text(doc.paragraphs[20], "16) Ngày được tuyển dụng lần đầu: 05/05/2009; Cơ quan tuyển dụng: Sở Nội vụ tỉnh Bình Thuận (cũ)")
# P21: Ngày được tuyển dụng lần sau (nếu có) ........./….../..........; Cơ quan tuyển dụng:..........................
set_para_text(doc.paragraphs[21], "Ngày được tuyển dụng lần sau (nếu có): Không; Cơ quan tuyển dụng: Không")
# P22: 17) Ngày vào cơ quan hiện đang công tác: .......................................................................................
set_para_text(doc.paragraphs[22], "17) Ngày vào cơ quan hiện đang công tác: 01/07/2025 (Văn phòng UBND tỉnh Lâm Đồng; trước đó từ 02/2010 tại VP UBND tỉnh Bình Thuận)")
# P23: 18) Ngày vào Đảng Cộng sản Việt Nam:........./.........../........Ngày chính thức: ......../..…...../.......
set_para_text(doc.paragraphs[23], "18) Ngày vào Đảng Cộng sản Việt Nam: 13/06/2017; Ngày chính thức: 13/06/2018")
# P24: 19) Ngày nhập ngũ: ....../….../…; Ngày xuất ngũ: ...../...../.....; Quân hàm, chức vụ cao nhất (năm): ....
set_para_text(doc.paragraphs[24], "19) Ngày nhập ngũ: Không; Ngày xuất ngũ: Không; Quân hàm, chức vụ cao nhất: Không")
# P25: 20) Đối tượng chính sách:………….………………………………………………………………
set_para_text(doc.paragraphs[25], "20) Đối tượng chính sách: Không")
# P26: 21) Trình độ học vấn: 
# P27: - Giáo dục phổ thông: ........................................... 	- Chuyên môn, nghiệp vụ: ....................
set_para_text(doc.paragraphs[27], "- Giáo dục phổ thông: 12/12                  - Chuyên môn, nghiệp vụ: Thạc sĩ Luật kinh tế")
# P28: - Lý luận chính trị: ...............................................	           - Học hàm, học vị cao nhất: ...................
set_para_text(doc.paragraphs[28], "- Lý luận chính trị: Sơ cấp                 - Học hàm, học vị cao nhất: Thạc sĩ")
# P29: - Ngoại ngữ: ............................ - Tin học:…………       - Tiếng dân tộc thiểu số: ..........................
set_para_text(doc.paragraphs[29], "- Ngoại ngữ: Tiếng Anh - B1       - Tin học: Trung cấp Công nghệ máy tính       - Tiếng dân tộc thiểu số: Không")
# P30: - Quản lý nhà nước:…………..  - Bồi dưỡng chức danh nghề nghiệp: …….……………….…….........	
set_para_text(doc.paragraphs[30], "- Quản lý nhà nước: Chuyên viên               - Bồi dưỡng chức danh nghề nghiệp: Chuyên viên")
# P31: 22) Ngạch, chức danh nghề nghiệp: ...................................... Mã số: ……………………………..
set_para_text(doc.paragraphs[31], "22) Ngạch, chức danh nghề nghiệp: Chuyên viên                    Mã số: 01.003")
# P32: Bậc lương: ....... Hệ số: ........ Ngày hưởng ....../....../......... Sổ BHXH:……… Số thẻ BHYT: ……
set_para_text(doc.paragraphs[32], "Bậc lương: 4       Hệ số: 3.33       Ngày hưởng: 01/06/2023       Sổ BHXH: 6010009233       Số thẻ BHYT: Đã cấp theo BHXH")
# P33: Phụ cấp chức vụ: …………. Phụ cấp kiêm nhiệm: ……………. Phụ cấp khác: …………………
set_para_text(doc.paragraphs[33], "Phụ cấp chức vụ: Không        Phụ cấp kiêm nhiệm: Không        Phụ cấp khác: Không")
# P34: 23) Sở trường công tác: .......................... Công việc đã làm lâu nhất: .............................................
set_para_text(doc.paragraphs[34], "23) Sở trường công tác: Công nghệ thông tin, Kiểm soát TTHC, Nội chính       Công việc đã làm lâu nhất: Kiểm soát thủ tục hành chính, Quản trị - Tài vụ")
# P35: 24) Danh hiệu được phong (Năm nào): …............…………………….………...............................
set_para_text(doc.paragraphs[35], "24) Danh hiệu được phong (Năm nào): Không")
# P36: 25) Tài khoản mạng xã hội: …………….............……...…..……..............................................................
set_para_text(doc.paragraphs[36], "25) Tài khoản mạng xã hội: Không")

# TABLE 0: Quá trình làm việc, học tập trước khi tuyển dụng
t0 = doc.tables[0]
t0.rows[1].cells[0].text = "1981 - 2000"
t0.rows[1].cells[1].text = "Còn nhỏ, ở với gia đình tại Phú Thủy, Phan Thiết; học Tiểu học Phú Thủy, THCS Nguyễn Trãi, PTTH Phan Chu Trinh"
t0.rows[2].cells[0].text = "01/2001 - 01/2003"
t0.rows[2].cells[1].text = "Học Công nghệ máy tính tại Trung tâm Phát triển Công nghệ thông tin - Đại học Quốc gia TP. Hồ Chí Minh"

# Thêm hàng cho giai đoạn Vietnam Plus
new_r = copy.deepcopy(t0.rows[2]._tr)
t0._tbl.append(new_r)
t0.rows[3].cells[0].text = "01/2003 - 04/2009"
t0.rows[3].cells[1].text = "Cán bộ Tin học Tổ chức Phi chính phủ Vietnam Plus (Pháp) - Dự án khu vực huyện Đức Linh, Tánh Linh"

# TABLE 1: Quá trình công tác từ khi tuyển dụng đến nay
t1 = doc.tables[1]
work_history = [
    ("02/2010 - 01/2013", "Tuyển dụng - Công chức - Cán sự - Phòng Hành chính - Tổ chức, Văn phòng UBND tỉnh Bình Thuận"),
    ("01/2013 - 08/2017", "Điều động - Cán sự - Ban Tiếp công dân, Văn phòng UBND tỉnh Bình Thuận"),
    ("09/2017 - 03/2021", "Điều động - Cán sự - Phòng Quản trị - Tài vụ, Văn phòng UBND tỉnh Bình Thuận"),
    ("03/2021 - 09/2024", "Bổ nhiệm ngạch - Chuyên viên - Phòng Quản trị - Tài vụ, Văn phòng UBND tỉnh Bình Thuận"),
    ("10/2024 - 06/2025", "Chuyên viên - Phòng Nội chính và Kiểm soát thủ tục hành chính, Văn phòng UBND tỉnh Bình Thuận"),
    ("07/2025 - nay", "Chuyên viên - Phòng Nội chính, Văn phòng Ủy ban nhân dân tỉnh Lâm Đồng")
]
for i, (period, job) in enumerate(work_history):
    if i + 1 < len(t1.rows):
        t1.rows[i+1].cells[0].text = period
        t1.rows[i+1].cells[1].text = job
    else:
        new_tr = copy.deepcopy(t1.rows[1]._tr)
        t1._tbl.append(new_tr)
        t1.rows[-1].cells[0].text = period
        t1.rows[-1].cells[1].text = job

# TABLE 2: Đào tạo, bồi dưỡng
t2 = doc.tables[2]
education = [
    ("Trung tâm Phát triển CNTT - ĐHQG TP.HCM", "Công nghệ máy tính", "01/2001 - 01/2003", "Tập trung", "Trung cấp"),
    ("Trường Đại học Mở TP. Hồ Chí Minh", "Luật kinh tế", "01/2009 - 04/2013", "Từ xa", "Cử nhân"),
    ("Trường Chính trị tình Bình Thuận", "Quản lý nhà nước", "05/2018 - 07/2018", "Vừa làm vừa học", "Chứng chỉ ngạch Chuyên viên"),
    ("Trường Đại học Hòa Bình", "Luật kinh tế", "12/2019 - 12/2021", "Không tập trung", "Thạc sĩ"),
    ("Trường Đại học Trà Vinh", "Tiếng Anh", "2020", "Tập trung", "Chứng chỉ Tiếng Anh - B1"),
    ("Cơ sở đào tạo lý luận chính trị", "Lý luận chính trị", "Trước 2026", "Tập trung/VLVH", "Sơ cấp")
]
for i, row_data in enumerate(education):
    if i + 1 < len(t2.rows):
        for c_idx in range(5):
            t2.rows[i+1].cells[c_idx].text = row_data[c_idx]
    else:
        new_tr = copy.deepcopy(t2.rows[1]._tr)
        t2._tbl.append(new_tr)
        for c_idx in range(5):
            t2.rows[-1].cells[c_idx].text = row_data[c_idx]

# TABLE 3: Khen thưởng
t3 = doc.tables[3]
t3.rows[1].cells[0].text = "Không"
t3.rows[1].cells[1].text = ""
t3.rows[1].cells[2].text = ""
t3.rows[1].cells[3].text = ""

# TABLE 4: Kỷ luật
t4 = doc.tables[4]
t4.rows[1].cells[0].text = "2013"
t4.rows[1].cells[1].text = "Quyết định kỷ luật"
t4.rows[1].cells[2].text = "Khiển trách"
t4.rows[1].cells[3].text = "Vi phạm kỷ luật hành chính cơ quan"

# TABLE 5: Lương
t5 = doc.tables[5]
t5.rows[2].cells[0].text = "01/06/2023" # Từ
t5.rows[2].cells[1].text = "nay"        # Đến
t5.rows[2].cells[2].text = "01.003"     # Mã số
t5.rows[2].cells[3].text = "4"          # Bậc lương
t5.rows[2].cells[4].text = "3.33"       # Hệ số
t5.rows[2].cells[5].text = ""           # Tiền lương

# TABLE 6: Quan hệ gia đình bản thân: Cha, Mẹ, Người nuôi dưỡng
t6 = doc.tables[6]
t6.rows[1].cells[1].text = """- Họ và tên: TRƯƠNG VĂN BA
- Ngày, tháng, năm sinh: 1954
- Số căn cước: 060054000240, ngày cấp: 31/03/2021, nơi cấp: Cục Cảnh sát QLHC về TTXH
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Liêm, tỉnh Bình Thuận (nay là xã Hàm Liêm, tỉnh Lâm Đồng)
- Nơi ở hiện nay: Đã mất năm 2025
- Quá trình hoạt động: 1964-1970: Học văn hóa; 1970-1974: Học nghề điện lạnh tại Phan Thiết; Tháng 10/1974 - 4/1975: Bị địch bắt đi quân dịch (nghĩa quân viên sửa điện lạnh); Tháng 5/1975 - 12/1993: Công tác tại Công ty Chiếu bóng Thuận Hải; sau đó thôi việc làm thợ điện lạnh tại nhà cho đến khi mất năm 2025
- Thái độ chính trị: Chấp hành tốt chính sách pháp luật sau ngày giải phóng
- Tiền án: Không"""

t6.rows[2].cells[1].text = """- Họ và tên: NGÔ THỊ MỸ DUNG
- Ngày, tháng, năm sinh: 1959
- Số căn cước: 060159000364, ngày cấp: 13/03/2022, nơi cấp: Cục Cảnh sát QLHC về TTXH
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Nhơn, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)
- Nơi thường trú: 25/1 Võ Liêm Sơn, Tổ 4, KP 11, phường Phú Thủy, tỉnh Lâm Đồng
- Nơi ở hiện nay: 25/1 Võ Liêm Sơn, Tổ 4, KP 11, phường Phú Thủy, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Trước 1975 học văn hóa; 1976-1992 công tác tại Sở Nông nghiệp tỉnh Thuận Hải; 1992 đến nay nghỉ thôi việc làm nội trợ tại nhà
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Liên quan đến chế độ cũ (nếu có): Không
- Tiền án (nếu có): Không"""

t6.rows[3].cells[1].text = "Không có (do cha mẹ ruột trực tiếp nuôi dưỡng)"

# TABLE 7: Vợ / chồng, con
t7 = doc.tables[7]
t7.rows[1].cells[1].text = """- Họ và tên: TRẦN THỊ HẢI YẾN
- Ngày, tháng, năm sinh: 1982
- Số căn cước: 060182009361, ngày cấp: 10/02/2021, nơi cấp: Cục Cảnh sát QLHC về TTXH
- Dân tộc: Kinh; Tôn giáo: Không; Đảng viên Đảng CSVN
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là xã Hàm Liêm, tỉnh Lâm Đồng)
- Nơi thường trú: 19 Lâm Đình Trúc, Tổ 3, KP 6, phường Phú Thủy, tỉnh Lâm Đồng
- Nơi ở hiện nay: 19 Lâm Đình Trúc, Tổ 3, KP 6, phường Phú Thủy, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Giám đốc Dịch vụ - Ngân hàng Quân đội (MB) Chi nhánh Bình Thuận
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không
- Năm kết hôn: Đã đăng ký kết hôn theo quy định"""

# Con 1
t7.rows[2].cells[0].text = "Con gái (đầu)"
t7.rows[2].cells[1].text = """- Họ và tên: TRƯƠNG NGỌC GIA LINH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 2012
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)
- Nơi thường trú: Hẻm 161 Đặng Văn Lãnh, phường Bình Thuận, tỉnh Lâm Đồng
- Nơi ở hiện nay: Hẻm 161 Đặng Văn Lãnh, phường Bình Thuận, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Học sinh Trường THCS Quang Trung, phường Xuân Hương - Đà Lạt, tỉnh Lâm Đồng
- Thái độ chính trị: Chấp hành tốt chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""

# Con 2
new_tr = copy.deepcopy(t7.rows[2]._tr)
t7._tbl.append(new_tr)
row_con2 = t7.rows[3]
row_con2.cells[0].text = "Con gái (thứ hai)"
row_con2.cells[1].text = """- Họ và tên: TRƯƠNG HẢI NHƯ; Giới tính: Nữ
- Ngày, tháng, năm sinh: 2024
- Số định danh cá nhân: Đã đăng ký khai sinh theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)
- Nơi thường trú: 19 Lâm Đình Trúc, Tổ 3, KP 6, phường Phú Thủy, tỉnh Lâm Đồng
- Nơi ở hiện nay: 19 Lâm Đình Trúc, Tổ 3, KP 6, phường Phú Thủy, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Học mầm non tại Trường Mầm non Bé Hạnh Phúc, phường Phú Thủy, tỉnh Lâm Đồng
- Thái độ chính trị: Còn nhỏ
- Tiền án (nếu có): Không"""

# TABLE 8: Anh/Chị/Em ruột của bản thân
t8 = doc.tables[8]
t8.rows[1].cells[0].text = "Em trai"
t8.rows[1].cells[1].text = """- Họ và tên: TRƯƠNG HẢI LÂM; Giới tính: Nam
- Ngày, tháng, năm sinh: 1984
- Số căn cước: Đã cấp theo quy định
- Quốc tịch: Việt Nam; Đảng viên Đảng CSVN
- Nơi thường trú: 25/1 Võ Liêm Sơn, phường Phú Thủy, tỉnh Lâm Đồng
- Nơi ở hiện nay: Đoàn An Điều dưỡng 198, Lữ Gia, Lâm Viên - Đà Lạt, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Công chức - Phó Chánh Văn phòng Sở Công Thương tỉnh Lâm Đồng
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""

# TABLE 9: Cha, mẹ đẻ của vợ
t9 = doc.tables[9]
t9.rows[1].cells[1].text = """- Họ và tên: TRẦN MINH CHÁNH
- Ngày, tháng, năm sinh: 1929; Mất năm 2017
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam; Đảng viên 60 năm tuổi Đảng (nhận Huy hiệu Đảng 19/05/2010)
- Quê quán: Xã Hàm Hiệp, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Bình Thuận, tỉnh Lâm Đồng)
- Quá trình hoạt động: Trước CMT8 lệ thuộc gia đình; 08/1947 - 04/1954: Gia nhập quân đội kháng chiến chống Pháp, từ đội viên lên cán bộ đại đội, chi ủy viên đại đội C, E812; 07/1954 - 05/1967: Học Trung cấp nông nghiệp và Đại học nông nghiệp; 06/1967 - 11/1975: Công tác tại Viện Cây lương thực - Thực phẩm; 12/1975 - 12/1995: Công tác tại Ty Nông nghiệp Bình Thuận; 1996 đến khi mất: Nghỉ hưu
- Khen thưởng: Huân chương chiến thắng hạng 3; Huân chương kháng chiến hạng nhất; Bằng khen của Chủ tịch Hội đồng Bộ trưởng (QĐ 249/CTKT ngày 10/9/1986); Huân chương Lao động hạng 3 (QĐ 872 KT/CP ngày 21/5/1996); Giải thưởng nghiên cứu khoa học cấp Nhà nước
- Thái độ chính trị: Suốt đời cống hiến cho cách mạng và Đảng CSVN
- Liên quan đến chế độ cũ (nếu có): Không; Tiền án: Không"""

t9.rows[2].cells[1].text = """- Họ và tên: NGUYỄN THỊ LIỄU
- Ngày, tháng, năm sinh: 1957
- Số căn cước: 060157003324, ngày cấp: 04/05/2021, nơi cấp: Cục Cảnh sát QLHC về TTXH
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Nhơn, huyện Hàm Thuận Bắc, tỉnh Bình Thuận (nay là phường Hàm Thắng, tỉnh Lâm Đồng)
- Nơi thường trú: 19 Lâm Đình Trúc, phường Phú Thủy, tỉnh Lâm Đồng
- Nơi ở hiện nay: 19 Lâm Đình Trúc, phường Phú Thủy, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Trước 1975 học PTTH Phan Bội Châu; 1976-1977 học Trường Nông nghiệp Thuận Hải; 1977-1992 công tác tại Trại giống lúa Ma Lâm; 1992-2007 công tác tại Sở Nông nghiệp và PTNT Bình Thuận; 2007 đến nay nghỉ hưu
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Liên quan đến chế độ cũ (nếu có): Không; Tiền án: Không"""

t9.rows[3].cells[1].text = "Không có"

# TABLE 10: Anh/Chị/Em ruột của vợ
t10 = doc.tables[10]
siblings_vo = [
    ("Anh trai vợ", """- Họ và tên: TRẦN HẢI THUẬN; Giới tính: Nam
- Ngày, tháng, năm sinh: 1971
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi ở hiện nay: Phường Phú Nhuận, Thành phố Hồ Chí Minh
- Nghề nghiệp, nơi làm việc: Hưu trí
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ MỸ LINH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1952
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi ở hiện nay: Xã Hàm Liêm, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Nội trợ
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ HẢI BÌNH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1969
- Quốc tịch: Việt Nam; Đảng viên Đảng CSVN
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi ở hiện nay: Phường Bình Thuận, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Hưu trí
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ HẢI VÂN; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1980
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi ở hiện nay: Đoàn An Điều dưỡng 198, Lữ Gia, Lâm Viên - Đà Lạt, tỉnh Lâm Đồng
- Nghề nghiệp, nơi làm việc: Công chức Chi cục Trồng trọt và Bảo vệ thực vật, Sở Nông nghiệp và Môi trường tỉnh Lâm Đồng
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không""")
]

t10.rows[1].cells[0].text = siblings_vo[0][0]
t10.rows[1].cells[1].text = siblings_vo[0][1]

for item in siblings_vo[1:]:
    new_tr = copy.deepcopy(t10.rows[1]._tr)
    t10._tbl.append(new_tr)
    last_row = t10.rows[-1]
    last_row.cells[0].text = item[0]
    last_row.cells[1].text = item[1]

# TABLE 11: Chữ ký
t11 = doc.tables[11]
t11.rows[0].cells[0].text = """Lâm Đồng, ngày 28 tháng 4 năm 2026
Người khai
Tôi xin cam đoan những lời khai trên đây là đúng sự thật
(Ký tên, ghi rõ họ tên)




TRƯƠNG HẢI CHÂU"""

t11.rows[0].cells[1].text = """Lâm Đồng, ngày ...... tháng ....... năm 2026
Xác nhận của cơ quan quản lý cán bộ
(Ký tên, đóng dấu)"""

# Save docx
doc.save(output_docx)
print(f"Successfully generated updated {output_docx} with KLTCCT 2026 data!")
