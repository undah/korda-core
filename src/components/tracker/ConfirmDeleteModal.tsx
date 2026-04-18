// src/components/tracker/ConfirmDeleteModal.tsx
import React from "react";

interface Props {
  open: boolean;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDeleteModal({ open, label = "this entry", onConfirm, onCancel, loading }: Props) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(7,9,11,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(6px)",
    }}>
      <div style={{
        background: "#0c1217",
        border: "1px solid rgba(212,112,90,0.2)",
        borderTop: "1px solid rgba(212,112,90,0.5)",
        padding: "2.5rem", maxWidth: 400, width: "90%",
      }}>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(212,112,90,0.5)", marginBottom: "1rem" }}>
          // confirm delete
        </p>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", fontWeight: 400, color: "#dde8ed", marginBottom: "0.75rem" }}>
          Delete entry?
        </h3>
        <p style={{ fontSize: "0.85rem", color: "rgba(221,232,237,0.45)", lineHeight: 1.75, marginBottom: "2rem" }}>
          Are you sure you want to delete {label}? This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.75rem",
              letterSpacing: "0.08em", background: "rgba(212,112,90,0.12)",
              border: "1px solid rgba(212,112,90,0.4)", color: "#d4705a",
              padding: "0.75rem", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {loading ? "Deleting..." : "Delete →"}
          </button>
          <button
            onClick={onCancel}
            className="kt-btn kt-btn-outline"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
