import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import CoachBoard from './CoachBoard';
import { Users, Clock, AlertTriangle } from 'lucide-react';
import { addDays, isAfter, isBefore } from 'date-fns';

export default function CoachDashboard() {
    const { profile } = useAuth();
    const { clients, loading: clientsLoading } = useClients();

    // Calculate Statistics
    const activeClientsCount = clients.filter(c =>
        c.subscription_end && isAfter(new Date(c.subscription_end), new Date())
    ).length;

    const expiringClientsCount = clients.filter(c => {
        if (!c.subscription_end) return false;
        const endDate = new Date(c.subscription_end);
        const now = new Date();
        const nextWeek = addDays(now, 7);
        return isAfter(endDate, now) && isBefore(endDate, nextWeek);
    }).length;

    return (
        <div className="space-y-12 pb-20">
            <div className="relative">
                <div className="flex flex-col gap-2">
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-foreground">
                        Bentornato, <span className="text-primary">{profile?.full_name?.split(' ')[0]}</span>
                    </h1>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] opacity-80">Coach Dashboard</p>
                </div>

                <div className="mt-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.3em]">Live Updates & Feed</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
            </div>

            {/* Statistics Section */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-8">
                {/* Active Clients Box */}
                <div className="glass-card p-6 rounded-[2rem] border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="h-24 w-24 -mr-4 -mt-4 transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                <Users className="h-5 w-5" />
                            </div>
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest">Clienti Attivi</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl md:text-5xl font-black text-foreground italic tracking-tighter">
                                {clientsLoading ? '-' : activeClientsCount}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Su {clients.length}</span>
                        </div>
                    </div>
                </div>

                {/* Expiring Subscriptions Box */}
                <div className="glass-card p-6 rounded-[2rem] border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="h-24 w-24 -mr-4 -mt-4 transform -rotate-12 text-orange-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">In Scadenza (7gg)</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl md:text-5xl font-black text-foreground italic tracking-tighter">
                                {clientsLoading ? '-' : expiringClientsCount}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Intervenire</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <CoachBoard />
            </div>
        </div>
    );
}
