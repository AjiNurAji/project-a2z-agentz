'use client';
import { useEffect, useRef } from 'react';

export interface UseKeyboardShortcutOptions {
  preventDefault?: boolean;
  enabled?: boolean;
}

export function useKeyboardShortcut(
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
) {
  const { preventDefault = true, enabled = true } = options;
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Check user preference in localStorage dynamically
      const shortcutsEnabled = typeof window !== 'undefined'
        ? localStorage.getItem('a2z-shortcuts-enabled') !== 'false'
        : true;

      if (!shortcutsEnabled) return;

      // Prevent triggering shortcuts when focus is in input fields or contenteditable zones
      const target = e.target as HTMLElement;
      if (target && typeof target.tagName === 'string') {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.contentEditable === 'true' ||
          target.getAttribute('contenteditable') === 'true' ||
          target.getAttribute('contenteditable') === '' ||
          (typeof target.getAttribute === 'function' && target.getAttribute('role') === 'textbox')
        ) {
          return;
        }
      }

      const match = keys.includes(e.key);

      if (match) {
        if (preventDefault) {
          e.preventDefault();
        }
        callbackRef.current(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [keys, preventDefault, enabled]);
}
