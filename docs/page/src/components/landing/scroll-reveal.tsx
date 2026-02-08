'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

export function ScrollReveal({ children, className, delayMs = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;

    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          window.requestAnimationFrame(() => setVisible(true));
          observer.disconnect();
        }
      },
      {
        threshold: [0, 0.35, 0.55, 0.75],
        rootMargin: '0px 0px -24% 0px',
      },
    );

    observer.observe(element);

    const onScrollFallback = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const triggerLine = Math.min(viewportHeight * 0.72, 620);
      if (rect.top <= triggerLine && rect.bottom > 0) {
        window.requestAnimationFrame(() => setVisible(true));
        observer.disconnect();
        window.removeEventListener('scroll', onScrollFallback);
        window.removeEventListener('resize', onScrollFallback);
      }
    };

    window.addEventListener('scroll', onScrollFallback, { passive: true });
    window.addEventListener('resize', onScrollFallback);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScrollFallback);
      window.removeEventListener('resize', onScrollFallback);
    };
  }, [visible]);

  const classes = ['bb-scroll-reveal', visible ? 'is-visible' : '', className].filter(Boolean).join(' ');
  const style = { '--bb-reveal-delay': `${delayMs}ms` } as CSSProperties;

  return (
    <div ref={ref} className={classes} style={style}>
      {children}
    </div>
  );
}
