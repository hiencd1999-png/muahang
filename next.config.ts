import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
  },
  // Cho phép HMR hoạt động trên các địa chỉ IP nội bộ để test trên điện thoại
  allowedDevOrigins: ["192.168.67.1", "192.168.0.101", "localhost:3000"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
