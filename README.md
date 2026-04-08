# DatDon Shopee

Hệ thống đặt đơn Shopee nội bộ, hỗ trợ quản lý người dùng, số dư, vòng đời đơn hàng, cấu hình voucher và phân quyền quản trị nhiều cấp.

## 1. Tổng quan hệ thống

- Vai trò:
	- USER: Tạo đơn, theo dõi đơn, nạp tiền, quản lý profile, xem thông báo.
	- ADMIN: Xử lý đơn, quản lý user theo giới hạn quyền, xem log của chính mình.
	- SPADMIN: Toàn quyền quản trị (bao gồm quyền của ADMIN) + quản lý voucher, đổi admin phụ trách, xóa đơn, xem toàn bộ log/transactions.
- Công nghệ:
	- Next.js 16 App Router
	- TypeScript
	- Tailwind CSS v4
	- Prisma + SQLite
	- JWT cookie session với jose
	- xlsx để export Excel

## 2. Quy tắc domain cốt lõi

- Tiền lưu kiểu số nguyên VND.
- Đơn hàng có các trạng thái:
	- PENDING
	- PROCESSING
	- ORDER_PLACED
	- TRACKING_GENERATED
	- DELIVERED
	- CANCELED
- Tạo đơn Shopee bắt buộc chọn loại voucher.
- Giá đơn không hard-code, lấy từ bảng cấu hình voucher VoucherPricing.
- Tại thời điểm tạo đơn, hệ thống snapshot vào order:
	- voucherType
	- voucherLabel
	- unitPrice
	- total
	để đảm bảo lịch sử và hoàn tiền không bị ảnh hưởng khi cấu hình voucher thay đổi sau đó.
- Voucher đang bảo trì sẽ không hiển thị ở form tạo đơn.
- Đơn PROCESSING quá 1 giờ mà chưa lên ORDER_PLACED sẽ tự trả về PENDING để admin khác nhận.
- Đơn DELIVERED:
	- Không được đổi SPC_ST và mã vận đơn.
	- Chỉ được cập nhật ghi chú.

## 3. Cơ chế phân quyền

### 3.1 USER

- Truy cập dashboard người dùng.
- Nạp tiền và xem lịch sử giao dịch cá nhân.
- Tạo đơn Shopee theo voucher đang hoạt động.
- Sửa/hủy đơn khi còn PENDING.
- Xem lịch sử đơn và export Excel theo quyền user.

### 3.2 ADMIN

- Truy cập khu admin.
- Xem đơn PENDING và đơn do chính mình phụ trách.
- Cập nhật vòng đời đơn theo luồng hợp lệ.
- Quản lý thông tin user trong phạm vi quyền được cấp.
- Xem nhật ký hoạt động của chính mình.

### 3.3 SPADMIN

- Kế thừa toàn bộ quyền ADMIN.
- Quản lý toàn bộ đơn hàng.
- Đổi admin phụ trách đơn hàng.
- Xóa đơn hàng (xóa nhiều đơn đã chọn).
- Cấu hình voucher theo từng loại mã và bật/tắt bảo trì từng mã.
- Xem toàn bộ nhật ký hoạt động và giao dịch hệ thống.

## 4. Luồng đơn hàng

- Tạo đơn:
	- User phân tích link Shopee, chọn voucher, nhập thông tin giao hàng.
	- Hệ thống tính total theo unitPrice của voucher đang chọn.
	- Trừ balance và tạo transaction ORDER_DEBIT.
- Nhận xử lý:
	- Khi admin duyệt từ PENDING sang PROCESSING, đơn được gán admin phụ trách và ghi mốc processingStartedAt.
- Timeout tự nhả đơn:
	- Nếu PROCESSING quá 60 phút mà chưa chuyển tiếp, đơn tự trả về PENDING và bỏ phụ trách.
- Hủy đơn:
	- Nếu hủy ở PENDING/PROCESSING thì hoàn tiền theo đúng order.total snapshot.
- Đơn đã giao:
	- Chỉ cho sửa ghi chú, không cho sửa logistics.

## 5. Hệ thống voucher

- Các loại voucher mặc định:
	- Mã giảm 80k
	- Mã giảm 100k
	- Mã giảm 50% tối đa 100k
	- Mã giảm 50% tối đa 200k
	- Mã giảm 60k
- Mỗi voucher có:
	- unitPrice
	- isMaintenance
- SPADMIN cấu hình qua trang admin vouchers.

## 6. Audit log và transactions

- Các thao tác quan trọng đều ghi audit log.
- Các biến động tiền được ghi transaction.
- Các action nhạy cảm của SPADMIN (ví dụ đổi phụ trách đơn, xóa đơn) có log riêng.

## 7. Cài đặt và chạy local

### 7.1 Yêu cầu

- Node.js 20+
- npm

### 7.2 Cài đặt

```bash
npm install
```

### 7.3 Biến môi trường

Tạo file .env (hoặc copy từ .env.example):

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-secret"
```

### 7.4 Đồng bộ DB và seed

```bash
npm run db:push
npm run db:seed
```

### 7.5 Chạy ứng dụng

```bash
npm run dev
```

Mặc định chạy ở http://localhost:3000

## 8. Scripts

- npm run dev: chạy local dev server.
- npm run build: build production.
- npm run start: chạy production sau khi build.
- npm run lint: kiểm tra eslint.
- npm run db:generate: generate Prisma client.
- npm run db:push: cập nhật schema vào SQLite.
- npm run db:seed: seed dữ liệu mẫu.

## 9. Tài khoản seed mặc định

- admin / Admin123
- spadmin / Spadmin123
- testuser / Test123

## 10. API map hiện tại

### 10.1 Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout

### 10.2 User

- GET /api/user/profile
- PUT /api/user/profile
- POST /api/user/deposit
- GET /api/user/notifications
- POST /api/user/notifications

### 10.3 Order (user)

- POST /api/order/create
- GET /api/order/list
- PATCH /api/order/update/[id]
- DELETE /api/order/update/[id]
- POST /api/order/export
- POST /api/order/delete-canceled

### 10.4 Admin core

- GET /api/admin/users
- PATCH /api/admin/user/[id]
- PUT /api/admin/user/balance
- GET /api/admin/orders
- POST /api/admin/orders/export
- POST /api/admin/orders/batch-update
- POST /api/admin/orders/delete (SPADMIN)
- GET /api/admin/order/[id]
- PUT /api/admin/order/update
- PATCH /api/admin/order/update/[id]
- PATCH /api/admin/order/reassign (SPADMIN)

### 10.5 Admin monitoring

- GET /api/admin/audit-logs
- GET /api/admin/transactions

### 10.6 Voucher

- GET /api/admin/voucher-pricing (SPADMIN)
- PATCH /api/admin/voucher-pricing (SPADMIN)

### 10.7 Health

- GET /api/health

## 11. Cấu trúc thư mục chính

- app: pages/layouts/route handlers theo App Router.
- components: UI components theo domain (admin, dashboard, shared).
- lib: helper business logic (auth, roles, voucher, order assignment timeout, audit, prisma).
- prisma: schema và seed.
- public: static assets.

## 12. Lưu ý vận hành

- Không commit file .env thật lên git.
- Nếu đổi schema, luôn chạy lại:
	- npm run db:push
	- npm run db:seed (nếu cần dữ liệu mặc định)
- Nếu thay đổi quyền hoặc logic đơn hàng, nên kiểm tra lại:
	- flow tạo đơn
	- flow xử lý trạng thái
	- flow hoàn tiền
	- audit logs
