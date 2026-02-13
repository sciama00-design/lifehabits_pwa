export type UserRole = 'coach' | 'client';

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    avatar_url: string | null;
    created_at: string;
}

export interface SubscriptionPlan {
    id: string;
    coach_id: string;
    client_id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    coach?: Profile; // Hydrated coach
}



export interface ClientCoach {
    client_id: string;
    coach_id: string;
}

export interface ClientInfo {
    id: string;
    coach_id: string;
    created_at: string;
    profiles?: Profile; // Hydrated
}

export interface ContentItem {
    id: string;
    coach_id: string;
    type: 'pdf' | 'video' | 'habit' | 'post';
    title: string;
    description: string | null;
    link: string | null;
    thumbnail_url: string | null;
    created_at: string;
}

export interface Assignment {
    id: string;
    coach_id: string;
    client_id: string;
    title: string;
    description: string | null;
    link: string | null;
    thumbnail_url: string | null;
    type: 'pdf' | 'video' | 'habit';
    completed: boolean;
    scheduled_date: string;
    plan_id: string | null;
    created_at: string;
}

export interface BoardPost {
    id: string;
    coach_id: string;
    title: string;
    content: string; // Rich Text HTML
    image_url: string | null;
    target_client_ids: string[] | null;
    expires_at: string | null;
    created_at: string;
    coach?: Profile; // Hydrated author
}

