import { useState, useCallback } from "react";

export function useSubmitLock<T extends (...args: any[]) => Promise<any>>(submitFn: T) {
  const [submitting, setSubmitting] = useState(false);

  const execute = useCallback(async (...args: Parameters<T>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      return await submitFn(...args);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitFn]);

  return { submitting, execute };
}
