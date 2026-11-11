import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    RiHome4Line,
    RiHome4Fill,
    RiTicketLine,
    RiTicketFill,
    RiUser3Fill,
    RiLogoutBoxRLine,
    RiAddCircleLine,
    RiAddCircleFill,
    RiShieldCheckLine,
    RiShieldCheckFill
} from 'react-icons/ri';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import NotificationPrompt from '../NotificationPrompt';
import TopHeaderBar from '../student/TopHeaderBar';

const StudentLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const isSuperAdminOrAdmin = user?.role === 'super_admin';

    // Navigation Configuration: Dashboard, Raise Ticket, and Raised Tickets
    const navItems = [
        ...(isSuperAdminOrAdmin ? [
            { group: 'ADMINISTRATION', icon: RiShieldCheckLine, activeIcon: RiShieldCheckFill, label: 'Admin Portal', path: '/dashboard' }
        ] : []),
        { group: 'MAIN', icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Dashboard', path: '/student/dashboard' },
        { group: 'REQUESTS', icon: RiAddCircleLine, activeIcon: RiAddCircleFill, label: 'Raise Ticket', path: '/student/raise-ticket' },
        { group: 'REQUESTS', icon: RiTicketLine, activeIcon: RiTicketFill, label: 'Raised Tickets', path: '/student/my-tickets' },
    ];

    const handleLogout = () => {
        logout();
        toast.success('Signed out successfully');
        navigate('/login');
    };

    const displayName = user?.name || user?.student_name || user?.username || 'Staff Member';
    const displayRole = user?.role
        ? (user.role === 'super_admin' ? 'Superadmin' : user.role.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()))
        : (user?.admission_number || user?.email || 'STAFF');

    return (
        <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}>

            {/* Sidebar (Desktop & Tablet) */}
            <aside
                className={`fixed top-0 left-0 bottom-0 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'} flex flex-col transition-[width] duration-300 ease-in-out hidden lg:flex`}
                style={{ backgroundColor: 'var(--sidebar)', color: 'var(--sidebar-text)', borderRight: '1px solid var(--border)', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
            >
                <header className="relative flex min-h-[106px] flex-col items-center justify-center border-b px-3 pt-6 pb-4 text-center" style={{ borderColor: 'var(--border)' }}>
                    <button
                        type="button"
                        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="absolute -right-3 top-[106px] z-50 flex h-6 w-6 items-center justify-center rounded-full border shadow-md"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--sidebar-muted)' }}
                    >
                        {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
                    </button>
                    <div className="flex flex-col items-center">
                        <button
                            type="button"
                            className="flex items-center justify-center"
                            onClick={() => navigate('/student/dashboard')}
                            aria-label="Go to dashboard"
                        >
                            <img
                                src={sidebarCollapsed ? '/campo-logos/icon-192.png' : '/campo-logos/campo_logo_transparent_hq.png'}
                                alt="Campo"
                                className={sidebarCollapsed ? 'h-8 w-10 object-contain' : 'h-7 max-w-[120px] object-contain'}
                            />
                        </button>
                        {!sidebarCollapsed && <span className="mt-2 text-[10px] font-semibold" style={{ color: 'var(--sidebar-muted)' }}>Support Portal</span>}
                    </div>
                </header>

                <nav className="flex-1 overflow-y-auto px-3.5 py-4">
                    {['MAIN', 'REQUESTS', 'ADMINISTRATION'].map((group) => {
                        const groupItems = navItems.filter((item) => item.group === group);
                        if (!groupItems.length) return null;
                        return (
                            <div key={group} className="mb-5">
                                {!sidebarCollapsed && <h2 className="mb-2 px-2 text-[10px] font-bold tracking-[0.08em]" style={{ color: 'var(--sidebar-muted)' }}>{group}</h2>}
                                {groupItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        title={sidebarCollapsed ? item.label : undefined}
                                        className="mb-1 flex items-center rounded-xl py-3 text-[13px] font-medium transition-colors"
                                        style={({ isActive }) => ({
                                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                            gap: '12px',
                                            paddingLeft: sidebarCollapsed ? 0 : '14px',
                                            paddingRight: sidebarCollapsed ? 0 : '14px',
                                            color: 'var(--sidebar-text)',
                                            backgroundColor: isActive ? 'var(--primary)' : 'transparent'
                                        })}
                                    >
                                        <item.icon size={18} />
                                        {!sidebarCollapsed && <span>{item.label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className={`mx-2 mb-3 flex items-center rounded-2xl border ${sidebarCollapsed ? 'justify-between gap-1 px-1.5 py-1.5' : 'gap-2.5 px-2.5 py-2.5'}`} style={{ backgroundColor: 'color-mix(in srgb, var(--sidebar) 72%, var(--text-primary))', borderColor: 'color-mix(in srgb, var(--sidebar-text) 18%, transparent)' }}>
                    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${sidebarCollapsed ? 'h-7 w-7' : 'h-9 w-9'}`} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {user?.student_photo ? <img src={user.student_photo} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0).toUpperCase()}
                    </div>
                    {!sidebarCollapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold uppercase" style={{ color: 'var(--sidebar-text)' }} title={displayName}>{displayName}</p>
                            <p className="truncate text-[10px]" style={{ color: 'var(--sidebar-muted)' }}>{displayRole}</p>
                        </div>
                    )}
                    <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign Out" className={`flex shrink-0 items-center justify-center rounded-lg border-0 ${sidebarCollapsed ? 'h-7 w-5' : 'h-[30px] w-[30px]'}`} style={{ backgroundColor: 'transparent', color: 'var(--sidebar-text)' }}>
                        <RiLogoutBoxRLine size={15} />
                    </button>
                </div>
            </aside>

            {/* Main Content Container */}
            <main
                className={`
                    flex-1 h-screen overflow-y-auto px-4 lg:px-8 py-4 lg:py-6 relative transition-all duration-300
                    ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
                    pb-24 lg:pb-8
                `}
            >
                {/* SDMS Top Header Bar */}
                <TopHeaderBar />

                {/* Page Outlet - Full Width Responsive Container */}
                <div className="w-full">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar matching SDMS */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-2 py-2 flex items-center justify-around shadow-lg">
                {navItems.map((item, index) => (
                    <NavLink
                        key={index}
                        to={item.path}
                        className={({ isActive }) => `
                            flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all
                            ${isActive ? 'text-sky-600' : 'text-slate-400 '}
                        `}
                    >
                        <item.icon size={20} />
                        <span className="text-[10px]">
                            {item.label === 'Raised Tickets' ? 'Tickets' : item.label === 'Raise Ticket' ? 'Raise' : 'Dashboard'}
                        </span>
                    </NavLink>
                ))}
            </div>

            <NotificationPrompt />
        </div>
    );
};

export default StudentLayout;
