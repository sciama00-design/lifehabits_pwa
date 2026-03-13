-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Track Coach Rules
CREATE TABLE IF NOT EXISTS public.notification_sent_log (
    rule_id UUID REFERENCES public.notification_rules(id) ON DELETE CASCADE,
    sent_date DATE DEFAULT CURRENT_DATE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (rule_id, sent_date)
);

-- 2. Track Daily Habit Reminders
CREATE TABLE IF NOT EXISTS public.daily_alert_sent_log (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_time TEXT, -- e.g. "09:00"
    sent_date DATE DEFAULT CURRENT_DATE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, alert_time, sent_date)
);

-- Enable RLS
ALTER TABLE public.notification_sent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_alert_sent_log ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notif_log_date ON public.notification_sent_log(sent_date);
CREATE INDEX IF NOT EXISTS idx_alert_log_date ON public.daily_alert_sent_log(sent_date);
