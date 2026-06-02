import { useState, useEffect } from 'react';

export function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (target.tagName === 'INPUT') {
          const type = (target as HTMLInputElement).type;
          if (['radio', 'checkbox', 'button', 'submit', 'image', 'file'].includes(type)) {
            return;
          }
        }
        setIsOpen(true);
      }
    };

    const onFocusOut = () => {
      setIsOpen(false);
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return isOpen;
}
