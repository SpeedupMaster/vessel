import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
  zIndex = 'z-50',
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (backdropRef.current && panelRef.current) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
        gsap.fromTo(
          panelRef.current,
          { opacity: 0, scale: isMobile ? 1 : 0.96, y: isMobile ? 40 : 15 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: isMobile ? 'power3.out' : 'back.out(1.2)' }
        );
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const modalElement = (
    <div className={`fixed inset-0 ${zIndex} flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 overflow-y-auto`}>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Modal / Bottom Sheet Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidth} bg-paper border-t sm:border border-line rounded-t-2xl sm:rounded-2xl shadow-floating p-5 sm:p-7 z-10 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-7`}
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-ink-muted/30 rounded-full mx-auto -mt-1.5 mb-3 sm:hidden shrink-0" />

        <div className="flex items-start justify-between pb-3.5 sm:pb-4 border-b border-line shrink-0">
          <div className="min-w-0 pr-3">
            <h3 className="text-base sm:text-lg font-semibold text-ink font-sans tracking-tight truncate sm:whitespace-normal">{title}</h3>
            {subtitle && <p className="text-xs text-ink-muted mt-0.5 truncate sm:whitespace-normal">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 text-ink-muted hover:text-ink p-1.5 sm:p-1 rounded-lg hover:bg-paper-3 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-3.5 sm:pt-4 px-0.5 sm:px-1.5 pb-1">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
