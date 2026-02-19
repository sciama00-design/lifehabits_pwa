-- Create table for storing Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT push_subscriptions_user_id_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Enable RLS for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" 
ON public.push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own subscriptions" 
ON public.push_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" 
ON public.push_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for Alert Settings (User Preferences)
CREATE TABLE IF NOT EXISTS public.alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT alert_settings_user_id_unique UNIQUE (user_id)
);

-- Enable RLS for alert_settings
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_settings
DROP POLICY IF EXISTS "Users can view their own alert settings" ON public.alert_settings;
CREATE POLICY "Users can view their own alert settings" 
ON public.alert_settings FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Coaches can view their clients alert settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Clients can view their coach alert settings" ON public.alert_settings;

DROP POLICY IF EXISTS "Users can insert/update their own alert settings" ON public.alert_settings;
CREATE POLICY "Users can insert/update their own alert settings" 
ON public.alert_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own alert settings" ON public.alert_settings;
CREATE POLICY "Users can update their own alert settings" 
ON public.alert_settings FOR UPDATE 
USING (auth.uid() = user_id);

-- Create table for Notification Rules (Coach Managed)
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL for Global, Set for Personal
    scheduled_time TIME NOT NULL, -- HH:MM format
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT notification_rules_coach_fk FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT notification_rules_client_fk FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS for notification_rules
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_rules

-- 1. Coaches can manage their own rules
DROP POLICY IF EXISTS "Coaches can all on their own rules" ON public.notification_rules;
CREATE POLICY "Coaches can all on their own rules" 
ON public.notification_rules FOR ALL
USING (auth.uid() = coach_id);

-- 2. Clients can view rules assigned to them
DROP POLICY IF EXISTS "Clients can view their notification rules" ON public.notification_rules;
CREATE POLICY "Clients can view their notification rules" 
ON public.notification_rules FOR SELECT 
USING (
    (client_id = auth.uid()) -- Personal Rules
    OR 
    (client_id IS NULL AND coach_id IN ( -- Global Rules from their coaches
        SELECT coach_id FROM public.client_coaches WHERE client_id = auth.uid()
        UNION
        SELECT coach_id FROM public.clients_info WHERE id = auth.uid() -- fallback for old relationship
    ))
);

-- Grant access to authenticated users
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.alert_settings TO authenticated;
GRANT ALL ON public.notification_rules TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.alert_settings TO service_role;
GRANT ALL ON public.notification_rules TO service_role;
