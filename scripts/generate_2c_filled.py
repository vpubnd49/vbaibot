import docx
from docx.oxml import OxmlElement
import copy
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

template_path = 'bosung/lylich/2C_converted.docx'
output_docx = 'bosung/lylich/2C_TruongHaiChau.docx'

doc = docx.Document(template_path)

def set_para_text(p, text):
    p.text = text
    # Keep font Times New Roman if possible
    for r in p.runs:
        r.font.name = 'Times New Roman'

# Let's inspect and fill paragraphs
# P4: 1) Họ và tên khai sinh: 	
set_para_text(doc.paragraphs[4], "1) Họ và tên khai sinh: TRƯƠNG HẢI CHÂU")
# P5: 2) Các tên gọi khác: 	
set_para_text(doc.paragraphs[5], "2) Các tên gọi khác: Không")
# P6: 3) Ngày, tháng, năm sinh: .............../.…....../............. 4) Giới tính: 	
set_para_text(doc.paragraphs[6], "3) Ngày, tháng, năm sinh: 24/04/1981       4) Giới tính: Nam")
# P7: 5) Nơi đăng ký khai sinh: 	
set_para_text(doc.paragraphs[7], "5) Nơi đăng ký khai sinh: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận")
# P8: 6) Quê quán: 	
set_para_text(doc.paragraphs[8], "6) Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận")
# P9: 7) Nơi thường trú :	
set_para_text(doc.paragraphs[9], "7) Nơi thường trú: Khu phố 11, phường Phú Thủy, thành phố Phan Thiết, tỉnh Bình Thuận")
# P10: Nơi ở hiện nay :	
set_para_text(doc.paragraphs[10], "Nơi ở hiện nay: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, thành phố Phan Thiết, tỉnh Bình Thuận")
# P11: Số thuê bao di động:	
set_para_text(doc.paragraphs[11], "Số thuê bao di động: 0918.xxx.xxx")
# P12: 8) Dân tộc:……………………… 9) Tôn giáo:	 
set_para_text(doc.paragraphs[12], "8) Dân tộc: Kinh                   9) Tôn giáo: Không")
# P13: 10) Số Căn cước/Hộ chiếu: ………….…............…., ngày cấp….../...../.........., nơi cấp………….. 
set_para_text(doc.paragraphs[13], "10) Số Căn cước/Hộ chiếu: 060081000276, ngày cấp: 10/08/2024, nơi cấp: Cục Cảnh sát QLHC về TTXH")
# P14: 11) Cấp ủy hiện tại: ..............…......………………………………………………………………...
set_para_text(doc.paragraphs[14], "11) Cấp ủy hiện tại: Không")
# P15: 12) Cấp ủy kiêm nhiệm: ....................................................................................................................
set_para_text(doc.paragraphs[15], "12) Cấp ủy kiêm nhiệm: Không")
# P16: 13) Chức vụ hiện tại: ………............................................................................................................
set_para_text(doc.paragraphs[16], "13) Chức vụ hiện tại: Chuyên viên Phòng Nội chính và Kiểm soát thủ tục hành chính, Văn phòng Ủy ban nhân dân tỉnh Bình Thuận")
# P17: Ngày bổ nhiệm giữ chức vụ/ngày phê chuẩn, chuẩn y:….../.…./…...; Ngày bổ nhiệm lại ……./…./……..
set_para_text(doc.paragraphs[17], "Ngày bổ nhiệm giữ chức vụ/ngày phê chuẩn, chuẩn y: 01/10/2024; Ngày bổ nhiệm lại: Không")
# P18: 14) Chức vụ kiêm nhiệm: 		
set_para_text(doc.paragraphs[18], "14) Chức vụ kiêm nhiệm: Không")
# P19: 15) Nghề nghiệp trước khi được tuyển dụng: …….................................................……………......
set_para_text(doc.paragraphs[19], "15) Nghề nghiệp trước khi được tuyển dụng: Cán bộ Tin học Tổ chức Phi chính phủ Vietnam Plus (Pháp) - Dự án khu vực Đức Linh, Tánh Linh")
# P20: 16) Ngày được tuyển dụng lần đầu:....../….../..........; Cơ quan tuyển dụng:.....................................
set_para_text(doc.paragraphs[20], "16) Ngày được tuyển dụng lần đầu: 05/05/2009; Cơ quan tuyển dụng: Sở Nội vụ tỉnh Bình Thuận")
# P21: Ngày được tuyển dụng lần sau (nếu có) ........./….../..........; Cơ quan tuyển dụng:..........................
set_para_text(doc.paragraphs[21], "Ngày được tuyển dụng lần sau (nếu có): Không; Cơ quan tuyển dụng: Không")
# P22: 17) Ngày vào cơ quan hiện đang công tác: .......................................................................................
set_para_text(doc.paragraphs[22], "17) Ngày vào cơ quan hiện đang công tác: 01/02/2010 (Văn phòng Ủy ban nhân dân tỉnh Bình Thuận)")
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
set_para_text(doc.paragraphs[28], "- Lý luận chính trị: Không                    - Học hàm, học vị cao nhất: Thạc sĩ")
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
set_para_text(doc.paragraphs[34], "23) Sở trường công tác: Công nghệ thông tin, Kiểm soát TTHC       Công việc đã làm lâu nhất: Kiểm soát thủ tục hành chính, Quản trị - Tài vụ")
# P35: 24) Danh hiệu được phong (Năm nào): …............…………………….………...............................
set_para_text(doc.paragraphs[35], "24) Danh hiệu được phong (Năm nào): Không")
# P36: 25) Tài khoản mạng xã hội: …………….............……...…..……..............................................................
set_para_text(doc.paragraphs[36], "25) Tài khoản mạng xã hội: Không")

