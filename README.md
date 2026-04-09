# DatDon Shopee v2.0 - Core Automation

Hệ thống đặt đơn Shopee nội bộ, quản trị và phân quyền đa cấp. Cung cấp quy trình khép kín từ lúc lên đơn, theo dõi hành trình Shopee tự động (Auto-Tracking), chia lợi nhuận hoa hồng tự động đến báo cáo doanh thu tài chính chuyên sâu.

## 1. Tổng quan hệ thống

- **Vai trò:**
  - **USER:** Gửi link, chọn Voucher, nạp tiền tự động, tạo đơn hàng và được quyền **Booking đích danh** chuyên viên hỗ trợ. 
  - **ADMIN:** Nhận xử lý đơn hàng, theo dõi vòng đời đơn, nhận hoa hồng 95% do hệ thống tự động cộng sau mỗi ca giao hàng thành công.
  - **SPADMIN:** Owner quản lý toàn quyền. Quản lý Admin, xem Analytics xuất báo cáo, giải quyết tranh đơn và thiết lập giá phế Voucher.

- **Công nghệ Stack:**
  - Next.js 16 (App Router), React 19, Turbopack
  - Tailwind CSS v4, Lucide Icons
  - Prisma ORM + SQLite
  - Cơ chế quét nền **Background Worker (Instrumentation)**
  - Tích hợp Crawler Proxy động định kỳ gọi Shopee API.
  - Export bảng tính `.xlsx` qua _xlsx_ module.

## 2. Quy tắc vòng đời Sinh Thái Đơn Hàng

- Quy định nạp quỹ/ghi nợ bằng số VND.
- Đơn hàng luân chuyển nghiêm ngặt qua các trạng thái:
  - `PENDING` -> `PROCESSING` -> `ORDER_PLACED` -> `TRACKING_GENERATED` -> `DELIVERED` | `CANCELED`.
- **Cơ chế Booking Đích Danh Tính Phí:** 
  - User có quyền chọn thẳng một Chuyên viên (ẩn danh user, chỉ hiển thị tên) khi tạo đơn.
  - Sau khi chọn đích danh, **nghiêm cấm mọi Admin khác cướp đơn (Trừ quyền SPAdmin)**.
  - Sau 6 tiếng ròng rã mà Admin phụ trách chưa nhận (từ `PENDING` sang `PROCESSING`), hệ thống sinh tiến trình Auto-Cancel, huỷ đơn, hoàn nguyên số tiền cho User kèm lý do báo cáo là "Admin hẹn không lên kịp đơn".
- **Cơ chế Cookie Nhập Liệu:** 
  - Tại ga chuyển trạng thái `ORDER_PLACED`, nếu Admin cung cấp cookie *spc_st*, hệ thống nhận diện và bắt đầu theo dõi tự động.

## 3. Background Worker (Auto-Tracking & Tự Động Hóa Hoa Hồng)

1. **Auto-Tracking Shopee (Cronjob ngầm 5 phút/lần):** 
   - Node Background Worker tự bật cùng Server. Ghép cụm 100 Account Cookie gửi song song qua mạng lưới Proxy (Round-Robin IP).
   - Tự động thay đổi hành trình `DELIVERED`, `CANCELED` không cần con người nhúng tay.
   - Nếu cookie bị expired/blacklist, hệ thống tự thanh trừng khỏi database.
2. **Kế toán Tự động Ghi Có:** 
   - Nếu Background Worker bắt được API báo *Giao Hàng Thành Công*, nó tự trích **95% Doanh Thu của đơn chốt** ném thẳng vào ví khả dụng của Admin xử lý đơn. Lập log chi tiết. **5%** chênh lệch lưu lại dưới dạng Hệ số Lợi Nhuận của SPAdmin.

## 4. Analytics & Báo Cáo Tài Chính

- Bảng điều khiển phân tích số dư theo các bộ lọc "Từ Ngày - Đến Ngày" (Timeframe selector).
- **Phân tách minh bạch:** 
  - Thống kê Tổng Đơn - Đơn Thành Công - Đơn Bị Huỷ trên toàn mạng lưới.
  - Quy chi tiết Lợi Nhuận Giao Thành Công về 2 khoản: *Hoa Hồng 95% (Admin)* và *Sinh lời 5% (SPAdmin)*. 
- Tính năng **Export To Excel (.xlsx)**: Kết xuất bảng báo cáo sổ cái chi tiết, chia rõ lợi nhuận ròng của bộ máy và sổ lương của từng Admin thành 3 sheet biệt lập (Tổng quan, KPI Nhân sự, Sổ theo dõi Vận đơn).

## 5. Cơ chế Phân quyền (Nhấn mạnh)

### 5.1 Ưu tiên của USER
- Chốt đơn đa luồng (Thêm 1 lúc nhiều link).
- Gọi Auto-Fill Suggestion Shopee API để mồi mớm địa chỉ.
- Xem giao dịch, ví điện tử, Booking người quản lý.

### 5.2 Xử lý của ADMIN
- Bị hạn chế tầm nhìn. Chỉ thấy đơn của mình và đơn chưa có chủ.
- Chịu chế tài cướp đơn bị khoá API 403 Forbidden.
- Chịu chế tài 1 giờ xả đơn (nếu Processing nhưng giữ quá 1 giờ bị đẩy lại ra trang Chủ).

### 5.3 Chủ Quyền SPADMIN
- Nhìn xuyên thấu hệ thống. Bất chấp lệnh cấm cướp đơn, bypass mọi rules. 
- Toàn quyền re-assign/điều phối bảo mẫu cho đơn hàng qua Admin Panel.
- Phân tích luồng tiền, doanh thu ròng. Cấu hình bảng phí Voucher.

## 6. Cài đặt và Chạy Môi Trường Local

```bash
# Thiết lập packages
npm install

# Setup Biến môi trường .env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="1234567890abcdef"

# Khởi tạo khung DB và Seed tài khoản
npm run db:push
npm run db:seed

# Chạy bản thử nghiệm kèm Server-side Worker
npm run dev
```

## 7. Tài nguyên Seed Mặc định

- Sếp tổng (SPADMIN): `spadmin` / `Spadmin123`
- Quản lý kho (ADMIN): `admin` / `Admin123`
- Khách hàng (USER): `testuser` / `Test123`
