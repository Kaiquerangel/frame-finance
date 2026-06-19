// Hook simples para loading + erro em qualquer página
import { useState, useCallback } from "react";

export function useLoading(initialLoading = true) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError]     = useState(null);

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
