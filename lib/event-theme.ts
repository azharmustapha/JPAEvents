export function resolveEventTheme(value: string | null | undefined): { kind: 'text'; text: string } | null {
  const text = value?.trim();
  return text ? { kind: 'text', text } : null;
}
