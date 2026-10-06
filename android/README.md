# VBAI Bot - Android Mobile App (APK)

Dự án Android WebView Wrapper chuẩn hóa cho hệ thống `https://vbaibot.chauphienbanso.com/`.

## 1. Tính năng của ứng dụng Android
- **Tương thích toàn diện**: Hỗ trợ từ Android 7.0 (API 24) đến Android 14+ (API 34).
- **Hỗ trợ tải tệp & ghi âm (Whisper)**: Cấp quyền Camera, Microphone, Bộ nhớ để bóc băng ghi âm trực tiếp và tải lên hồ sơ văn bản.
- **Vuốt để làm mới (Pull-to-refresh)**: Cập nhật dữ liệu thời gian thực nhanh chóng.
- **Tự động lưu phiên**: CookieManager lưu trạng thái đăng nhập không bị out phiên.
- **Theme Dark Mode đồng bộ**: Tích hợp màu nền Deep Cosmic Dark `#090D16` đồng bộ thanh trạng thái (StatusBar) và thanh điều hướng (NavigationBar).

## 2. Cách Build file APK

### Cách 1: Dùng Android Studio (Khuyến nghị nếu muốn ký số và phát hành)
1. Mở phần mềm **Android Studio**.
2. Chọn **Open** và dẫn tới thư mục `android` trong repo này: `e:\OneDrive\HSCV\Antigravity\vbaibot\android`.
3. Chờ Gradle sync xong.
4. Trên thanh menu, chọn:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
5. Sau khi build xong, file APK sẽ nằm tại:
   `android/app/build/outputs/apk/debug/app-debug.apk`.
6. Chép file `app-debug.apk` vào điện thoại Android và cài đặt.

---

### Cách 2: Cài đặt trực tiếp dạng PWA (Nhanh nhất - Không cần build APK)
Hệ thống `https://vbaibot.chauphienbanso.com` đã được tích hợp đầy đủ chuẩn **PWA (Progressive Web App)**:
1. Mở trình duyệt **Google Chrome** hoặc **Edge** / **Samsung Internet** trên điện thoại Android.
2. Truy cập: `https://vbaibot.chauphienbanso.com/`
3. Nhấn vào biểu tượng **3 dấu chấm** ở góc trên bên phải trình duyệt.
4. Chọn **"Thêm vào màn hình chính"** (hoặc **"Cài đặt ứng dụng"**).
5. Ứng dụng sẽ xuất hiện trên màn hình chính như một app Android thực thụ:
   - Chạy toàn màn hình không có thanh địa chỉ web.
   - Hoạt động độc lập trong danh sách đa nhiệm.
   - Tự động cập nhật tính năng mới mỗi khi server cập nhật mà không phải gỡ ra cài lại.

---

### Cách 3: Đóng gói APK tự động qua PWABuilder (Online trong 1 phút)
1. Truy cập: [PWABuilder.com](https://www.pwabuilder.com/)
2. Nhập URL: `https://vbaibot.chauphienbanso.com` và nhấn **Start**.
3. Trang web sẽ quét tệp `manifest.webmanifest` đã cấu hình sẵn.
4. Nhấn **Package for Stores** > chọn thẻ **Android** > Nhấn **Generate APK**.
5. Tải file `.apk` về điện thoại và cài đặt ngay.
