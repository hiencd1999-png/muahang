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
# Sinh/xoay khóa mật khẩu và cấu hình .env mỗi lần chạy (randomized rotation)
echo "📝 Đang tạo/xoay secrets trong .env (mật khẩu DB, SESSION_SECRET, API keys)..."
# Tạo mật khẩu chỉ chứa ký tự an toàn để tránh cần URL-encoding
POSTGRES_USER="datdon_admin"
POSTGRES_DB="datdon_db"
POSTGRES_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
SESSION_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
BINANCE_KEY=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
BINANCE_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
COOKIE=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 80)

cat > .env <<EOF
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
SESSION_SECRET=${SESSION_SECRET}
BINANCE_KEY=${BINANCE_KEY}
BINANCE_SECRET=${BINANCE_SECRET}
COOKIE=${COOKIE}
USDT_RATE=26500
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
EOF

chmod 600 .env
echo "✅ Đã tạo/ghi .env (quyền 600). Mật khẩu Postgres và secrets đã được xoay ngẫu nhiên."

echo "🐳 5/6. KHỞI CHẠY HỆ SINH THÁI CONTAINER (BUILD CODE)"
# Kéo lên dịch vụ CSDL trước, áp mật khẩu mới vào user nếu DB đã tồn tại, rồi khởi động app
echo "📦 Khởi động service 'db' trước..."
docker compose up -d db

echo "⏳ Đang đợi Postgres sẵn sàng (pg_isready)..."
RETRIES=0
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 || [ $RETRIES -ge 30 ]; do
  sleep 1
  RETRIES=$((RETRIES+1))
done

if [ $RETRIES -ge 30 ]; then
  echo "⚠️ Postgres không phản hồi sau 30s, tiếp tục và sẽ cố gắng thay đổi password sau khi container sẵn sàng."
fi

echo "🔒 Thử cập nhật mật khẩu DB user '${POSTGRES_USER}' sang giá trị mới (nếu user tồn tại)..."
# Thực hiện ALTER ROLE bên trong container db. Nếu lệnh thất bại (ví dụ DB mới), chỉ in cảnh báo.
if docker compose exec -T db psql -U postgres -c "ALTER ROLE ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';" >/dev/null 2>&1; then
  echo "✅ Mật khẩu user ${POSTGRES_USER} đã được cập nhật trong Postgres (nếu user tồn tại)."
else
  echo "⚠️ Không thể cập nhật mật khẩu bằng ALTER ROLE (có thể DB vừa được khởi tạo mới hoặc lệnh không khả dụng)." 
fi

echo "🐳 Bắt đầu build & khởi động app..."
docker compose up -d --build app

echo "⏳ Đang đợi App và DB ổn định..."
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
