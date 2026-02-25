/**
 * Returns a human-readable relative time string in Portuguese.
 */
export function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'agora';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;

  const months = Math.floor(days / 30);
  return `há ${months}m`;
}

/**
 * Check if the WhatsApp inbound window is open (default 24h).
 * Based exclusively on last_inbound_at (last message received from client).
 */
export function isWindowOpen(lastInboundAt: string | undefined | null, windowHours = 24): boolean {
  if (!lastInboundAt) return false;
  const ts = new Date(lastInboundAt).getTime();
  return (Date.now() - ts) < windowHours * 60 * 60 * 1000;
}
