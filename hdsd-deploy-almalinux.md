# Hướng Dẫn Triển Khai Hệ Thống DOCKER Trên AlmaLinux 9.4

> [!CAUTION]
> Bạn đã chia sẻ mật khẩu Root. Hãy đổi mật khẩu `root` nay lập tức sau khi setup xong bằng lệnh `passwd` để bảo mật máy chủ an toàn nhất nhé.

Quy trình dưới đây sử dụng **Docker & Docker Compose** để đóng gói toàn vẹn hệ thống DatDon (bao gồm cả PostgreSQL Database và Next.JS Server). Kiến trúc này giúp quản lý tập trung và thiết lập chuẩn môi trường Production cực kì đơn giản cho IP: `116.118.4.45`.

---

## Bước 1: SSH Vào Máy Chủ & Cập Nhật Hệ Thống

Mở Terminal (Mobaxterm hoặc Powershell) trên máy tính của bạn và gõ:
```bash
ssh root@116.118.4.45
# Mật khẩu: 2vIaft58
```

Tiến hành dọn dẹp và cập nhật nhân AlmaLinux:
```bash
dnf update -y
dnf install -y curl wget git nano unzip tar epel-release
```

---

## Bước 2: Cài Đặt Khung Xương Docker & Docker Compose

Xóa các phiên bản Docker lỗi thời (nếu có) và cài đặt kho DNF chính thức của Docker:
```bash
dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Thiết lập cho Docker khởi động cùng hệ điều hành:
```bash
systemctl enable --now docker
# Kiểm tra phiên bản compose:
docker compose version
```

---

## Bước 3: Tải Source Code Gốc Về Môi Trường Mới

(Lưu ý bỏ qua bước này nếu bạn đã đẩy thư mục mã nguồn DatDon qua lệnh Git hoặc qua FPT Server rồi).
```bash
mkdir -p /var/www/datdon
cd /var/www/datdon
# Git clone bộ mã hoặc Upload mã nguồn của bạn vào thư mục này.
```

---

## Bước 4: Khởi Động Container (Bước Quan Trọng Nhất)

Trong thư mục mã nguồn mà tôi đang làm việc hiện tại, tôi đã tạo sẵn sẵn 3 tấm thẻ căn cước:
- `Dockerfile` (Chế độ Alpine 20 tối giản đóng gói Node.JS dạng standalone)
- `docker-compose.yml` (Tự động thiết lập mạng nội bộ cho Postgres 16 đứng sát Next.JS App)
- `next.config.ts` (Đã bật chế độ `output: "standalone"`)

Chỉ cần bạn đang đứng trong file thư mục gốc (nơi chứa file `docker-compose.yml`), hãy nhập ma pháp này:
```bash
# Lệnh này sẽ tự động tải cả Postgres, tự Build Next.JS và ghép nối kết nối 2 thành phần
docker compose up -d --build
```

Để kiểm tra xem hệ thống khởi tạo Database mượt chưa, bạn xem Log với lệnh:
```bash
docker compose logs -f app
```
*(Nếu thấy `Listening on port 3000` là thành công!)*

Để nạp Data ban đầu cho các Tài Quản Trị Hệ Thống (Seed Account Bank/Commissions), hãy lệnh container chạy file TSX:
```bash
docker exec -it datdon_app npx tsx scratch/seed.ts
```

---

## Bước 5: Cài Đặt Tường Lửa Chuyển Hướng NGINX (Reverse Proxy)

Docker Compose nội bộ đẩy cổng ra `3000`. Để thế giới kết nối trực diện được vào Name miền chuẩn (Port 80/443), bạn cần Cổng NGINX đứng chặn ngoài.

**1. Cài đặt NGINX Service Tĩnh:**
```bash
dnf install -y nginx
systemctl enable --now nginx
```

**2. Gắn Dây Định Tuyến:**
```bash
nano /etc/nginx/conf.d/datdon.conf
```

Chèn nội dung cấu hình chuyển hóa Request cho cổng `3000`:
```nginx
server {
    listen 80;
    server_name 116.118.4.45; # Hoặc thay thành Tên Miền Của Bạn (vd: datdon.vn)
    
    # Giới hạn dung lượng tải files hình (Chứng từ ngân hàng)
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        # Định vị X-Forwarded-For cho bảo mật Rate Limit của Datdon chống DDoS
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

(Bấm `Ctrl+X` $\rightarrow$ `Y` $\rightarrow$ `Enter`).

**3. Khởi Lại Trạm Nginx:**
```bash
nginx -t
systemctl restart nginx
```

**4. Dọn đường thông Firewall Linux:**
Mở cổng HTTP/HTTPS đi qua lớp bọc mặc định của AlmaLinux:
```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

---

> [!TIP]
> 🏆 **Hoàn Tất Nhanh Chóng!** Việc sử dụng Container giảm thiểu hoàn toàn thời gian cài đặt CSDL & NodeJS. Trình thiết lập siêu gọn nhẹ, bạn chỉ việc gõ IP `116.118.4.45` lên thanh URL của trình duyệt là mọi thứ sẽ chạy ngay lập tức!
