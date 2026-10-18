import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { X } from '@phosphor-icons/react';
import { EASE_OUT, prefersReducedMotion } from '../../lib/motion.js';

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
  // Stays true through the exit animation so the panel can animate out before unmounting
  const [rendered, setRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRendered(true);
  }, [isOpen]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!rendered || !backdrop || !panel) return;

    const isMobile = window.innerWidth < 640;
    const reduced = prefersReducedMotion();

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (reduced) return;
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(
        panel,
        isMobile ? { yPercent: 100 } : { opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          yPercent: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: isMobile ? 0.5 : 0.55,
          ease: EASE_OUT,
          clearProps: 'transform,filter',
        }
      );
      return;
    }

    // Closing
    document.body.style.overflow = '';
    if (reduced) {
      setRendered(false);
      return;
    }
    const tl = gsap.timeline({ onComplete: () => setRendered(false) });
    tl.to(panel, isMobile ? { yPercent: 100, duration: 0.28, ease: 'power3.in' } : { opacity: 0, y: 8, scale: 0.98, duration: 0.18, ease: 'power2.in' }, 0);
    tl.to(backdrop, { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0);
    return () => {
      tl.kill();
    };
  }, [isOpen, rendered]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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

  if (!rendered || typeof document === 'undefined') return null;

  const modalElement = (
    <div
      className={`fixed inset-0 ${zIndex} flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 overflow-y-auto`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={isOpen ? onClose : undefined}
        className="fixed inset-0 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px]"
      />

      {/* Modal / Bottom Sheet Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} surface-pop rounded-t-[24px] sm:rounded-[22px] p-5 sm:p-7 z-10 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-7`}
      >
        {/* Mobile Grab Handle */}
        <div className="w-9 h-1 bg-ink-faint/30 rounded-full mx-auto -mt-1.5 mb-3 sm:hidden shrink-0" />

        <div className="flex items-start justify-between pb-4 border-b border-line-subtle shrink-0">
          <div className="min-w-0 pr-3">
            <h3 className="text-base sm:text-[17px] font-semibold text-ink tracking-[-0.015em] truncate sm:whitespace-normal">{title}</h3>
            {subtitle && <p className="text-xs text-ink-muted mt-1 truncate sm:whitespace-normal">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="group min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 text-ink-muted hover:text-ink p-1.5 rounded-xl hover:bg-paper-3 transition-colors flex items-center justify-center shrink-0 cursor-pointer -mr-1.5 -mt-0.5"
          >
            <X className="w-[18px] h-[18px] transition-transform duration-300 ease-spring group-hover:rotate-90" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-4 sm:pt-5 px-0.5 sm:px-1.5 pb-1">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
