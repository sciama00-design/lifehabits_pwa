
export const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

/** Returns true if the current device is an iOS device (iPhone/iPad/iPod) */
export const isIOS = (): boolean =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad with iPadOS 13+ reports as "MacIntel" but has touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Returns true if the app is running in standalone/installed mode (Add to Home Screen) */
export const isStandalone = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true

/** Returns true if iOS push notifications are currently supported (installed PWA on iOS 16.4+) */
export const isIOSPushSupported = (): boolean => isIOS() && isStandalone()
