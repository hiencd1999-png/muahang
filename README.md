# DatDon Shopee

Hệ thống đặt đơn Shopee với hai vai trò `USER` và `ADMIN`, xây dựng bằng Next.js App Router, Prisma và SQLite.

## Chức năng chính

- Đăng ký, đăng nhập bằng cookie JWT session.
- Dashboard người dùng với số dư, đơn gần đây và thao tác nhanh.
- Nạp tiền vào tài khoản, lưu lịch sử giao dịch.
- Tạo đơn Shopee, tự tính tiền và trừ balance nếu đủ số dư.
- Theo dõi lịch sử đơn với các trạng thái `PENDING`, `PROCESSING`, `COMPLETED`, `CANCELED`.
- Trang profile để xem thông tin tài khoản và đổi mật khẩu.
- Admin dashboard để quản lý user, đơn hàng và transactions.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- SQLite
- Cookie-based JWT auth với `jose`

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
- Password: `admin123`

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
- `GET /api/admin/users`
- `PUT /api/admin/user/balance`
- `GET /api/admin/orders`
- `PUT /api/admin/order/update`
- `GET /api/admin/transactions`

## Ghi chú domain

- Tiền tệ được lưu bằng số nguyên VND.
- Đơn giá mặc định đang dùng cho tính đơn là `75_000 VND / sản phẩm`.
- Link tạo đơn bắt buộc chứa chuỗi `shopee`.
- Khi số dư không đủ, API tạo đơn trả lỗi và không ghi dữ liệu.
