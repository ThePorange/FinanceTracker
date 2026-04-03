import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultWidth?: number;
}

export function Drawer({ isOpen, onClose, title, children, defaultWidth = 450 }: DrawerProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setWidth(defaultWidth); // reset to default width upon open
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen, defaultWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 300) newWidth = 300;
      if (newWidth > window.innerWidth - 50) newWidth = window.innerWidth - 50;
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    if (isOpen) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen]);

  const startResizing = () => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="bg-white h-full shadow-2xl flex flex-col relative" 
        style={{ width: `${width}px`, transition: isResizing.current ? 'none' : 'transform 0.3s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Resizer Handle */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 flex flex-col justify-center items-center group transition-colors z-[60]"
          onMouseDown={startResizing}
        >
          <div className="h-16 w-1 bg-gray-300 rounded-full group-hover:bg-blue-400 group-active:bg-blue-600 transition-colors shadow-sm"></div>
        </div>

        <div className="p-4 pl-6 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <div className="p-0 overflow-y-auto flex-1 bg-white relative">
          {children}
        </div>
      </div>
    </div>
  );
}
