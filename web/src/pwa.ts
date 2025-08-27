// Optional PWA helpers: register Service Worker and notify when updates are available.
// Tip: Vite PWA provides a virtual module to register SW and expose an update function.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { registerSW } from 'virtual:pwa-register'

export function initPWA(onNeedRefresh?: (update: (reload?: boolean) => void) => void) {
  if ('serviceWorker' in navigator) {
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          onNeedRefresh?.((reload?: boolean) => updateSW(Boolean(reload)))
        },
        onOfflineReady() {
          // noop
        },
      })
    } catch {}
  }
}
