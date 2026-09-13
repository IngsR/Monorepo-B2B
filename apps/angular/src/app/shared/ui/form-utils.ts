/**
 * Form Error UX Utilities.
 *
 * Focuses and shakes the first invalid field or error alert, and smoothly
 * scrolls the viewport to bring the problem into view.
 */
export function focusAndShakeFirstInvalid(container?: HTMLElement | Document): boolean {
  if (typeof document === 'undefined') return false;

  const root = container ?? document;

  // 1. Look for first field group with .has-error or first invalid control
  const invalidGroup = root.querySelector<HTMLElement>('.form-group.has-error, .has-error');
  const invalidInput = root.querySelector<HTMLElement>(
    '.has-error .form-input, .has-error .form-select, .has-error .form-textarea, .form-input.ng-invalid.ng-touched, .form-select.ng-invalid.ng-touched, .form-textarea.ng-invalid.ng-touched'
  );

  // 2. Look for error alert banner if no field group found
  const alertBanner = root.querySelector<HTMLElement>('.alert-danger, [role="alert"]');

  const target = invalidGroup ?? invalidInput ?? alertBanner;

  if (target) {
    // Restart animation
    target.classList.remove('animate-shake');
    void target.offsetWidth; // Force CSS reflow
    target.classList.add('animate-shake');

    // Smooth scroll to center the problematic field in viewport
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Focus input after smooth scroll initiates
    if (invalidInput) {
      setTimeout(() => {
        try {
          invalidInput.focus({ preventScroll: true });
        } catch {
          // ignore focus error
        }
      }, 150);
    }
    return true;
  }

  return false;
}
