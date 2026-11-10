import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Settings,
    Users,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import '../../styles/admin-pages.css';

const AdminLayout = () => {
    // State
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => window.innerWidth > 1024);
    const navigate = useNavigate();
    const { user, logout, hasPermission } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const isSuperAdminOrAdmin = user?.role === 'super_admin' || user?.role === 'admin';
    // --- Navigation Configuration ---
    const allNavItems = [
        {
            id: 'dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            path: '/dashboard',
            module: 'ticket_dashboard'
        },
        {
            id: 'task-management',
            icon: ClipboardList,
            label: 'Complaints',
            path: '/task-management',
            module: 'ticket_management'
        },
        {
            id: 'configuration',
            icon: Settings,
            label: 'Configuration',
            path: '/configuration',
            module: 'category_management'
        },
        {
            id: 'user-management',
            icon: Users,
            label: 'User Management',
            path: '/user-management',
            module: 'employee_management'
        }
    ];

    // Filter navigation items by user access scope
    const navItems = allNavItems.filter((item) => {
        if (item.adminOnly) {
            return isSuperAdminOrAdmin;
        }

        if (isSuperAdminOrAdmin) {
            return true;
        }

        return hasPermission(item.module, 'read');
    });

    // --- Inline Styles & Media Queries (Matching StudentLayout) ---
    const styles = {
        container: {
            display: 'flex',
            height: '100vh',
            backgroundColor: '#F8FAFC',
            overflow: 'hidden',
        },
        sidebar: {
            width: '270px',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #e2e8f0',
            height: '100%',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 40,
            transition: 'transform 0.25s ease',
            transform: desktopSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            display: 'flex',
            flexDirection: 'column',
        },
        logoArea: {
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid #f1f5f9',
        },
        logoBox: {
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb',
            fontWeight: 'bold',
            fontSize: '16px',
        },
        logoText: {
            fontSize: '14px',
            fontWeight: '700',
            color: '#0f172a',
            marginLeft: '12px',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            letterSpacing: '-0.02em',
        },
        nav: {
            padding: '20px 12px',
            overflowY: 'auto',
            flex: 1,
        },
        navItem: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '11px 12px',
            marginBottom: '3px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: isActive ? '600' : '500',
            color: isActive ? '#1d4ed8' : '#1f2937',
            backgroundColor: isActive ? '#eff6ff' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
            position: 'relative',
        }),
        mainContent: {
            flex: 1,
            height: '100vh',
            overflowY: 'auto',
            padding: '28px 36px',
            paddingLeft: desktopSidebarOpen ? '36px' : '76px',
            paddingBottom: '100px',
            marginLeft: desktopSidebarOpen ? '270px' : '0',
            transition: 'margin-left 0.25s ease',
            width: desktopSidebarOpen ? 'calc(100% - 270px)' : '100%',
            maxWidth: desktopSidebarOpen ? 'calc(100% - 270px)' : '100%',
            boxSizing: 'border-box',
            minWidth: 0,
        },
        toggleButton: {
            position: 'fixed', top: '16px', left: '16px', zIndex: 50,
            padding: '9px', borderRadius: '10px', backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0', cursor: 'pointer', color: '#000000',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)'
        },
        profileCard: {
            margin: '0 14px 10px 14px',
            padding: '11px 12px',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
        },
        logoutButton: {
            width: '100%', padding: '9px 12px', borderRadius: '10px',
            backgroundColor: '#ffffff', color: '#1f2937',
            border: '1px solid #e2e8f0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize: '12px', fontWeight: '600',
            transition: 'all 0.15s ease'
        },
        mobileHeader: {
            display: 'none',
            height: '64px',
            background: '#ffffff',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 45,
            color: '#0f172a',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        },
        mobileBottomBar: {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: 50,
            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            justifyContent: 'space-around',
            paddingTop: '8px',
            height: 'auto',
            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
        },
        mobileNavItem: (isActive) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px',
            textDecoration: 'none',
            color: isActive ? '#2563EB' : '#9CA3AF',
            fontSize: '10px',
            fontWeight: '600',
        }),
        backdrop: {
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 48,
            backdropFilter: 'blur(2px)',
        }
    };

    return (
        <div style={styles.container}>
            {/* Inject CSS for Media Queries */}
            <style>{`
                @media (max-width: 1024px) {
                    .desktop-sidebar { width: 270px; z-index: 60 !important; }
                    .main-content {
                        margin-left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 16px !important;
                        padding-top: 80px !important;
                        padding-bottom: 96px !important;
                    }
                    .mobile-header { display: flex !important; }
                    .mobile-bottom-bar { display: flex !important; }
                }
                @media (min-width: 1025px) {
                    .desktop-sidebar { display: flex !important; }
                    .mobile-header { display: none !important; }
                    .mobile-bottom-bar { display: none !important; }
                }
            `}</style>

            {!desktopSidebarOpen && (
                <button
                    type="button"
                    className="hidden lg:flex"
                    style={{ ...styles.toggleButton, left: '16px', top: '16px' }}
                    onClick={() => setDesktopSidebarOpen(true)}
                    aria-label="Open sidebar"
                    title="Open sidebar"
                >
                    <PanelLeftOpen size={20} />
                </button>
            )}

            {/* Mobile Sidebar Backdrop */}
            {desktopSidebarOpen && (
                <div
                    className="lg:hidden"
                    style={styles.backdrop}
                    onClick={() => setDesktopSidebarOpen(false)}
                />
            )}

            {/* Mobile Header */}
            <header style={styles.mobileHeader} className="mobile-header">
                <button
                    type="button"
                    onClick={() => setDesktopSidebarOpen(true)}
                    aria-label="Open admin navigation"
                    className="p-2 -ml-2 text-slate-600  rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <span className="font-bold text-blue-700">A</span>
                    </div>
                    <span className="font-semibold text-base tracking-tight text-slate-900">Admin Portal</span>
                </div>

                <div
                    className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100"
                >
                    <span className="text-sm font-bold text-blue-700">{user?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
            </header>

            {/* Sidebar */}
            <aside style={styles.sidebar} className="desktop-sidebar">
                <div style={styles.logoArea}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={styles.logoBox}>T</div>
                        <span style={styles.logoText}>Support Admin</span>
                    </div>
                    {/* Hide sidebar button (Desktop only) */}
                    <button
                        type="button"
                        onClick={() => setDesktopSidebarOpen(false)}
                        aria-label="Close admin navigation"
                        className="rounded-lg p-2 text-slate-400 transition-colors  "
                    >
                        <PanelLeftClose size={20} />
                    </button>
                </div>

                <nav style={styles.nav} className="custom-scrollbar">
                    {navItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={index}
                                to={item.path}
                                style={({ isActive }) => styles.navItem(isActive)}
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={20} />
                                        <span>{item.label}</span>
                                        {isActive && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User Info */}
                <div style={styles.profileCard}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', fontSize: '14px', fontWeight: 'bold' }}>
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                            {user?.name || user?.username || 'Admin'}
                        </p>
                        <p style={{ fontSize: '11px', color: '#000000', margin: 0 }}>
                            {user?.role}
                        </p>
                    </div>
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <button onClick={handleLogout} style={styles.logoutButton}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={styles.mainContent} className="main-content">
                <Outlet />
            </main>

            {/* Mobile Bottom Bar */}
            <div style={styles.mobileBottomBar} className="mobile-bottom-bar">
                {navItems.slice(0, 4).map((item, index) => (
                    <NavLink
                        key={index}
                        to={item.path}
                        style={({ isActive }) => styles.mobileNavItem(isActive)}
                    >
                        <item.icon size={24} />
                        <span>{item.label === 'Complaints' ? 'Complaints' : item.label === 'Configuration' ? 'Settings' : item.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default AdminLayout;
