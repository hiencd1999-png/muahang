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
        const shipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone || "";

        rows.push({
          "Session": session.session,
          "Ghi chú (Session)": session.note || "",
          "Mã ĐH": order.orderId,
          "Shop": order.shopName || "",
          "Sản phẩm": productNames,
          "Tổng tiền": order.total || "",
          "Trạng thái": order.status || "",
          "Mã VĐ": order.trackingNo || "",
          "SĐT Khách": order.phone || "",
          "Địa chỉ": order.address || "",
          "Người giao hàng": shipperName,
          "SĐT Người giao": shipperPhone,
          "Cập nhật lần cuối": new Date(order.updatedAt).toLocaleString("vi-VN"),
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
