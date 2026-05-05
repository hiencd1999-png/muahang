import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sessionIds } = await request.json();

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: "No sessions selected" }, { status: 400 });
    }

    const sessions = await prisma.tiktokSession.findMany({
      where: {
        userId: auth.user.id,
        id: { in: sessionIds.map(Number) },
      },
      include: { orders: true },
    });

    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session không tồn tại hoặc không thuộc quyền sở hữu" }, { status: 404 });
    }

    const rows: Record<string, string | number>[] = [];

    for (const session of sessions) {
      for (const order of session.orders) {
        // Build product names
        let productNames = "";
        try {
          const products = order.products as any[] || [];
          productNames = products.map((p) => `${p.name} (x${p.qty})`).join(" | ");
        } catch (e) {}

        // Safely parse details for shipper info
        let parsedDetails = order.details as any;
        if (typeof parsedDetails === 'string') {
          try { parsedDetails = JSON.parse(parsedDetails); } catch (e) {}
        }
        
        const shipperName = parsedDetails?.detail?.shipper_name || parsedDetails?.shipper_name || "";
        let rawShipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone || "";
        const shipperPhone = rawShipperPhone ? rawShipperPhone.split(/Hotline/i)[0].trim() : "";
        const providerName = parsedDetails?.detail?.logistics?.provider_name || parsedDetails?.detail?.logistics?.delivery_option_name || parsedDetails?.detail?.logistics?.shipping_provider || parsedDetails?.detail?.logistics?.logistics_name || "";

        const ts = parsedDetails?.detail?.create_time || parsedDetails?.create_time;
        let orderTime = "";
        if (ts) {
          if (typeof ts === 'number') {
            orderTime = new Date(ts < 1e12 ? ts * 1000 : ts).toLocaleString("vi-VN");
          } else {
            orderTime = new Date(ts).toLocaleString("vi-VN");
          }
        } else if (order.updatedAt) {
          orderTime = new Date(order.updatedAt).toLocaleString("vi-VN");
        }

        const cleanStatus = order.status ? order.status.split(/Người nhận/i)[0].replace(/[.\s]+$/, '') : "";

        rows.push({
          "Session": session.session,
          "Ghi chú": session.note || "",
          "Mã Đơn": order.orderId,
          "Thời gian đặt": orderTime || "",
          "Tên shop": order.shopName || "",
          "Sản phẩm": productNames,
          "Tổng tiền": order.total || "",
          "Trạng thái": cleanStatus || "",
          "Mã Vận Đơn": order.trackingNo || "",
          "ĐVVC": providerName || "",
          "Shipper": shipperName,
          "SĐT Shipper": shipperPhone,
          "SĐT Khách": order.phone || "",
          "Địa chỉ": order.address || "",
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Không có đơn hàng nào trong các session đã chọn" }, { status: 400 });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TikTok Orders");

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="tiktok_orders_${Date.now()}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

  } catch (error) {
    console.error("Error exporting TikTok orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
