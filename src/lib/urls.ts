// Server actions accept backPath from form data; only same-site paths may be redirect targets.
export function safeBackPath(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.startsWith('/') && !/^\/[/\\]/.test(value)
    ? value
    : fallback;
}
