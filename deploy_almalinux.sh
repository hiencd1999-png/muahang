#!/bin/bash

# ==============================================================================
# DATDON - 1-CLICK DEPLOYMENT SCRIPT FOR ALMALINUX 9 (DOCKER + NGINX REVERSE PROXY)
# ==============================================================================
# Lưu ý: Chạy script này BẰNG QUYỀN ROOT bên trong thư mục gốc chứa Code.
# Lệnh chạy: sudo bash deploy_almalinux.sh
# ==============================================================================

set -e # Dừng tiến trình ngay lập tức nếu có bất kỳ lệnh nào bị lỗi

echo "🚀 BẮT ĐẦU QUÁ TRÌNH CÀI ĐẶT SERVER DATDON..."

# 1. Kiểm tra Quyền Root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Vui lòng chạy lệnh này bằng quyền root (thêm sudo ở trước)."
  exit 1
fi

echo "📦 1/5. TRANG BỊ MÔI TRƯỜNG & CÀI ĐẶT DOCKER"
# Cập nhật và cài đặt công cụ thiết yếu
dnf update -y
dnf install -y curl wget git nano unzip tar epel-release yum-utils

echo "📥 2/6. CLONE MÃ NGUỒN TỪ GITHUB"
# Thiết lập không gian cài đặt chuẩn mực
WORK_DIR="/var/www/datdon"

if [ ! -d "$WORK_DIR" ]; then
  mkdir -p "$WORK_DIR"
  echo "⏬ Đang tải mã nguồn từ Github vào $WORK_DIR..."
  git clone https://github.com/hiencd1999-png/muahang.git "$WORK_DIR"
else
  echo "⚠️ Thư mục $WORK_DIR đã tồn tại. Đang tiến hành Git Pull cập nhật rẽ nhánh..."
  cd "$WORK_DIR"
  git pull origin master || echo "Cảnh báo Repo không update tự động được."
fi

# Ép kịch bản di chuyển vào Thư mục chính để thực thi các lệnh phía sau
cd "$WORK_DIR"

echo "📦 3/6. CÀI ĐẶT DOCKER ENGINE TỪ REPO CHÍNH CHỦ"
# Cài đặt cấu hình Docker repository cho AlmaLinux
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
# Cài đặt lõi Docker và Plugin Compose
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Khởi chạy Docker và bật cùng hệ điều hành
systemctl enable --now docker
echo "✅ Cài đặt Docker thành công!"

echo "🔐 4/6. KHỞI TẠO MÔI TRƯỜNG BẢO MẬT & ĐÓNG GÓI DATABASE"
# Sinh mã chống giả mạo tự động nếu file .env chưa từng tồn tại
if [ ! -f .env ]; then
    echo "📝 Đang gieo cấu hình .env tự động..."
    cat <<EOF > .env
DATABASE_URL="postgresql://datdon_admin:Hienhoi123%40@db:5432/datdon_db?schema=public"
SESSION_SECRET="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)"
EOF
    echo "✅ Đã gieo cấu hình môi trường."
fi

echo "🐳 5/6. KHỞI CHẠY HỆ SINH THÁI CONTAINER (BUILD CODE)"
# Kéo hạ CSDL Postgres và Build App (Quá trình này tốn khoảng 2-5 Phút)
docker compose up -d --build

# Chờ 5 giây cho Database thiết lập đường truyền nội bộ cứng cáp
echo "⏳ Đang đợi Cơ sở dữ liệu khởi động..."
sleep 5

echo "🌱 Thực thi Cài đặt Database và nạp Data gốc..."
# Ép Nạp DB (Tham số -T để bỏ qua tính năng TTY giao diện khi chạy Script ngầm)
docker compose exec -T app npx tsx prisma/seed.ts || echo "⚠️ Lệnh Seed đã được chạy trước đó hoặc cảnh báo bỏ qua."
echo "✅ Build ứng dụng Next.JS & Postgres Hoàn tất!"

echo "🌐 6/6. THIẾT LẬP TƯỜNG LỬA CHUYỂN HƯỚNG MẠNG (NGINX FIREWALL)"
# Cài Nginx
dnf install -y nginx

# Bóc tách và viết đè lại Cấu Hình Server Proxy trỏ về nhánh 3000 của Docker
cat <<EOF > /etc/nginx/conf.d/datdon.conf
server {
    listen 80;
    server_name datdon.otistx.com; 

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        # Định vị dữ liệu Firewall và Rate Limiting 
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Restart và cấp giấy thông hành hệ điều hành
systemctl enable --now nginx
systemctl restart nginx
echo "✅ Kết nối NGINX nội bộ tới mạng Docker thành công!"

echo "🛡️ 5/5. CẤU HÌNH TƯỜNG LỬA (FIREWALLD)"
# Cho phép khách truy cập web đâm xuyên qua hệ điều hành
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo "✅ Mở cổng HTTP/HTTPS Thành công!"
else
    echo "⚠️ Firewalld không được cài đặt mặc định trên OS này. (Hãy đảm bảo mở port 80 và 443 trên Panel quản lý VPS của bạn)."
fi

# ==================================
# KẾT THÚC
# ==================================
PUBLIC_IP=$(curl -s ifconfig.me || echo "IP_Máy_Chủ_Của_Bạn")
echo "--------------------------------------------------------"
echo "🎉 XIN CHÚC MỪNG! HỆ THỐNG DATDON NEXT.JS ĐÃ SẴN SÀNG!"
echo "--------------------------------------------------------"
echo "👉 Truy cập bằng Trình duyệt: http://$PUBLIC_IP"
echo "👉 Để xem nhật ký lỗi hệ thống (Log), vui lòng gõ: docker compose logs -f app"
echo "👉 Đừng quên đổi Pass SQL và thay đổi tên miền sau này nhé!"
echo "--------------------------------------------------------"
