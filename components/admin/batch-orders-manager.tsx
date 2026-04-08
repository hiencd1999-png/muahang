"use client";

import { useState } from "react";
import { BatchActionsToolbar } from "./batch-actions-toolbar";

export function BatchOrdersManager({
  children,
  totalCount,
}: {
  children: React.ReactNode;
  totalCount: number;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = (ids: number[]) => {
    setSelectedIds(ids);
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Pass down selection handlers via clone */}
      {typeof children === "function" 
        ? (children as any)({ 
            selectedIds, 
            toggleSelect, 
            selectAll, 
            clearAll 
          })
        : children}

      <BatchActionsToolbar
        selectedCount={selectedIds.length}
        totalCount={totalCount}
        onSelectAll={() => selectAll([...Array(totalCount).keys()].map((_, i) => i + 1))}
        onClearAll={clearAll}
        actionType="orders"
      />
    </div>
  );
}
