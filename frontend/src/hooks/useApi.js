import { useState, useCallback, useEffect, useRef } from 'react';
import api, { extractErrorMessage } from '../api/client';

/**
 * Data-fetching hook with loading/error/retry + refetch.
 * fetcher: (signal) => Promise<axiosResponse> | null to skip
 */
export function useApi(fetcher, deps = [], { immediate = true, transform = (d) => d } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current();
      if (mounted.current) {
        setData(transform(res?.data?.data ?? res?.data ?? res));
        if (res?.data?.meta && mounted.current) {
          setData((prev) => (typeof prev === 'object' && prev !== null && !Array.isArray(prev) ? prev : prev));
        }
      }
    } catch (err) {
      if (mounted.current) setError(extractErrorMessage(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) run();
  }, [run, immediate]);

  return { data, loading, error, refetch: run, setData };
}

/** Fire a mutation with loading + error state. */
export function useMutation(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fn(...args);
        return res;
      } catch (err) {
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fn]
  );

  return { mutate, loading, error, setError };
}

export const get = (path, params) => api.get(path, { params });
export const post = (path, body) => api.post(path, body);
export const put = (path, body) => api.put(path, body);
export const del = (path, params) => api.delete(path, { params });

export default useApi;
