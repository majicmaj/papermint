import { useOffline } from '../pwa/connectivity';

/**
 * One small dot, no words: the network cannot be reached, so changes are off. The slot is
 * always there, so the dot appearing moves nothing.
 */
export function SyncDot() {
  const offline = useOffline();
  return (
    <span
      class="sync-dot"
      data-state={offline ? 'offline' : 'idle'}
      role={offline ? 'status' : undefined}
      aria-label={offline ? 'Offline' : undefined}
      title={offline ? 'Offline' : undefined}
    />
  );
}
