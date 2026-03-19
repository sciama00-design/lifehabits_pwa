
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { urlBase64ToUint8Array, isIOS, isStandalone } from '@/lib/pushUtils'
import { useAuth } from './useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export function usePushNotifications() {
    const { user } = useAuth()
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const iosDevice = isIOS()
    const standalone = isStandalone()

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission)
            checkSubscription()
        }
    }, [])

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)

            // Auto-sync: if we have a locally active subscription, ensure it's in the DB
            if (sub && user) {
                syncSubscription(sub, user.id);
            }
        }
    }

    const syncSubscription = async (sub: PushSubscription, userId: string) => {
        try {
            const { data: existing } = await supabase
                .from('push_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .eq('subscription->>endpoint', sub.endpoint)
                .maybeSingle();

            if (!existing) {
                console.log("Sync: Subscription missing from DB, re-saving...");
                await supabase.from('push_subscriptions').insert({
                    user_id: userId,
                    subscription: sub,
                    user_agent: navigator.userAgent
                });
            }
        } catch (err) {
            console.error("Sync error:", err);
        }
    };

    const repairNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Starting notification repair...");
            
            // 1. Unsubscribe from push if exists
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.getSubscription();
            if (sub) {
                await sub.unsubscribe();
                console.log("Unsubscribed from push.");
            }

            // 2. Unregister ALL service workers to be sure
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.unregister();
                console.log("Unregistered service worker:", reg.scope);
            }

            // 3. Clear from DB (optional but keeps things clean)
            if (user) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', user.id);
                console.log("Cleared subscriptions from DB.");
            }

            // 4. Force reload or wait for re-registration
            // We'll try to re-subscribe immediately after a short delay
            setTimeout(async () => {
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            console.error("Repair failed:", err);
            setError("Ripristino fallito: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const subscribe = useCallback(async () => {
        console.log("Starting subscribe process...");

        // iOS guard: must be installed as standalone PWA
        if (iosDevice && !standalone) {
            setError('Su iPhone le notifiche funzionano solo se installi l\'app sulla Home Screen. Vai su Safari → Condividi → "Aggiungi a Home Screen".')
            return
        }

        if (!VAPID_PUBLIC_KEY) {
            console.error("VAPID Public Key not found in env");
            setError("Chiave VAPID mancante nel sistema.");
            return
        }
        console.log("VAPID Key present (starts with):", VAPID_PUBLIC_KEY.substring(0, 5));

        setLoading(true)
        setError(null)

        try {
            console.log("Waiting for Service Worker ready...");
            const registration = await navigator.serviceWorker.ready
            console.log("Service Worker ready:", registration);

            // Ensure we have permission
            if (Notification.permission === 'default') {
                console.log("Requesting permission...");
                const result = await Notification.requestPermission()
                console.log("Permission result:", result);
                setPermission(result)
                if (result !== 'granted') {
                    throw new Error('Permesso notifiche negato dall\'utente.')
                }
            } else if (Notification.permission !== 'granted') {
                console.log("Permission already denied/non-granted:", Notification.permission);
                throw new Error('Permesso notifiche bloccato. Abilitalo nelle impostazioni del dispositivo.')
            }

            console.log("Subscribing to PushManager...");
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            })
            console.log("Subscription successful:", sub);

            setSubscription(sub)

            // Save to Supabase
            console.log("Saving to Supabase...");
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: existing } = await supabase
                    .from('push_subscriptions')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('subscription->>endpoint', sub.endpoint)
                    .maybeSingle();

                if (existing) {
                    console.log("Subscription already exists in DB, skipping insert.");
                } else {
                    const { error: insertError } = await supabase.from('push_subscriptions').insert({
                        user_id: user.id,
                        subscription: sub,
                        user_agent: navigator.userAgent
                    })

                    if (insertError) {
                        if (insertError.code === '23505') {
                            console.log("Subscription already exists (caught unique constraint)");
                        } else {
                            console.error("Error saving subscription to DB:", insertError)
                        }
                    } else {
                        console.log("Saved to Supabase successfully.");
                    }
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                const { error: alertError } = await supabase
                    .from('alert_settings')
                    .upsert({
                        user_id: user.id,
                        is_enabled: true,
                        role: profile?.role || 'client'
                    }, { onConflict: 'user_id' });

                if (alertError) {
                    console.error("Error upserting alert_settings:", alertError);
                } else {
                    console.log("Alert settings set to enabled (device connected).");
                }
            }

        } catch (err: any) {
            console.error('Failed to subscribe:', err)
            setError(err.message || 'Errore sconosciuto durante l\'iscrizione')
        } finally {
            setLoading(false)
        }
    }, [iosDevice, standalone])

    const unsubscribe = useCallback(async () => {
        setLoading(true)
        try {
            if (subscription) {
                const endpoint = subscription.endpoint;
                await subscription.unsubscribe();
                setSubscription(null);

                const { error } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', user?.id)
                    .contains('subscription', { endpoint: endpoint });

                if (error) {
                    console.error("Error removing subscription from DB:", error);
                } else {
                    console.log("Subscription removed from DB");
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [subscription, user?.id])

    const sendTestNotification = useCallback(async () => {
        if (!subscription || !user) return;
        setLoading(true);
        try {
            const { error } = await supabase.functions.invoke('push-dispatcher', {
                body: {
                    type: 'direct',
                    user_id: user.id,
                    title: 'Test Notifica \ud83d\udd14',
                    body: 'Se leggi questo, le notifiche funzionano!',
                    url: '/profile'
                }
            });
            if (error) throw error;
            console.log("Test notification sent");
        } catch (err: any) {
            console.error('Error sending test notification:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [subscription, user]);

    return {
        permission,
        subscription,
        subscribe,
        unsubscribe,
        repairNotifications,
        sendTestNotification,
        loading,
        error,
        isIOS: iosDevice,
        isStandalone: standalone,
    };
}
