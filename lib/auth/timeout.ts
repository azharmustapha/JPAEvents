export async function withAuthTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Authentication timed out'));
    }, timeoutMs);
  });
  try { return await Promise.race([operation(controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
