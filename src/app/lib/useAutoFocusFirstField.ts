import { RefObject, useEffect } from 'react';

// Any typeable field — skips buttons, tab switches and CustomSelect's own
// closed-dropdown trigger (a <button>, can't type into it) so autofocus
// always lands on something a user can start typing into immediately.
export const TYPEABLE_SELECTOR = 'input[type="text"], input[type="tel"], input[type="number"], input[type="email"], input[type="date"], input:not([type]), textarea';

// Focuses the first typeable field inside `ref` the moment a modal mounts
// (every bespoke Add/Edit modal that isn't built on the shared FormModal —
// VendorFormModal, AdvertiserFormModal, DonorFormModal, etc — is
// conditionally rendered by its caller, so "mounted" already means "just
// opened"; no separate `open` prop needed here, unlike FormModal itself).
export function useAutoFocusFirstField(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.querySelector<HTMLElement>(TYPEABLE_SELECTOR)?.focus();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
