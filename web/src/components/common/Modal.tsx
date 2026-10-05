import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
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
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
        gsap.fromTo(
          panelRef.current,
          { opacity: 0, scale: 0.96, y: 15 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.2)' }
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
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 sm:p-6 overflow-y-auto`}>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidth} bg-paper border border-line rounded-xl shadow-floating p-6 sm:p-7 z-10 flex flex-col max-h-[90vh] overflow-hidden`}
      >
        <div className="flex items-start justify-between pb-4 border-b border-line">
          <div>
            <h3 className="text-lg font-semibold text-ink font-sans tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded hover:bg-paper-3 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-4 px-1.5 pb-1">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
