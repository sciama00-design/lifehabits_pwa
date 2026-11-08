// Scheduled delivery and feedback replay protection. A failed claim must never send.
export async function sendScheduledPush(supabase, sub, payload, deliveryKey, send) {
    const { data: token, error } = await supabase.rpc('claim_push_delivery', { delivery_key: deliveryKey })
    if (error) throw error
    if (!token) {
        const { data: receipt, error: readError } = await supabase.from('push_delivery_receipts')
            .select('delivered').eq('delivery_key', deliveryKey).maybeSingle()
        if (readError) throw readError
        if (!receipt) throw new Error('Missing delivery receipt')
        return { success: false, pending: !receipt.delivered }
    }
    let expired = false
    try {
        await send(sub.subscription, payload)
    } catch (error) {
        expired = error?.statusCode === 404 || error?.statusCode === 410
        if (!expired) {
            const { error: releaseError } = await supabase.from('push_delivery_receipts').delete()
                .eq('delivery_key', deliveryKey).eq('claim_token', token)
            if (releaseError) throw releaseError
            return { success: false, retryable: true }
        }
    }
    // Mark the receipt before cleanup. A cleanup error must not cause re-delivery.
    const { data: receipt, error: receiptError } = await supabase.from('push_delivery_receipts')
        .update({ delivered: true }).eq('delivery_key', deliveryKey).eq('claim_token', token)
        .select('delivery_key').maybeSingle()
    if (receiptError) throw receiptError
    if (!receipt) throw new Error('Delivery claim no longer owned')
    if (expired) {
        const { error: deleteError } = await supabase.from('push_subscriptions').delete()
            .eq('id', sub.id).eq('subscription', JSON.stringify(sub.subscription))
        if (deleteError) throw deleteError
    }
    return { success: !expired }
}
