# DATDON - TÀI LIỆU KIẾN TRÚC & NGHIỆP VỤ HỆ THỐNG (ENTERPRISE EDITION)

Dự án Datdon là nền tảng quản lý tài chính điện tử và xử lý đơn hàng Shopee DropShipping khép kín. Được xây dựng theo các tiêu chuẩn khắt khe của hệ thống FinTech lõi (Core-Banking) và tối ưu hóa băng thông cho lưu lượng xử lý tần số cao (High-Frequency).

---

## I. MÔ HÌNH SỔ CÁI KÉP (DOUBLE-ENTRY LEDGER CORE)
Khác biệt hoàn toàn với các app ví điện tử sơ khai sử dụng biến Số Dư Khả Biến (Mutable State), nền tảng Datdon sử dụng tiêu chuẩn Sổ Kế Toán Kép (Double-Entry Bookkeeping).

* **System Accounts:** Các tài nguyên tiền được chốt vào các Quỹ Trung Tâm (VD: `SYSTEM_REVENUE` chứa phế hoa hồng, `SYSTEM_ESCROW` chứa cọc đóng băng, `ADMIN_LIQUIDITY_POOL` kho tiền tối cao).
* **Ledger Lines:** Bất kỳ 1 VND nào sinh ra cũng đều nằm trên Sổ Kế Toán, đảm bảo vĩnh viễn Định luật bảo toàn: `TỔNG NỢ (Debit) = TỔNG CÓ (Credit)`.
* **Reconciliation Engine (Máy Nắn Lỗ Hổng):** 
  * Cung cấp Check-API thủ công cho Dashboard SPAdmin: `/api/admin/reconciliation`.
  * Trang bị Cỗ máy tự động nguyên khối (Autonomous Cron Job) `cron/reconciliation.ts` chạy xuyên đêm lúc 2:00 Sáng để cào toàn bộ DB, so khớp Nợ/Có. Nếu sinh ra lạm phát (Drift), tự ghi lại vào Sổ Đen Bất Biến `reconciliation_reports.log` (Append-Only) để chuẩn bị gọi điện báo thức CTO. Tốc độ kiểm toán đạt cực đỉnh nhờ thiết lập B-Tree `@@index([userId, createdAt])` sẵn từ rễ DB.

---

## II. LÕI BẢO MẬT & API FIREWALL (SECURITY LAYER)
An ninh mạng được thắt chặt bằng 3 lưới chắn lõi ở `lib/security.ts`:

1. **Anti-DDoS / Rate Limiting Memory Cache:** Quét dọn liên tục bằng Map, khống chế số lượng Request trên 1 dải IP độc bản, triệt tiêu bot Spam phá nghẽn CSDL.
2. **Idempotency Key (Chống Replay Attack Mức Doanh Nghiệp):** Moị lệnh Trừ Tiền hay Nạp Xèng từ Client đều đính kèm 1 dấu vân tay `UUID4` ở Header `X-Idempotency-Key` (Tuổi thọ 24 Giờ liên tục). Bấm F5 hay Network Delay dẫn đến Retry nghìn lần cũng chỉ lọt Cửa đúng 1 lệnh suy nhất.
3. **Canvas Image Sanitization:** Trình duyệt tự tải mảnh gạch (Image Complain) vào thẻ HTML Canvas và nén thành 70% Base64 JPEG. Mã độc (XSS/SVG Scripts) hoặc Exif Virus sẽ bị hủy diệt 100% trước khi tới Server.

---

## III. CHI TIẾT NGHIỆP VỤ NẠP TIỀN ĐÓNG ĐÔNG (ESCROW FLOWS)

Hệ thống cho phép nạp qua 2 định dạng: Bank (Nội bộ VNĐ) và USDT (Crypto). Độc quyền bởi cơ chế **Escrow Lock**.

### Nạp Tiền Qua Ngân Hàng Nội Bộ (Bank Top-up)
Quy trình nạp này sử dụng phương thức Peer-to-Peer (P2P) từ User trực tiếp sang tài khoản ngân hàng của đại lý (Admin).
* **Tạo Lệnh Nạp Cọc (Escrow Create)**:
  * User nhập số tiền và chọn 1 Admin.
  * **Khoá Rào (Liquidity Reserve):** Server không chỉ check xem ví Admin có đủ tiền không, mà dùng `prisma.$transaction` để Trừ Luôn tiền của Admin đó và cất vào Quỹ Tạm Giữ Escrow. Ngăn chặn tuyệt đối 10 User hùa nhau vào Nạp Tiền "rút ruột" 1 Admin đang còn rành số dư (Race Condition). 
