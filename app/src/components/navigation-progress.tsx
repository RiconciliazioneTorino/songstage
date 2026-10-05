'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function Inner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  // Hide as soon as the new route commits.
  useEffect(() => {
    setVisible(false);
  }, [pathname, searchParams]);

  // Show as soon as the user clicks an in-app link.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = (e.target as HTMLElement | null)?.closest('a');
      if (!el) return;

      const href = el.getAttribute('href');
      if (!href) return;
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      )
        return;
      if (el.target && el.target !== '_self') return;
      if (el.hasAttribute('download')) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        )
          return;
      } catch {
        return;
      }

      setVisible(true);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 h-0.5 z-[9999] overflow-hidden pointer-events-none"
    >
      <div className="h-full bg-accent nav-progress-bar" />
    </div>
  );
}

export function NavigationProgress() {
  // useSearchParams requires a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
