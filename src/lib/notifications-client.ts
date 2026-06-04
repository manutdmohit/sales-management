/** Fired when server-side notifications may have changed (badge should refresh). */
export const NOTIFICATIONS_CHANGED_EVENT = "inventory:notifications-changed";

export function notifyNotificationsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}
