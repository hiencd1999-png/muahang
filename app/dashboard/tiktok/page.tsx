import { Metadata } from "next";
import { TiktokView } from "@/components/dashboard/tiktok-view";

export const metadata: Metadata = {
  title: "Quản lý TikTok",
  description: "Quản lý đơn hàng TikTok",
};

export default function TiktokPage() {
  return <TiktokView />;
}
