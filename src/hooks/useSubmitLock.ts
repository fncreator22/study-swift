import { useState, useCallback, useRef } from "react";

export function useSubmitLock<T extends (...args: any[]) => Promise<any>>(submitFn: T) {
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const execute = useCallback(async (...args: Parameters<T>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      return await submitFn(...args);
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }, [submitFn]);

  return { submitting, execute };
}
