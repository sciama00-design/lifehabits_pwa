import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    UserCog,
    LogOut,
    Menu,
    X,
    Activity,
    Library
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navigation = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Coaches', href: '/admin/coaches', icon: UserCog },
        { name: 'Clients', href: '/admin/clients', icon: Users },
        { name: 'Content', href: '/admin/content', icon: Library },
        { name: 'System', href: '/admin/system', icon: Activity },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                        <span className="text-xl font-bold text-gray-900">Admin Panel</span>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors
                                    ${isActive
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                <item.icon className={`w-5 h-5 ${location.pathname === item.href ? 'text-primary-600' : 'text-gray-400'
                                    }`} />
                                {item.name}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="lg:pl-64 flex flex-col min-h-screen">
                {/* Mobile Header */}
                <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:hidden">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-semibold text-gray-900">Admin Panel</span>
                    <div className="w-10" /> {/* Spacer for centering */}
                </header>

                <main className="flex-1 p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
