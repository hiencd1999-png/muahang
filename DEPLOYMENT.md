# Hướng Dẫn Triển Khai DATDON Lên Máy Chủ CentOS (103.249.201.8)

Tài liệu này hướng dẫn chi tiết các bước đưa nền tảng Datdon (Next.js) lên production trên máy chủ CentOS `103.249.201.8` vận hành thông qua Nginx Reverse Proxy và PM2.

---

## 1. Yêu cầu hệ thống ban đầu (Prerequisites)

Đăng nhập vào máy chủ qua SSH:
```bash
ssh root@103.249.201.8
```

Tiến hành cài đặt Node.js (Về chuẩn bản 20.x), PM2, và Nginx:
```bash
# Cập nhật hệ thống
sudo yum update -y

# Cài đặt Nginx
sudo yum install epel-release -y
sudo yum install nginx -y

# Cài đặt Node.js (thông qua NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Cài đặt công cụ quản lý tiến trình PM2
sudo npm install -g pm2
```

---

## 2. Thiết lập dự án

Tạo thư mục chưa dự án và chuyển mã nguồn lên phân vùng:
```bash
mkdir -p /var/www/datdon
cd /var/www/datdon

# Thực hiện clone source code từ Git hoặc tải file zip lên. Truy xuất nội dung tại đây.
# Mẫu: git clone <URL_CUA_BAN> .
```

Cấu hình các tệp tin biến môi trường `.env`. Hãy chắc chắn đã có PostgreSQL / SQLite được tạo:
```bash
nano .env # (điền các thông tin của db và jwt)
```

Tiến hành kéo các Package, đồng bộ rễ Database và build đóng gói Tĩnh TurboPack:
```bash
# Cài đặt node_modules
npm install

# Đồng bộ Database 
npx prisma db push
npx prisma generate

# Build App cho Production Server
npm run build
```

---

## 3. Khởi chạy bằng PM2 Server Độc Lập

Khởi tạo môi trường daemon vĩnh trú bằng PM2 để Datdon chạy ngầm thay vì ngỏm khi đóng SSH terminal:
```bash
# Khởi động app qua Next.js server bằng cổng 3000
pm2 start npm --name "datdon-app" -- run start -- -p 3000

# Lưu trạng thái PM2 dể tự bật lại sau khi reboot Server
pm2 save
pm2 startup
```
*Lưu ý: Bạn có thể cài `pm2 logs datdon-app` để check tình trạng log Server Node.js.*

---

## 4. Cấu hình Nginx (Nginx Reverse Proxy)

Xóa file cấu hình Nginx mặc định để tránh xung đột cổng 80:
```bash
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nano /etc/nginx/conf.d/datdon.conf
```

**Nhập cấu hình chuẩn dưới đây vào file `datdon.conf`. Nginx sẽ chặn 103.249.201.8 mở cổng 80 trước, sau đó Reverse Proxy đẩy toàn bộ query vào Node.js (Localhost:3000):**

```nginx
server {
    listen 80;
    server_name 103.249.201.8; # Thay bằng Tên Miền nếu có (vd: datdon.com)

    # Chặn không phơi các file hệ thống (.env, .git...) ra mạng Internet
    location ~ /\. {
        deny all;
    }

    # Proxy đảo ngược vào Next.js App
    location / {
        proxy_pass http://localhost:3000;
        
        # Chuyển đổi Forwarded Header để theo dõi IP thực tế của Client
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cấu trúc dành riêng cho Websockets (Nếu sau này Datdon dùng)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Nâng giới hạn file tải lên để tránh lỗi Up ảnh
        client_max_body_size 20M;
    }
}
```

Kiểm tra xem cú pháp Nginx đã viết chuẩn chưa:
```bash
sudo nginx -t
```
Nếu báo `syntax is ok` và `test is successful`, ta tiến hành bật Nginx:

```bash
# Mở Nginx & Setup chạy ngầm cùng boot hệ thống
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## 5. Mở Nút Khoá Tường Lửa (CentOS Firewalld)

Trên CentOS, công tắc tường lửa rất được thắt chặt. Phải mở cổng Port 80 (HTTP) và Port 443 (HTTPS) mới có khả năng truy cập qua IP 103.249.201.8 từ máy ngoài mạng:

```bash
sudo firewall-cmd --permanent --zone=public --add-service=http
sudo firewall-cmd --permanent --zone=public --add-service=https
sudo firewall-cmd --reload
```

---

## 🎉 Hoàn tất

Xin chúc mừng! Ngay lập tức người ngoài có thể truy cập hệ thống qua URL `http://103.249.201.8`. Datdon.js hiện đã được bọc băng thông qua Nginx, đồng thời được quản trị an toàn bằng PM2. Mọi thông số lưu lượng giờ đây đều đang chạy thật trên môi trường Production!
