'use client';

/**
 * HydrationFix wraps children that may cause React #418 hydration mismatches.
 * It renders a placeholder on the server and hydrates with the same placeholder,
 * then swaps to the actual content after mounting.
 * 
 * This is a last-resort fix for hydration mismatches that cannot be traced to
 * specific server/client rendering differences.
 */
import { useEffect, useState, type ReactNode } from 'react';

interface HydrationFixProps {
  children: ReactNode;
  placeholder?: ReactNode;
  /** If true, renders null on server and always shows children after mount */
  clientOnly?: boolean;
}

export function HydrationFix({ children, placeholder = null, clientOnly = false }: HydrationFixProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // On server or first client render before hydration complete, show placeholder
  if (!mounted) {
    if (clientOnly) {
      return null;
    }
    return <>{placeholder}</>;
  }

  // After hydration, show actual children
  return <>{children}</>;
}
