-- Create daily_feedbacks table
CREATE TABLE public.daily_feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    feeling TEXT NOT NULL,
    exercises_done BOOLEAN NOT NULL,
    activities_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, date)
);

-- Create coach_notifications table
CREATE TABLE public.coach_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.daily_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for daily_feedbacks
CREATE POLICY "Clients can select their own feedbacks"
    ON public.daily_feedbacks FOR SELECT
    USING (auth.uid() = client_id);

CREATE POLICY "Clients can insert their own feedbacks"
    ON public.daily_feedbacks FOR INSERT
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Coaches can read their clients feedbacks"
    ON public.daily_feedbacks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.client_coaches cc
            WHERE cc.coach_id = auth.uid() AND cc.client_id = daily_feedbacks.client_id
        )
    );

-- Policies for coach_notifications
CREATE POLICY "Coaches can select their own notifications"
    ON public.coach_notifications FOR SELECT
    USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their own notifications"
    ON public.coach_notifications FOR UPDATE
    USING (auth.uid() = coach_id)
    WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Clients can insert notifications"
    ON public.coach_notifications FOR INSERT
    WITH CHECK (auth.uid() = client_id);
