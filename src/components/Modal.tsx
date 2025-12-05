import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
          >
            <div className="bg-[var(--bg-primary)] rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden pointer-events-auto border border-[var(--border-primary)] flex flex-col transition-colors shadow-2xl">
              <div className="p-6 border-b border-[var(--border-primary)] flex items-center justify-between flex-shrink-0 transition-colors">
                <h2 className="text-xl font-bold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} className="text-[var(--text-secondary)]" />
                </button>
              </div>
              <div className="px-6 pt-6 pb-4 overflow-y-auto flex-shrink">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
