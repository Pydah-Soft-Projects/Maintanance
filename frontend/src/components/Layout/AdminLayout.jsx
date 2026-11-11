import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Settings,
    Users,
    LogOut,
    Menu,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import '../../styles/admin-pages.css';

const AdminLayout = () => {
    // State
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => window.innerWidth > 1024);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const { user, logout, hasPermission } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const isSuperAdminOrAdmin = user?.role === 'super_admin';
    // --- Navigation Configuration ---
    const allNavItems = [
        {
            id: 'dashboard',
            group: 'MAIN',
            icon: LayoutDashboard,
            label: 'Dashboard',
            path: '/dashboard',
            module: 'ticket_dashboard'
        },
        {
            id: 'task-management',
            group: 'OPERATIONS',
            icon: ClipboardList,
            label: 'Complaints',
            path: '/task-management',
            module: 'ticket_management'
        },
        {
            id: 'configuration',
            group: 'ADMINISTRATION',
            icon: Settings,
            label: 'Configuration',
            path: '/configuration',
            module: 'category_management'
        },
        {
            id: 'user-management',
            group: 'ADMINISTRATION',
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
            backgroundColor: 'var(--background)',
            overflow: 'hidden',
        },
        sidebar: {
            width: sidebarCollapsed ? '80px' : '256px',
            backgroundColor: 'var(--sidebar)',
            color: 'var(--sidebar-text)',
            borderRight: '1px solid var(--border)',
            height: '100%',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 40,
            transition: 'width 0.25s ease, transform 0.25s ease',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        },
        logoArea: {
            minHeight: sidebarCollapsed ? '90px' : '106px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: sidebarCollapsed ? '18px 8px 12px' : '24px 12px 16px',
            borderBottom: '1px solid var(--border)',
            textAlign: 'center',
        },
        logoText: {
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--sidebar-muted)',
            marginTop: '8px',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            letterSpacing: '0.01em',
        },
        nav: {
            padding: '16px 14px',
            overflowY: 'auto',
            flex: 1,
        },
        navItem: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            padding: sidebarCollapsed ? '11px 0' : '11px 14px',
            marginBottom: '4px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: isActive ? '600' : '500',
            color: 'var(--sidebar-text)',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
            position: 'relative',
        }),
        mainContent: {
            flex: 1,
            height: '100vh',
            overflowY: 'auto',
            padding: '28px 36px',
            paddingLeft: '36px',
            paddingBottom: '100px',
            marginLeft: sidebarCollapsed ? '80px' : '256px',
            transition: 'margin-left 0.25s ease, width 0.25s ease',
            width: sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
            maxWidth: sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
            boxSizing: 'border-box',
            minWidth: 0,
        },
        profileCard: {
            margin: sidebarCollapsed ? '0 8px 12px' : '0 14px 12px',
            padding: sidebarCollapsed ? '6px 4px' : '10px',
            borderRadius: '16px',
            background: 'color-mix(in srgb, var(--sidebar) 72%, var(--text-primary))',
            border: '1px solid color-mix(in srgb, var(--sidebar-text) 18%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: sidebarCollapsed ? '4px' : '8px',
        },
        mobileHeader: {
            display: 'none',
            height: '64px',
            background: 'var(--navbar)',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 45,
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        },
        mobileBottomBar: {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'color-mix(in srgb, var(--surface, #FFFFFF) 98%, transparent)',
            borderTop: '1px solid var(--border, #E5E7EB)',
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
            color: isActive ? 'var(--primary, #1A2517)' : 'var(--text-muted, #777777)',
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
                    .desktop-sidebar {
                        width: 256px !important;
                        z-index: 60 !important;
                        transform: translateX(-100%);
                    }
                    .desktop-sidebar.mobile-open { transform: translateX(0); }
                    .sidebar-collapse-toggle { display: none !important; }
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
                    .desktop-sidebar { display: flex !important; transform: translateX(0) !important; }
                    .sidebar-collapse-toggle {
                        position: absolute;
                        right: -12px;
                        top: 106px;
                        z-index: 50;
                        display: flex;
                        width: 24px;
                        height: 24px;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        border: 1px solid var(--border);
                        border-radius: 9999px;
                        background: var(--surface);
                        color: var(--sidebar-muted);
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
                        cursor: pointer;
                    }
                    .mobile-header { display: none !important; }
                    .mobile-bottom-bar { display: none !important; }
                }
            `}</style>

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
                    onClick={() => setDesktopSidebarOpen((open) => !open)}
                    aria-label={desktopSidebarOpen ? 'Close admin navigation' : 'Open admin navigation'}
                    className="p-2 -ml-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <Menu size={24} />
                </button>

                <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>Campo</span>
                </div>
                <span className="w-9" />
            </header>

            {/* Sidebar */}
            <aside
                style={styles.sidebar}
                className={`desktop-sidebar ${desktopSidebarOpen ? 'mobile-open' : ''}`}
            >
                <div style={styles.logoArea}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                            src={sidebarCollapsed ? '/campo-logos/icon-192.png' : '/campo-logos/campo_logo_transparent_hq.png'}
                            alt="Campo"
                            style={{
                                height: sidebarCollapsed ? '32px' : '28px',
                                maxWidth: sidebarCollapsed ? '40px' : '120px',
                                objectFit: 'contain',
                                flexShrink: 0,
                            }}
                        />
                        {!sidebarCollapsed && <span style={styles.logoText}>Support &amp; Maintenance</span>}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (window.innerWidth <= 1024) {
                                setDesktopSidebarOpen(false);
                            } else {
                                setSidebarCollapsed((collapsed) => !collapsed);
                            }
                        }}
                        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="sidebar-collapse-toggle"
                    >
                        {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
                    </button>
                </div>

                <nav style={styles.nav} className="custom-scrollbar">
                    {['MAIN', 'OPERATIONS', 'ADMINISTRATION'].map((group) => {
                        const groupItems = navItems.filter((item) => item.group === group);
                        if (!groupItems.length) return null;
                        return (
                            <div key={group} style={{ marginBottom: '18px' }}>
                                {!sidebarCollapsed && (
                                    <div style={{ padding: '0 10px 8px', color: 'var(--sidebar-muted)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>
                                        {group}
                                    </div>
                                )}
                                {groupItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.id}
                                            to={item.path}
                                            title={sidebarCollapsed ? item.label : undefined}
                                            style={({ isActive }) => styles.navItem(isActive)}
                                        >
                                            <Icon size={18} />
                                            {!sidebarCollapsed && <span>{item.label}</span>}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                {/* User Info */}
                <div style={styles.profileCard}>
                    <div style={{ width: sidebarCollapsed ? '28px' : '36px', height: sidebarCollapsed ? '28px' : '36px', flexShrink: 0, borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '14px', fontWeight: 'bold' }}>
                        {(user?.name || user?.username || 'A').charAt(0).toUpperCase()}
                    </div>
                    {!sidebarCollapsed && <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--sidebar-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', margin: 0 }}>
                            {user?.name || user?.username || 'Admin'}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--sidebar-muted)', margin: 0 }}>
                            {user?.role === 'super_admin' ? 'Superadmin' : user?.role?.replace(/_/g, ' ')}
                        </p>
                    </div>}
                    <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="Sign out"
                        title="Sign Out"
                        style={{
                            display: 'flex',
                            width: sidebarCollapsed ? '20px' : '30px',
                            height: sidebarCollapsed ? '28px' : '30px',
                            flexShrink: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            border: 0,
                            borderRadius: '8px',
                            background: 'transparent',
                            color: 'var(--sidebar-text)',
                            cursor: 'pointer'
                        }}
                    >
                        <LogOut size={16} />
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
