import { useState } from "react";

interface Order {
  id: string;
  link: string;
  totalAmount: number;
  fee: number | null;
  status: "PENDING" | "PROCESSING" | "ORDER_PLACED" | "TRACKING_GENERATED" | "DELIVERED" | "CANCELED";
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

interface UserInfo {
  username: string;
  email: string;
  phone: string;
}

export function useOrderDetailModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);

  const openModal = (order: Order, user?: UserInfo) => {
    setSelectedOrder(order);
    setSelectedUser(user || null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setSelectedOrder(null);
    setSelectedUser(null);
  };

  return {
    isOpen,
    selectedOrder,
    selectedUser,
    openModal,
    closeModal,
  };
}
