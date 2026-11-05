import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, SlidersHorizontal, Settings } from 'lucide-react';

export interface MoreOptionItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  description?: string;
  disabled?: boolean;
}

interface MoreOptionsDropdownProps {
  onSelectFields: () => void;
  customOptions?: MoreOptionItem[];
}

export function MoreOptionsDropdown({
  onSelectFields,
  customOptions = [],
}: MoreOptionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const options: MoreOptionItem[] = [
    {
      id: 'select-fields',
      label: 'Select Fields',
      icon: SlidersHorizontal,
      description: 'Choose visible columns & order',
      onClick: () => {
        setIsOpen(false);
        onSelectFields();
      },
    },
    ...customOptions,
  ];

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* 3 Horizontal Ellipses Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="More Options"
        aria-label="More Options"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center justify-center p-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-xs font-medium text-sm cursor-pointer ${
          isOpen ? 'ring-2 ring-blue-500 bg-gray-50 border-blue-400' : ''
        }`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="menu"
          aria-label="More Options"
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Popup Header */}
          <div className="px-3.5 py-2 border-b border-gray-100 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Settings className="w-3.5 h-3.5 text-gray-400" />
            <span>More Options</span>
          </div>

          {/* Options List */}
          <div className="py-1">
            {options.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                    item.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-blue-600" />}
                  <div className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    {item.description && (
                      <span className="text-2xs text-gray-400">{item.description}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
