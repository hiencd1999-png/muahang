# DatDon Shopee v2.0 - Core Automation & Secure Finance

Hệ thống chuyên dụng Đặt đơn Shopee trung gian, tích hợp công nghệ Tự Động Hóa Hành Trình (Auto-Tracking) và Phân quyền Quản trị Đa cấp. Dự án v2.0 tập trung nâng cấp cực hạn về **Vá Lỗ Hổng Bảo Mật (Security Hardening)**, **Chống Thất Thoát Tài Chính (Race Condition 防御)** và **Trải nghiệm Đồ Họa Đỉnh Cao (OLED Max Contrast)**.

## 1. Tổng Quan Kiến Trúc Hệ Thống

- **Công nghệ Stack:**
  - Next.js 16 (App Router), React 19, Turbopack.
  - Giao diện: Tailwind CSS v4, Lucide Icons, thiết kế **Deep Glassmorphism** (OLED High Contrast).
  - Database: Prisma ORM + SQLite (với Interactive Transactions).
  - Chống Tấn Công (Anti-Bot): Rate Limiting In-Memory, Zod strict payloads.
  - Tự động hóa: Background Worker Scheduler, Proxy Rotator tự đổi IP.

## 2. Hệ Sinh Thái Người Dùng & Phân Quyền (RBAC)

### 2.1 USER (Khách Hàng)
- **Tạo đơn đa luồng:** Hỗ trợ nhập hàng loạt link Shopee, auto-fetch địa chỉ và điền mã Voucher linh hoạt.
- **Booking Cá Nhân Lương Thấp:** User có quyền phân phối (chỉ định lệnh) đích danh đến một Chuyên viên Admin quen thuộc. Khóa chặt quyền cướp đơn của các nhân sự khác.
- **An toàn quỹ:** Nếu Admin không tiếp nhận đơn sau quá 6 giờ, hệ thống *Auto-Cancel* giải phóng lại tiền vào số dư.

### 2.2 ADMIN (Chuyên Viên Đặt Đơn)
- **Cơ sở cách ly độc lập:** Chỉ được tiếp cận các số liệu, thống kê và biểu đồ hiệu suất của riêng **cá nhân** mình. Bị làm mờ (ẩn) hoàn toàn các Dữ liệu Doanh thu chung của toàn Mạng Lưới (Ẩn các hệ số Margin).
- **Hệ thống rút tiền lương (Withdrawal Crypto):**
  - Admin được cung cấp tính năng yêu cầu Xuất/Rút tiền hoa hồng về ví Crypto cá nhân theo mạng **USDT (BSC/BEP20)**.
  - Tích hợp tính năng **Tự hủy Lệnh Khẩn Cấp (Cancel)** dành cho các giao dịch chờ duyệt nếu nhập sai địa chỉ ví.
  - Chống xả đơn: Lệnh bị tạm giữ Processing quá lâu không giải quyết sẽ bị kick ra chợ chung.

### 2.3 SPADMIN (Trùm Hệ Thống - Owner)
- **Kiểm soát tối cao:** Đi xuyên mọi ranh giới phân quyền, nắm trọn View Doanh thu tổng (Sổ cái), xem dòng tiền chi tiết và xuất Excel (xlsx) toàn bộ.
- **Xử lý rút tiền Crypto khép kín:** 
  - Toàn quyền Phê Duyệt hoặc Từ chối lệnh Rút lương của Admin mạng lưới. Cung cấp bộ lọc thông minh giúp chống thao tác sai. 

## 3. Khối Nền Tảng Tài Chính Kế Toán Định Tuyến (Financial Core)

- **Ngăn chặn Double Spend Attack (Rút Lố Tiền / Tấn Công Tần Số Cao):**
  Quy trình Ghi có / Ghi nợ tại khu vực SPAdmin Duyệt Lệnh Rút đã được thiết kế sử dụng **Prisma Interactive Transactions ($transaction async tx)**. Bắt buộc phong tỏa State Tài Khoản lúc duyệt và re-verify số dư, loại trừ hoàn toàn rủi ro Admin viết Tool giã liên hoàn nhiều Request cùng lúc để đánh lừa số dư và qua mặt cổng bảo vệ.
- **Tự Động Hóa Commission 95% / 5%:** 
  Khi Crawler từ API quét được đơn hàng hoàn tất ở trạm cuối (DELIVERED), hệ thống kết toán tự động và ngay lập tức nhả 95% giá trị lợi nhuận biên cho Ví Admin thực hiện. SPAdmin nhận 5% Hệ số quản lý đổ vào Báo Cáo Doanh Thu. Tất cả đều không cần đến tác nghiệp bằng tay.

## 4. Bảo Mật Vành Đai & Chống Tấn Công (Security)

Hệ thống được thiết kế theo tiêu chuẩn Application Hardening:
1. **Phòng thủ Timing Attack (Fake Hash Delay):** Mọi điểm mù trinh sát thời gian phản hồi ở API Đăng nhập đều dược mài nhẵn bằng hàm trễ mô phỏng để Bypass các bot trinh sát mật khẩu.
2. **In-Memory Rate Limiter:** Đề phòng Brute Force và cào rác tự động. Tần suất Đăng nhập bị block sau 10 lần sai/5 phút; Đăng ký khóa sau 5 lần/giờ.
3. **Payload DoS Guard:** Trải dài từ `auth`, `order` cho đến `sync`, `zod schema` được đính kèm chuỗi độ dài (max limits) cực đại, chặn đứng mầm mống OOM (Out Of Memory) Payload Bombing.

## 5. Trải Nghiệm Giao Diện (OLED Max Contrast Style)

- Kiến trúc Đồ họa đi theo hướng **Kính Mờ Đáy Thẳm (Deep Glassmorphism)** kết hợp màu nền Tuyệt Đối Đen (Zinc 950 xuống Black 000) trên Dark Mode.
- Xóa bỏ việc bù trừ màu thiếu sáng. Tăng giới hạn phát sáng dạ quang bằng các thẻ Card nguyên khối Zinc 900 cùng viền Glowing Edge. 
- Component hiển thị địa chỉ Blockchain trên màn SPAdin được thiết kế dãn dòng thẳng băng (`whitespace-nowrap`) kết hợp hiệu ứng Tương tác click tự động bôi đen copy (`select-all`) giúp cắt giảm sai số do sao chép nhầm.

## 6. Worker Node Đáy (Background Polling)

1. Kích hoạt Cronjob ngầm, chạy chu kỳ tự động 5 phút/lần.
2. Thay vì dùng IP máy chủ gốc, Server nhúng proxy động định tuyến Shopee qua Proxy Rotating chống chặn Cookie.
3. Quét tất cả Tracking ID qua API ngầm của Shopee, lấp đầy Status (`PENDING` -> `CANCELED`, `DELIVERED`,...).

---

## 7. Khởi chạy Hệ Thống (Môi trường Local)

```bash
# Cài đặt nền tảng phụ thuộc
npm install

# Setup Biến môi trường .env.local
DATABASE_URL="file:./dev.db"
AUTH_SECRET="1234567890abcdef"

# Cập nhật & Seed cơ sở dữ liệu gốc (Bao gồm Account và Logic Tài chính)
npx prisma db push
npm run db:seed

# Biến Server chạy Production Build thử nghiệm
npm run dev
```

### 8. Các Tài khoản Master Seed Defaults:

- **Chủ Hệ Thống (SPADMIN):** `spadmin` / `Spadmin123`
- **Chuyên viên (ADMIN):** `admin` / `Admin123` (Cùng vài account Admin clone khác)
- **Người dùng (USER):** `testuser` / `Test123`
