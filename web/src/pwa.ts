// Optional PWA helpers (vite-plugin-pwa auto registers SW). We can listen to update events if needed.
export function initPWA() {
  if ('serviceWorker' in navigator) {
    // No-op for now; vite-plugin-pwa with registerType: 'autoUpdate' handles updates.
  }
}
