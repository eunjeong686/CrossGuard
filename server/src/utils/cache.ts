type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createTtlCache<T>() {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string) {
      const current = store.get(key);

      if (!current) {
        return null;
      }

      if (Date.now() > current.expiresAt) {
        store.delete(key);
        return null;
      }

      return current.value;
    },

    set(key: string, value: T, ttlMs: number) {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },
  };
}