* **3 Điểm Chạm Hoàn Lại (Escrow Release):** 
  * Nếu User Hủy lệnh (`Cancel`).
  * Nếu Admin Bác Bỏ (`Reject`).
  * Nếu Ngâm quá 30 Phút (`Expired`). 
  * -> Server tự lôi trong Escrow hoàn y nguyên quỹ cho Admin.
* **Sweeper Worker (Cỗ Máy Rọn Rác Tự Động)**:
  * Trang bị kịch bản `cron/deposit-sweeper.ts` quét song song với tiến trình Runtime. Cỗ máy này chuyên đi nhặt những đơn "Chết Rũ" lơ lửng không ai ngó tới để ép buộc Hoàn Trả Tiền Cọc, đảm bảo 100% tiền Escrow không bao giờ kẹt vĩnh viễn dù Server có sập.
* **ACID Transaction & Kế Hoạch Bù Trừ (Saga/Rollback)**:
  * Không dùng Distributed Saga cồng kềnh. Mọi hành vi tạo lệnh bóp Cọc Escrow được cuốn lô chặt bằng `prisma.$transaction`. Nếu đang tạo Order mà lỗi ổ cứng hoặc đứt cáp -> Engine DB lập tức phóng tia `ROLLBACK` khôi phục Cọc Escrow về mốc ban đầu. Tiền bạc sẽ không bao giờ đứng bơ vơ.
* **Xử lý tranh chấp - Khiếu nại (Complain System)**:
  * Từ lúc trạng thái sang `TRANSFERRED`, đếm ngược 15 Phút Delay trước khi mờ cổng up Bằng Chứng. 
* **Duyệt Cấp Số Dư (`Approve`)**:
  * Chốt đơn! Quá trình giải ngân nhẹ tựa lông hồng vì Tiền Admin đã chặn từ đầu. Ảnh bằng chứng sau Duyệt Tự Tiêu Hủy cứu rỗi Disk Space.

---

## IV. CHI TIẾT NGHIỆP VỤ XỬ LÝ ĐƠN SHOPEE (ORDER DROPSHIP FLOWS)

Mục đích chính của nền tảng: User có quỹ sẽ lên đơn Shopee (để buff dơn), Đại lý có quỹ sẽ nhặt lại đơn để ăn chênh lệch.

### 1. Phía Người Dùng: Khởi Tạo Hàng Loạt (Batch Order Creation)
* User dán toàn bộ List Link vào API. Hệ thống bóc tách chuẩn hóa thành `shopId.itemId`. Trừ Ví chuẩn trên `Unit Price` cài trên hệ thống Voucher. Báo notification xập xình.

### 2. Phía Đại Lý: Chiếm Cửa Đơn Khách
* Đại lý vào Pool chờ, chọn đơn `PENDING` -> Bấm Update `PROCESSING`. Chốt Owner ngay cho Đại lý.

### 3. Con bọ Tracker Áp Dụng Khoảng Lùi Lũy Thừa (Smart Polling Engine)
Nghiệp vụ cốt lõi tại `/api/shopee/tracking-sync`, đây là bộ não quét Đơn Hàng Shopee không chạm.
* **Bắt Mạch Thông Minh (Exponential Backoff):** Hệ thống được nhúng tư duy Smart Polling để giảm thiêu đốt tiền mua Proxy:
  * Đơn vừa nhặt (ORDER_PLACED): Server giãn chờ 10 Phút mới trọc xuống Shopee.
  * Đơn đang giao (TRACKING_GENERATED): Server giãn kịch khung chờ 6 Tiếng Đồng Hồ mới bắn 1 lượt API. Tiết kiệm tới 95% lưu lượng ảo. Proxy tha hồ mát mẻ. Server ngậm mồm trả dữ liệu Cache siêu tốc.
* **Tự Thay Đổi Cục Diện (State Shift) Bằng Proxy Xoay:**
  * Có trạng thái "Đã giao thành công" -> Giao Dịch Nguyên Khối Atomic: Server gõ lệnh rót 95% Hoa Hồng vào túi Đại lý chạy đơn.
  * Shippers/Shop Hủy trên Shopee -> Server lật ngược CANCELED và Refund hoàn nguyên lại ví tiền cho User.

