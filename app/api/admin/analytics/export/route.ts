import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";

export async function GET(request: NextRequest) {
  const result = await requireApiUser("ADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const isSpAdmin = result.user.role === "SPADMIN";
  const searchParams = request.nextUrl.searchParams;
  const startParam = searchParams.get("from");
  const endParam = searchParams.get("to");

  if (!startParam || !endParam) return NextResponse.json({ error: "Missing date parameters" }, { status: 400 });

  const startDate = new Date(`${startParam}T00:00:00`);
  const endDate = new Date(`${endParam}T23:59:59.999`);

  const orderWhereCondition: any = {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  if (!isSpAdmin) {
    orderWhereCondition.approvedByAdminId = result.user.id;
  }

  const ordersInMonth = await prisma.order.findMany({
    where: orderWhereCondition,
    include: {
      user: { select: { username: true } },
    }
  });

  const admins = await prisma.user.findMany({
    where: isSpAdmin 
      ? { role: { in: ["ADMIN", "SPADMIN"] } }
      : { id: result.user.id },
    select: { id: true, username: true, fullName: true },
  });

  const adminMap = new Map(admins.map(a => [a.id, a]));

  const deliveredOrders = ordersInMonth.filter((o) => o.status === "DELIVERED" && o.complaintStatus !== "APPROVED");
  const canceledOrders = ordersInMonth.filter((o) => o.status === "CANCELED" || (o.status === "DELIVERED" && o.complaintStatus === "APPROVED"));
  
  let totalRevenue = 0;
  let totalSystemProfit = 0;
  let totalAdminCommission = 0;

  deliveredOrders.forEach(o => {
    totalRevenue += o.total;
    const commission = Math.floor(o.total * 0.95);
    totalAdminCommission += commission;
    totalSystemProfit += (o.total - commission);
  });

  const adminStats = admins.map((admin) => {
    const adminOrders = ordersInMonth.filter((o) => o.approvedByAdminId === admin.id);
    const successAdminOrders = adminOrders.filter((o) => o.status === "DELIVERED" && o.complaintStatus !== "APPROVED");
    const canceledAdminOrders = adminOrders.filter((o) => o.status === "CANCELED" || (o.status === "DELIVERED" && o.complaintStatus === "APPROVED"));
    
    let adminRev = 0;
    let adminComm = 0;
    successAdminOrders.forEach(o => {
      adminRev += o.total;
      adminComm += Math.floor(o.total * 0.95);
    });

    const statRow: any = {
      "Tên Admin": admin.fullName || admin.username,
      "Tài khoản Admin": admin.username,
      "Đơn nhận phân công": adminOrders.length,
      "Đơn giao thành công": successAdminOrders.length,
      "Đơn bị huỷ bỏ": canceledAdminOrders.length,
      "Tổng doanh thu (VNĐ)": adminRev,
      "Hoa hồng Admin 95% (VNĐ)": adminComm,
    };

    if (isSpAdmin) {
      statRow["Lợi nhuận hệ thống SPAdmin 5% (VNĐ)"] = adminRev - adminComm;
    }

    return statRow;
  }).sort((a, b) => b["Tổng doanh thu (VNĐ)"] - a["Tổng doanh thu (VNĐ)"]);

  // Create workbook
  const wb = xlsx.utils.book_new();

  // 1. Thống kê chung
  const generalStats = [
    { "Chỉ số": "Từ ngày", "Giá trị": startParam },
    { "Chỉ số": "Đến ngày", "Giá trị": endParam },
    { "Chỉ số": "Tổng số đơn", "Giá trị": ordersInMonth.length },
    { "Chỉ số": "Đơn thành công", "Giá trị": deliveredOrders.length },
    { "Chỉ số": "Đơn huỷ", "Giá trị": canceledOrders.length },
    { "Chỉ số": "Doanh thu thành công (VNĐ)", "Giá trị": totalRevenue },
  ];
  
  if (isSpAdmin) {
    generalStats.push(
      { "Chỉ số": "Tổng hoa hồng Admin (VNĐ)", "Giá trị": totalAdminCommission },
      { "Chỉ số": "Tổng Lợi nhuận SPAdmin (VNĐ)", "Giá trị": totalSystemProfit }
    );
  } else {
    generalStats.push(
      { "Chỉ số": "Tổng Hoa hồng Nhận được (95%)", "Giá trị": totalAdminCommission }
    );
  }
  const wsGeneral = xlsx.utils.json_to_sheet(generalStats);
  xlsx.utils.book_append_sheet(wb, wsGeneral, "Tổng quan");

  // 2. Thống kê theo Admin
  if (adminStats.length > 0) {
      const wsAdmin = xlsx.utils.json_to_sheet(adminStats);
      xlsx.utils.book_append_sheet(wb, wsAdmin, "Báo cáo Admin");
  }

  // 3. Chi tiết đơn hàng
  const orderDetails = ordersInMonth.map(o => {
      const admin = o.approvedByAdminId ? adminMap.get(o.approvedByAdminId) : null;
      let commission = 0;
      let profit = 0;
      if (o.status === "DELIVERED" && o.complaintStatus !== "APPROVED") {
          commission = Math.floor(o.total * 0.95);
          profit = o.total - commission;
      }

      const orderRow: any = {
          "Mã Đơn": o.id,
          "Ngày tạo": o.createdAt.toLocaleString("vi-VN"),
          "Khách hàng": o.user?.username || "",
          "Admin phụ trách": admin ? (admin.fullName || admin.username) : "",
          "Trạng thái": o.status,
          "Giá trị đơn (VNĐ)": o.total,
          "Hoa hồng 95% (VNĐ)": commission,
      };

      if (isSpAdmin) {
          orderRow["Lợi nhuận SPAdmin 5% (VNĐ)"] = profit;
      }

      orderRow["Voucher áp dụng"] = o.voucherLabel || "";
      orderRow["Mã vận đơn"] = o.trackingNo || "";

      return orderRow;
  });

  if (orderDetails.length > 0) {
      const wsOrders = xlsx.utils.json_to_sheet(orderDetails);
      xlsx.utils.book_append_sheet(wb, wsOrders, "Chi tiết đơn");
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="bao_cao_doanh_thu_${startParam}_to_${endParam}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