# TABLE 0: Quá trình làm việc, học tập trước khi tuyển dụng
t0 = doc.tables[0]
# R1: 01/2001 - 01/2003
t0.rows[1].cells[0].text = "01/2001 - 01/2003"
t0.rows[1].cells[1].text = "Học tập chuyên ngành Công nghệ máy tính tại Trung tâm Phát triển Công nghệ thông tin - Đại học Quốc gia TP. Hồ Chí Minh"
# R2: 01/2003 - 04/2009
t0.rows[2].cells[0].text = "01/2003 - 04/2009"
t0.rows[2].cells[1].text = "Cán bộ Tin học Tổ chức Phi chính phủ Vietnam Plus (Pháp) - Dự án khu vực Đức Linh, Tánh Linh, tỉnh Bình Thuận"

# TABLE 1: Quá trình công tác từ khi tuyển dụng đến nay
t1 = doc.tables[1]
work_history = [
    ("02/2010 - 01/2013", "Tuyển dụng - Công chức - Cán sự - Phòng Hành chính - Tổ chức, Văn phòng UBND tỉnh Bình Thuận"),
    ("01/2013 - 08/2017", "Điều động - Cán sự - Ban Tiếp công dân, Văn phòng UBND tỉnh Bình Thuận"),
    ("09/2017 - 03/2021", "Điều động - Cán sự - Phòng Quản trị - Tài vụ, Văn phòng UBND tỉnh Bình Thuận"),
    ("03/2021 - 09/2024", "Bổ nhiệm ngạch - Chuyên viên - Phòng Quản trị - Tài vụ, Văn phòng UBND tỉnh Bình Thuận"),
    ("10/2024 - nay", "Chuyên viên - Phòng Nội chính và Kiểm soát thủ tục hành chính, Văn phòng UBND tỉnh Bình Thuận")
]
for i, (period, job) in enumerate(work_history):
    t1.rows[i+1].cells[0].text = period
    t1.rows[i+1].cells[1].text = job

