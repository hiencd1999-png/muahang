# DATDON - TÀI LIỆU KIẾN TRÚC & NGHIỆP VỤ HỆ THỐNG (ENTERPRISE EDITION)

Dự án Datdon là nền tảng quản lý tài chính điện tử và xử lý đơn hàng Shopee DropShipping khép kín. Được xây dựng theo các tiêu chuẩn khắt khe của hệ thống FinTech lõi (Core-Banking) và tối ưu hóa băng thông cho lưu lượng xử lý tần số cao (High-Frequency).

---

## I. MÔ HÌNH SỔ CÁI KÉP (DOUBLE-ENTRY LEDGER CORE)
Khác biệt hoàn toàn với các app ví điện tử sơ khai sử dụng biến Số Dư Khả Biến (Mutable State), nền tảng Datdon sử dụng tiêu chuẩn Sổ Kế Toán Kép (Double-Entry Bookkeeping).

* **System Accounts:** Các tài nguyên tiền được chốt vào các Quỹ Trung Tâm (VD: `SYSTEM_REVENUE` chứa phế hoa hồng, `SYSTEM_ESCROW` chứa cọc đóng băng, `ADMIN_LIQUIDITY_POOL` kho tiền tối cao).
* **Ledger Lines:** Bất kỳ 1 VND nào sinh ra cũng đều nằm trên Sổ Kế Toán, đảm bảo vĩnh viễn Định luật bảo toàn: `TỔNG NỢ (Debit) = TỔNG CÓ (Credit)`.
* **Reconciliation Engine (Máy Nắn Lỗ Hổng):** Có 1 API ngầm `/api/admin/reconciliation` chuyên cộng dồn toàn bộ Transaction lịch sử và đọ chéo với cấu trúc Mutable Cache Balance của User để cảnh báo nếu có 1 đồng bạc lạm phát hay thất thoát sinh ra do bug phần mềm. Không còn nỗi lo Tiền Ảo rác.

---

## II. LÕI BẢO MẬT & API FIREWALL (SECURITY LAYER)
An ninh mạng được thắt chặt bằng 3 lưới chắn lõi ở `lib/security.ts`:

1. **Anti-DDoS / Rate Limiting Memory Cache:** Quét dọn liên tục bằng Map, khống chế số lượng Request trên 1 dải IP độc bản, triệt tiêu bot Spam phá nghẽn CSDL.
2. **Idempotency Key (Chống Replay Attack):** Moị lệnh Trừ Tiền hay Nạp Xèng từ Client đều đính kèm 1 dấu vân tay `UUID4` ở Header `X-Idempotency-Key` (Lock trong 2 Phút). Bấm F5 hay Auto Click Enter nghìn lần cũng chỉ có 1 Lệnh qua lọt Cửa DB.
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
* **Xử lý tranh chấp - Khiếu nại (Complain System)**:
  * Từ lúc trạng thái sang `TRANSFERRED`, hệ thống đếm ngược 15 Phút Delay. Qua 15 phút, User mới được lên ảnh bằng chứng.
* **Duyệt Cấp Số Dư (`Approve`)**:
  * Chốt hạ đơn! Lấy tiền trong Escrow vứt cho User. Quá trình nhẹ tựa lông hồng vì Tiền của Admin đã bị khóa từ đầu. Ảnh Bằng Chứng cũng Tự tiêu hủy luôn vào cõi hư vô, trả lại ổ cứng xanh sạch đẹp.

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
