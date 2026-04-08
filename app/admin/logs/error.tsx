"use client";

export default function Error() {
  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div className="text-center py-8">
        <h2 className="text-lg font-semibold text-slate-900">Lỗi khi tải nhật ký</h2>
        <p className="mt-2 text-sm text-slate-600">Vui lòng thử lại sau</p>
      </div>
    </section>
  );
}
