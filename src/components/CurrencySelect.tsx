import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import AssetLogo from "./AssetLogo";
import clsx from "clsx";

export interface CurrencyOption {
  value: string;
  label: string;
  group?: string;
}

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CurrencyOption[];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function CurrencySelect({
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  className = "",
}: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Group options by group label
  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || "Other";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(option);
    return acc;
  }, {} as Record<string, CurrencyOption[]>);

  // Flatten options for keyboard navigation
  const flatOptions = options;
  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setFocusedIndex(-1);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev < flatOptions.length - 1 ? prev + 1 : 0;
          // Scroll into view
          if (listRef.current) {
            const element = listRef.current.children[next] as HTMLElement;
            if (element) {
              element.scrollIntoView({ block: "nearest" });
            }
          }
          return next;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : flatOptions.length - 1;
          // Scroll into view
          if (listRef.current) {
            const element = listRef.current.children[next] as HTMLElement;
            if (element) {
              element.scrollIntoView({ block: "nearest" });
            }
          }
          return next;
        });
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < flatOptions.length) {
          handleSelect(flatOptions[focusedIndex].value);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, focusedIndex, flatOptions]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        // Focus the selected option when opening
        const index = flatOptions.findIndex(opt => opt.value === value);
        setFocusedIndex(index >= 0 ? index : 0);
      }
    }
  };

  // Find the group of the selected option for display
  const selectedGroup = selectedOption?.group;

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={clsx(
          "bg-[var(--bg-tertiary)] rounded-2xl px-6 py-4 font-bold text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] min-w-[140px] flex items-center justify-between gap-3",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-hyper-green/50"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {loading ? (
            <Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" />
          ) : selectedOption ? (
            <>
              <AssetLogo symbol={selectedOption.value} size={24} className="shrink-0" />
              <span className="truncate">{selectedOption.value}</span>
            </>
          ) : (
            <span className="text-[var(--text-secondary)]">Select...</span>
          )}
        </div>
        <ChevronDown
          size={20}
          className={clsx(
            "text-[var(--text-secondary)] shrink-0 transition-transform",
            isOpen && "transform rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 max-h-80 overflow-hidden transition-colors min-w-[200px]"
          >
            <div
              ref={listRef}
              className="overflow-y-auto max-h-80"
              role="listbox"
            >
              {loading && options.length === 0 ? (
                <div className="p-4 text-center text-[var(--text-secondary)] flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : Object.keys(groupedOptions).length === 0 ? (
                <div className="p-4 text-center text-[var(--text-secondary)] text-sm">
                  No options available
                </div>
              ) : (
                Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                  <div key={groupName}>
                    {Object.keys(groupedOptions).length > 1 && (
                      <div className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide bg-[var(--bg-secondary)] sticky top-0">
                        {groupName}
                      </div>
                    )}
                    {groupOptions.map((option, index) => {
                      const flatIndex = flatOptions.findIndex(opt => opt.value === option.value);
                      const isSelected = option.value === value;
                      const isFocused = flatIndex === focusedIndex;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelect(option.value)}
                          onMouseEnter={() => setFocusedIndex(flatIndex)}
                          className={clsx(
                            "w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3",
                            isSelected
                              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                              : isFocused
                              ? "bg-[var(--hover-bg)] text-[var(--text-primary)]"
                              : "text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <AssetLogo symbol={option.value} size={24} className="shrink-0" />
                          <span className="flex-1 truncate font-bold">{option.value}</span>
                          {isSelected && (
                            <div className="w-2 h-2 bg-hyper-green rounded-full shrink-0"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

