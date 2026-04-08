# DatDon Shopee

Hệ thống đặt đơn Shopee với hai vai trò `USER` và `ADMIN`, xây dựng bằng Next.js App Router, Prisma và SQLite.

## Chức năng chính

- Đăng ký, đăng nhập bằng cookie JWT session.
- Dashboard người dùng với số dư, đơn gần đây và thao tác nhanh.
- Nạp tiền vào tài khoản, lưu lịch sử giao dịch.
- Tạo đơn Shopee từ link đã phân tích, tự tính tiền và trừ balance nếu đủ số dư.
- Theo dõi lịch sử đơn với các trạng thái `PENDING`, `PROCESSING`, `ORDER_PLACED`, `TRACKING_GENERATED`, `DELIVERED`, `CANCELED`.
- User có thể sửa hoặc tự hủy đơn khi đơn còn ở trạng thái `PENDING`.
- User có thể chọn nhiều đơn trong lịch sử đơn để xuất Excel, và xóa hàng loạt các đơn đã hủy.
- Trang profile để xem thông tin tài khoản và đổi mật khẩu.
- Admin dashboard để quản lý user, đơn hàng, transactions và nhật ký hoạt động.
- Admin chỉ nhìn thấy các đơn `PENDING` hoặc các đơn do chính admin đó phụ trách.
- Admin đầu tiên duyệt đơn sẽ trở thành admin phụ trách đơn đó.
- Chỉ admin phụ trách mới được tiếp tục xử lý đơn và cập nhật thông tin đơn hàng.
- Popup chi tiết đơn của admin cho phép cập nhật số điện thoại, địa chỉ, phân loại, ghi chú, `SPC_ST` và mã vận đơn.
- Admin có thể xuất Excel đơn hàng với đầy đủ thông tin nội bộ, bao gồm `SPC_ST`.
- Tất cả các thao tác quan trọng của user/admin đều được ghi vào audit log.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- SQLite
- Cookie-based JWT auth với `jose`
- `xlsx` để xuất file Excel

## Scripts

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Các lệnh hữu ích khác:

```bash
npm run lint
npm run build
```

## Tài khoản seed mặc định

- Username: `admin`
- Password: `Admin123`

Tài khoản test user được seed thêm:

- Username: `testuser`
- Password: `Test123`

## Biến môi trường

Tạo từ `.env.example` hoặc dùng sẵn `.env` trong local development:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-secret"
```

## API map

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/deposit`
- `POST /api/order/create`
- `GET /api/order/list`
- `PATCH /api/order/update/[id]`
- `DELETE /api/order/update/[id]`
- `POST /api/order/export`
- `POST /api/order/delete-canceled`
- `GET /api/user/notifications`
- `POST /api/user/notifications`
- `GET /api/admin/users`
- `PUT /api/admin/user/balance`
- `GET /api/admin/orders`
- `PUT /api/admin/order/update`
- `PATCH /api/admin/order/update/[id]`
- `GET /api/admin/order/[id]`
- `POST /api/admin/orders/export`
- `GET /api/admin/audit-logs`
- `GET /api/admin/transactions`

## Ghi chú domain

- Tiền tệ được lưu bằng số nguyên VND.
- Đơn giá mặc định đang dùng cho tính đơn là `75_000 VND / sản phẩm`.
- Link tạo đơn bắt buộc chứa chuỗi `shopee`.
- Link Shopee sau khi phân tích sẽ được chuẩn hóa trước khi lưu.
- `Ghi chú SĐT` ở form tạo đơn được gộp trực tiếp vào phần địa chỉ giao hàng.
- Khi số dư không đủ, API tạo đơn trả lỗi và không ghi dữ liệu.
- User export Excel chỉ thấy các trường phù hợp với quyền user.
- Admin export Excel có thêm các trường nội bộ như `SPC_ST`.
