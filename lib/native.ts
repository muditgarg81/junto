/**
 * Native Capacitor utilities — all imports are dynamic so this module is
 * safe to import in SSR/web contexts (Capacitor plugins are no-ops on web).
 */

export async function hapticTap() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function hapticMedium() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticSuccess() {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

export async function hapticError() {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

/** Call once on app mount to style the Android status bar */
export async function initStatusBar() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    // Match the app's cream background (#fff9ed)
    await StatusBar.setBackgroundColor({ color: '#fff9ed' });
  } catch {}
}

/** Hide keyboard and remove focus from inputs */
export async function hideKeyboard() {
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.hide();
  } catch {}
}

/** Returns true when running inside a Capacitor native wrapper */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}
