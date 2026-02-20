
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { urlBase64ToUint8Array } from '@/lib/pushUtils'
import { useAuth } from './useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export function usePushNotifications() {
    const { user } = useAuth()
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
        }
    }

    const subscribe = useCallback(async () => {
        console.log("Starting subscribe process...");
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
                throw new Error('Permesso notifiche bloccato. Abilitalo nel browser.')
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
                // Check if already subscribed with this endpoint
                // We use upsert logic or verify existence first
                // Let's try upsert assuming unique constraint on (user_id, subscription->>'endpoint') is active?
                // Or safer: check existence.
                const { data: existing } = await supabase
                    .from('push_subscriptions')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('subscription->>endpoint', sub.endpoint)
                    .single(); // using single() might error if 0 rows, let's use maybeSingle() or just limit(1)

                if (existing) {
                    console.log("Subscription already exists in DB, skipping insert.");
                } else {
                    const { error: insertError } = await supabase.from('push_subscriptions').insert({
                        user_id: user.id,
                        subscription: sub,
                        user_agent: navigator.userAgent
                    })

                    if (insertError) {
                        // If constraint fails, we can ignore duplicate key error
                        if (insertError.code === '23505') { // Unique violation
                            console.log("Subscription already exists (caught unique constraint)");
                        } else {
                            console.error("Error saving subscription to DB:", insertError)
                        }
                    } else {
                        console.log("Saved to Supabase successfully.");
                    }
                }

                // Also ensure alert_settings is set to enabled (device connected)
                const { error: alertError } = await supabase
                    .from('alert_settings')
                    .upsert({
                        user_id: user.id,
                        is_enabled: true,
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
    }, [])

    const unsubscribe = useCallback(async () => {
        setLoading(true)
        try {
            if (subscription) {
                const endpoint = subscription.endpoint;
                await subscription.unsubscribe();
                setSubscription(null);

                // Remove from DB using string containment for endpoint which is unique enough
                // casting to unknown then string to satisfy TS if needed, or just rely on JSON match
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
                    title: 'Test Notifica 🔔',
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

    return { permission, subscription, subscribe, unsubscribe, sendTestNotification, loading, error };
}
