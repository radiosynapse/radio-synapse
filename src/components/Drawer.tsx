import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  isFullScreen?: boolean;
  maxWidthClass?: string;
  id?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  isFullScreen = false,
  maxWidthClass = 'max-w-xl sm:max-w-2xl',
  id = 'slide-drawer',
}: DrawerProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startScrollTopRef = useRef<number>(0);
  const isFromScrollAreaRef = useRef<boolean>(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Reset drag offset when opened or closed
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      startYRef.current = null;
    }
  }, [isOpen]);

  const isInteractive = (target: HTMLElement): boolean => {
    return !!target.closest('button, a, input, select, textarea, [role="button"], [role="slider"], audio, video');
  };

  // Touch Handlers for Universal Anchored Drag-Down
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (isInteractive(target)) {
      return;
    }

    const isInScrollContainer = !!target.closest('.drawer-scroll-body');
    isFromScrollAreaRef.current = isInScrollContainer;
    startScrollTopRef.current = contentRef.current ? contentRef.current.scrollTop : 0;

    // If starting inside scroll container, only allow anchor if we're near the top
    if (isInScrollContainer && startScrollTopRef.current > 5) {
      return;
    }

    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // If touching inside scroll area, verify scroll position
    if (isFromScrollAreaRef.current && contentRef.current && contentRef.current.scrollTop > 5) {
      startYRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    // Only allow downward drag
    if (diff > 0) {
      setDragOffset(diff);
    } else {
      setDragOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset > 75) {
      onClose();
    }
    setDragOffset(0);
    setIsDragging(false);
    startYRef.current = null;
  };

  // Mouse Handlers for Desktop Drag-Down on any empty space / anchor point
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (isInteractive(target)) {
      return;
    }

    const isInScrollContainer = !!target.closest('.drawer-scroll-body');
    isFromScrollAreaRef.current = isInScrollContainer;
    startScrollTopRef.current = contentRef.current ? contentRef.current.scrollTop : 0;

    if (isInScrollContainer && startScrollTopRef.current > 5) {
      return;
    }

    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || startYRef.current === null) return;
    const diff = e.clientY - startYRef.current;

    if (isFromScrollAreaRef.current && contentRef.current && contentRef.current.scrollTop > 5) {
      return;
    }

    if (diff > 0) {
      setDragOffset(diff);
    }
  }, [isDragging]);

  const handleGlobalMouseUp = useCallback(() => {
    if (isDragging) {
      if (dragOffset > 75) {
        onClose();
      }
      setDragOffset(0);
      setIsDragging(false);
      startYRef.current = null;
    }
  }, [isDragging, dragOffset, onClose]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Drawer Container with Universal Anchor Zone */}
      <div
        id={id}
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        className={`fixed inset-x-0 bottom-0 z-40 mx-auto bg-[#08080b]/98 backdrop-blur-3xl border-t border-white/15 shadow-[0_-25px_70px_rgba(0,0,0,0.95)] flex flex-col transition-transform ${
          isDragging ? 'transition-none' : 'duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]'
        } ${maxWidthClass} ${
          isFullScreen 
            ? 'top-0 h-screen rounded-t-none sm:rounded-t-3xl border-t-0 sm:border-t' 
            : 'rounded-t-3xl'
        } ${
          isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
        style={{
          transform: isOpen 
            ? dragOffset > 0 ? `translateY(${dragOffset}px)` : 'translateY(0)' 
            : 'translateY(100%)',
          maxHeight: isFullScreen ? '100dvh' : '82vh',
          height: isFullScreen ? '100dvh' : undefined
        }}
      >
        {/* Top Tactile Handle (pure visual handle bar without text) */}
        <div 
          className="w-full flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none group flex-shrink-0"
        >
          <div className="w-12 sm:w-14 h-1.5 bg-zinc-600/80 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* Drawer Header with Title & Downward Arrow Close Button */}
        <div 
          className="flex items-center justify-between px-5 sm:px-7 py-3 border-b border-white/10 select-none flex-shrink-0"
        >
          <div className="flex flex-col text-left min-w-0">
            {typeof title === 'string' ? (
              <h3 className="text-base sm:text-lg font-mono font-bold uppercase tracking-wider text-white truncate">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
            {headerActions}
            {/* Downward Arrow for closing by click */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all transform active:scale-95 cursor-pointer flex items-center justify-center"
              title="Fermer le volet"
              aria-label="Fermer le volet"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body with anchor zone */}
        <div 
          ref={contentRef}
          className="drawer-scroll-body flex-1 overflow-y-auto px-5 sm:px-7 py-4 sm:py-6 overscroll-contain flex flex-col min-h-0"
        >
          {children}
        </div>
      </div>
    </>
  );
}
