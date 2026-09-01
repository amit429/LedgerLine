import { useEffect, useState } from "react";

/** Delays reflecting `value` until it stops changing for `delayMs`. Used to
 * keep search inputs responsive to typing while avoiding a network request
 * (and the skeleton flash it triggers) on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
