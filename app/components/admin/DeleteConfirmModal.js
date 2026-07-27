// app/components/admin/DeleteConfirmModal.js
"use client";

import { AlertTriangle, X } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Item",
  message = "Are you sure you want to delete this? This action cannot be undone.",
  itemName,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={26} className="text-red-500" />
        </div>

        <h2 className="text-lg font-semibold text-gray-900 text-center">
          {title}
        </h2>
        <p className="text-sm text-gray-500 text-center mt-1.5">{message}</p>

        {itemName && (
          <div className="bg-red-50 rounded-lg px-4 py-2.5 mt-4 text-center">
            <strong className="text-sm text-gray-900">{itemName}</strong>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
