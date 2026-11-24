export function startPolling<T>(load: () => Promise<T>, onSuccess: (value: T) => void, onError: () => void, delayMs = 10000) {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    try {
      const result = await load();
      if (!disposed) onSuccess(result);
    } catch {
      if (!disposed) onError();
    } finally {
      if (!disposed) timer = setTimeout(refresh, delayMs);
    }
  }
  void refresh();
  return () => { disposed = true; clearTimeout(timer); };
}