# TABLE 2: Đào tạo, bồi dưỡng
t2 = doc.tables[2]
education = [
    ("Trung tâm Phát triển CNTT - ĐHQG TP.HCM", "Công nghệ máy tính", "01/2001 - 01/2003", "Tập trung", "Trung cấp"),
    ("Trường Đại học Mở TP. Hồ Chí Minh", "Luật kinh tế", "01/2009 - 04/2013", "Từ xa", "Cử nhân"),
    ("Trường Chính trị tỉnh Bình Thuận", "Quản lý nhà nước", "05/2018 - 07/2018", "Vừa làm vừa học", "Chứng chỉ ngạch Chuyên viên"),
    ("Trường Đại học Hòa Bình", "Luật kinh tế", "12/2019 - 12/2021", "Không tập trung", "Thạc sĩ"),
    ("Trường Đại học Trà Vinh", "Tiếng Anh", "2020", "Tập trung", "Chứng chỉ Tiếng Anh - B1")
]
for i, row_data in enumerate(education):
    for c_idx in range(5):
        t2.rows[i+1].cells[c_idx].text = row_data[c_idx]

# TABLE 3: Khen thưởng
t3 = doc.tables[3]
t3.rows[1].cells[0].text = "Không"
t3.rows[1].cells[1].text = ""
t3.rows[1].cells[2].text = ""
t3.rows[1].cells[3].text = ""

# TABLE 4: Kỷ luật
t4 = doc.tables[4]
t4.rows[1].cells[0].text = "2013"
t4.rows[1].cells[1].text = "Quyết định xử lý kỷ luật"
t4.rows[1].cells[2].text = "Khiển trách"
t4.rows[1].cells[3].text = "Vi phạm kỷ luật hành chính cơ quan"

# TABLE 5: Lương
t5 = doc.tables[5]
# R2: row 2 is the first data row (R0 and R1 are header rows)
t5.rows[2].cells[0].text = "01/06/2023" # Từ
t5.rows[2].cells[1].text = "nay"        # Đến
t5.rows[2].cells[2].text = "01.003"     # Mã số
t5.rows[2].cells[3].text = "4"          # Bậc lương
t5.rows[2].cells[4].text = "3.33"       # Hệ số
t5.rows[2].cells[5].text = ""           # Tiền lương theo vị trí việc làm

# TABLE 6: Quan hệ gia đình bản thân: Cha, Mẹ, Người nuôi dưỡng
t6 = doc.tables[6]
t6.rows[1].cells[1].text = """- Họ và tên: TRƯƠNG VĂN BA
- Ngày, tháng, năm sinh: 1954
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi thường trú: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Già yếu
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Liên quan đến chế độ cũ (nếu có): Không
- Tiền án (nếu có): Không"""

t6.rows[2].cells[1].text = """- Họ và tên: NGÔ THỊ MỸ DUNG
- Ngày, tháng, năm sinh: 1959
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Tỉnh Bình Thuận
- Nơi thường trú: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Nội trợ
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Liên quan đến chế độ cũ (nếu có): Không
- Tiền án (nếu có): Không"""

t6.rows[3].cells[1].text = "Không có (do cha mẹ trực tiếp nuôi dưỡng)"

# TABLE 7: Vợ / chồng, con
t7 = doc.tables[7]
t7.rows[1].cells[1].text = """- Họ và tên: TRẦN THỊ HẢI YẾN
- Ngày, tháng, năm sinh: 1982
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Hiệp, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi thường trú: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Cán bộ ngân hàng
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không
- Năm kết hôn: Đã kết hôn theo quy định"""

# Con 1
t7.rows[2].cells[0].text = "Con gái (đầu)"
t7.rows[2].cells[1].text = """- Họ và tên: TRƯƠNG GIA LINH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 2006
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi thường trú: Xã Phong Nẫm, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: Xã Phong Nẫm, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Học sinh/Sinh viên
- Thái độ chính trị: Chấp hành tốt chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""

# Clone row for Con 2
new_tr = copy.deepcopy(t7.rows[2]._tr)
t7._tbl.append(new_tr)
row_con2 = t7.rows[3]
row_con2.cells[0].text = "Con gái (thứ hai)"
row_con2.cells[1].text = """- Họ và tên: TRƯƠNG HẢI NHƯ; Giới tính: Nữ
- Ngày, tháng, năm sinh: 2024
- Số định danh cá nhân: Đã đăng ký khai sinh theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Thị trấn Phú Long, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi thường trú: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp: Còn nhỏ
- Thái độ chính trị: Còn nhỏ
- Tiền án (nếu có): Không"""

# TABLE 8: Anh/Chị/Em ruột của bản thân
t8 = doc.tables[8]
t8.rows[1].cells[0].text = "Em trai"
t8.rows[1].cells[1].text = """- Họ và tên: TRƯƠNG HẢI LÂM; Giới tính: Nam
- Ngày, tháng, năm sinh: 1984
- Số căn cước: Đã cấp theo quy định
- Quốc tịch: Việt Nam
- Nơi thường trú: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 25/1 Võ Liêm Sơn, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Công chức
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""