---

## V. TÍNH NĂNG TIỆN ÍCH QUẢN TRỊ 
* **Reassign Order**: Khi Đại Lý A cắn đơn bỏ trốn. SPAdmin được ấn "Bắt cóc", hồi sinh đơn lại về `PENDING`.
* **Audit System**: Nền tảng Log tất toán, kiểm tra 24/7 mọi hành động phá hoại. Toàn quyền chốt lịch sử từ User đến SPAdmin.
* **Tải Báo Cáo Xuất Kho (CSV Exports)**: Sổ sách chuẩn dòng cho hệ thống khai thuế đối soát.
* **Bơm Rút Xèng (Withdraw Control)**: Yêu cầu nhả phế hoa hồng, trừ ví Khóa ngay lập tức, chuyển hóa lại qua tiền Crypto chờ SPAdmin duyệt. 

## VI. CÁC TÍNH NĂNG BẢO MẬT & VẬN HÀNH ĐÃ NÂNG CẤP (MỚI)

### 1. Nâng Cấp Bảo Mật Tài Khoản bằng 2FA
Đã tích hợp bảo mật hai lớp (Two-Factor Authentication) thông qua Google Authenticator. Đầu vào khóa bí mật (OTP Token) được check qua Server-Side. Khi mã hóa được bật, người dùng đăng nhập bằng tài khoản và mật khẩu sau đó sẽ phải nhập thêm bước thứ 2 là OTP.

### 2. Xét Duyệt Nâng Quyền Đại Lý (Admin Role Upgrade)
* Mở luồng cho các `USER` bình thường nộp đơn xin cấp phép làm `ADMIN` để có thể nhận xử lý các đơn hàng dropship.
* **Điều kiện bộ lọc tài chính chẽ:** Tài khoản bắt buộc từng có tài sản lưu thông, yêu cầu phải có ít nhất 1 lệnh nạp tiền vào quỹ Crypto thành công với định mức $\ge$ 30 USDT. (Điều kiện tự động chặn clone và scam bot).
* SPAdmin vận hành bảng Admin-Requests, xem xét và One-Click thao tác: từ chối, hoặc duyệt thẳng. Khi duyệt, Prisma $transaction đảm bảo Role của User chính thức chuyển sang ADMIN. Cấp quyền truy cập vùng Admin Panel.

### 3. Tiêu Chuẩn Cho Phép Rút Tiền Nội Bộ 
Phòng ngừa nghẽn tiền lưu thông, quy trình Withdraw tiền của Admin đã được thiết lập ngưỡng trần kiểm soát:
* **Hạn mức 1 Lần / Tuần (Rate Limited Request):** Mỗi tài khoản Admin chỉ được khởi tạo thành công 1 lệnh rút tiền trong vòng 7 ngày (Những lệnh đang xử lý chưa thành công hoặc rút rác, bị Cancel, Rejected không bị tính vào hạn mức).
* **Định mức Năng lực:** Admin bị vô hiệu hóa quyền rút tiền nếu lịch sử năng lực không đủ cao: Chưa từng xử lý hoàn thành $\ge$ 10 đơn hàng thành công thực sự về trạng thái (Status: `ORDER_PLACED`, `TRACKING_GENERATED`, `DELIVERED`).

### 4. Tối Ưu UX Tốc Độ Thao Tác Bảng Điều Khiển
* Chuẩn hóa bảng màu hành động cốt lõi `amber` chuyên nghiệp toàn platform.
* Các Modal Nạp Tiền, Tạo Đơn thả xuống hàng ngàn Admin phụ trách nay đã được trang bị "Auto-complete Filter Search" tìm kiếm định vị nhanh bằng tên mà không cần cuộn dọc danh sách dài vô tận.

---

## 🚀 Hướng Dẫn Khởi Chạy Môi Trường

### Cài đặt thư viện
```bash
npm install
```

### Triển khai Cơ Sở Dữ Liệu - Sổ Nợ Có
Đảm bảo đã chạy file `.env` trỏ gốc PostgreSQL/SQLite:
```bash
npx prisma db push
tsx scratch/seed.ts # Khởi tạo các quỹ hệ thống cốt lõi ban đầu
npx prisma generate
```

### Chạy hệ thống 
```bash
npm run dev     # Môi trường Develop
npm run build   # TurboPack Đóng gói Siêu Nhẹ Tĩnh
npm start       # Chạy Production
```
