import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, isNative } from '../lib/api';

/**
 * Registers the device with FCM and sends the token to our backend.
 * Native (Android) only — web users keep using existing Web Push via usePushNotifications.
 *
 * Runs on every login transition and once on app start when user is authed.
 */
export function useFcmRegistration() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!isNative()) return;
    if (!userId) return;

    let cancelled = false;
    let registrationListener: any;
    let errorListener: any;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1. Ask permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn('[fcm] notification permission denied');
          return;
        }

        // 2. Register listeners BEFORE calling register()
        registrationListener = await PushNotifications.addListener('registration', async (t) => {
          if (cancelled) return;
          try {
            await apiFetch('/api/push/fcm/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: t.value, platform: 'android' }),
            });
          } catch (err) {
            console.error('[fcm] backend register failed', err);
          }
        });

        errorListener = await PushNotifications.addListener('registrationError', (err) => {
          console.error('[fcm] registration error', err);
        });

        // 3. Request FCM token
        await PushNotifications.register();
      } catch (err) {
        console.error('[fcm] setup failed', err);
      }
    })();

    return () => {
      cancelled = true;
      registrationListener?.remove?.();
      errorListener?.remove?.();
    };
  }, [userId]);
}