# TABLE 9: Cha, mẹ đẻ của vợ
t9 = doc.tables[9]
t9.rows[1].cells[1].text = """- Họ và tên: TRẦN MINH CHÁNH
- Ngày, tháng, năm sinh: 1929
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Hiệp, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Ghi chú: Đã mất năm 2017
- Thái độ chính trị: Chấp hành tốt chính sách pháp luật của Nhà nước khi còn sống
- Liên quan đến chế độ cũ (nếu có): Không
- Tiền án (nếu có): Không"""

t9.rows[2].cells[1].text = """- Họ và tên: NGUYỄN THỊ LIỄU
- Ngày, tháng, năm sinh: 1957
- Số căn cước: Đã cấp theo quy định
- Dân tộc: Kinh; Tôn giáo: Không
- Quốc tịch: Việt Nam
- Quê quán: Xã Hàm Nhơn, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi thường trú: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 19 Lâm Đình Trúc, Khu phố 6, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Già yếu
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Liên quan đến chế độ cũ (nếu có): Không
- Tiền án (nếu có): Không"""

t9.rows[3].cells[1].text = "Không có"

# TABLE 10: Anh/Chị/Em ruột của vợ
t10 = doc.tables[10]
siblings_vo = [
    ("Anh trai vợ", """- Họ và tên: TRẦN HẢI THUẬN; Giới tính: Nam
- Ngày, tháng, năm sinh: 1971
- Quốc tịch: Việt Nam
- Nơi thường trú: Quận Phú Nhuận, TP. Hồ Chí Minh
- Nơi ở hiện nay: Quận Phú Nhuận, TP. Hồ Chí Minh
- Nghề nghiệp, nơi làm việc: Kỹ sư
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ MỸ LINH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1952
- Quốc tịch: Việt Nam
- Nơi thường trú: Xã Hàm Chính, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nơi ở hiện nay: Xã Hàm Chính, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Nội trợ
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ HẢI BÌNH; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1969
- Quốc tịch: Việt Nam
- Nơi thường trú: Xã Phong Nẫm, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: Xã Phong Nẫm, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Hưu trí
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không"""),
    ("Chị gái vợ", """- Họ và tên: TRẦN THỊ HẢI VÂN; Giới tính: Nữ
- Ngày, tháng, năm sinh: 1980
- Quốc tịch: Việt Nam
- Nơi thường trú: 19 Lâm Đình Trúc, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nơi ở hiện nay: 19 Lâm Đình Trúc, phường Phú Thủy, TP. Phan Thiết, tỉnh Bình Thuận
- Nghề nghiệp, nơi làm việc: Công chức
- Quê quán: Xã Hàm Liêm, huyện Hàm Thuận Bắc, tỉnh Bình Thuận
- Thái độ chính trị: Chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước
- Tiền án (nếu có): Không""")
]

# Row 1 is already in t10
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
t11.rows[0].cells[0].text = """Bình Thuận, ngày 25 tháng 10 năm 2024
Người khai
Tôi xin cam đoan những lời khai trên đây là đúng sự thật
(Ký tên, ghi rõ họ tên)




TRƯƠNG HẢI CHÂU"""

t11.rows[0].cells[1].text = """Bình Thuận, ngày ...... tháng ....... năm 2024
Xác nhận của cơ quan quản lý cán bộ
(Ký tên, đóng dấu)"""

# Save docx
doc.save(output_docx)
print(f"Successfully generated {output_docx} with full data!")
