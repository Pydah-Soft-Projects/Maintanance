import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
    LayoutGrid,
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
    const location = useLocation();
    const { user, logout, hasPermission } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const isSuperAdminOrAdmin = user?.role === 'super_admin';

    // --- System Navigation Items Configuration ---
    // Preserves our actual system pages:
    // MAIN: Dashboard — LayoutGrid
    // OPERATIONS: Task Management — ClipboardList
    // ADMINISTRATION: Configuration — Settings; User Management — Users
    const allNavItems = [
        {
            id: 'dashboard',
            group: 'MAIN',
            icon: LayoutGrid,
            label: 'Dashboard',
            path: '/dashboard',
            module: 'ticket_dashboard',
            aliases: ['/dashboard', '/']
        },
        {
            id: 'task-management',
            group: 'OPERATIONS',
            icon: ClipboardList,
            label: 'Task Management',
            path: '/task-management',
            module: 'ticket_management',
            aliases: ['/task-management', '/tickets']
        },
        {
            id: 'configuration',
            group: 'ADMINISTRATION',
            icon: Settings,
            label: 'Configuration',
            path: '/configuration',
            module: 'category_management',
            aliases: ['/configuration', '/settings']
        },
        {
            id: 'user-management',
            group: 'ADMINISTRATION',
            icon: Users,
            label: 'User Management',
            path: '/user-management',
            module: 'employee_management',
            aliases: ['/user-management', '/employees', '/roles', '/sub-admins']
        }
    ];

    // Filter navigation items by role and user access permissions
    const navItems = allNavItems.filter((item) => {
        if (item.adminOnly) {
            return isSuperAdminOrAdmin;
        }

        if (isSuperAdminOrAdmin) {
            return true;
        }

        return hasPermission(item.module, 'read');
    });

    // Determine active item considering aliases
    const isItemActive = (item) => {
        const currentPath = location.pathname;

        if (item.id === 'dashboard') {
            return currentPath === '/dashboard' || currentPath === '/';
        }
        if (item.id === 'task-management') {
            return currentPath === '/task-management' || currentPath === '/tickets';
        }
        if (item.id === 'configuration') {
            return currentPath === '/configuration' || currentPath === '/settings';
        }
        if (item.id === 'user-management') {
            return ['/user-management', '/employees', '/roles', '/sub-admins'].includes(currentPath);
        }

        if (item.aliases && item.aliases.includes(currentPath)) {
            return true;
        }

        return currentPath === item.path;
    };

    const SECTIONS = ['MAIN', 'OPERATIONS', 'ADMINISTRATION'];

    // --- Layout and Component Styles ---
    const styles = {
        container: {
            display: 'flex',
            height: '100vh',
            backgroundColor: 'var(--background)',
            overflow: 'hidden',
        },
        sidebar: {
            width: sidebarCollapsed ? '80px' : '256px',
            backgroundColor: 'var(--sidebar, #1E3150)',
            color: 'var(--sidebar-text, #FFFFFF)',
            borderRight: '1px solid var(--border, #E2E8F0)',
            boxShadow: '4px 0 24px -2px rgba(10, 20, 35, 0.45)',
            height: '100%',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 40,
            transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            boxSizing: 'border-box',
        },
        brandHeader: {
            padding: sidebarCollapsed ? '24px 8px 16px' : '24px 24px 16px',
            borderBottom: '1px solid var(--border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '88px',
            boxSizing: 'border-box',
            position: 'relative',
        },
        subtitle: {
            marginTop: '8px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--sidebar-muted, #AABBD4)',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            lineHeight: 1.2,
            letterSpacing: 'normal',
        },
        nav: {
            padding: '12px 14px 16px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            boxSizing: 'border-box',
        },
        sectionContainer: {
            marginBottom: '24px',
        },
        sectionHeading: {
            padding: '4px 14px 8px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--sidebar-muted, #AABBD4)',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            marginBottom: '4px',
        },
        sectionItems: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
        },
        navItem: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: '14px',
            width: '100%',
            padding: sidebarCollapsed ? '10px 0' : '10px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: isActive ? 600 : 500,
            color: 'var(--sidebar-text, #FFFFFF)',
            backgroundColor: isActive ? 'var(--primary, #1A2517)' : 'transparent',
            boxShadow: isActive ? '0 2px 8px -1px rgba(0, 0, 0, 0.2)' : 'none',
            textDecoration: 'none',
            boxSizing: 'border-box',
            transition: 'background-color 150ms ease, opacity 150ms ease',
            cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }),
        profileWrapper: {
            padding: '14px',
            boxSizing: 'border-box',
            width: '100%',
        },
        profileCard: {
            height: sidebarCollapsed ? 'auto' : '64px',
            padding: sidebarCollapsed ? '10px 0' : '0 14px',
            borderRadius: '16px',
            background: 'color-mix(in srgb, var(--sidebar, #1E3150) 72%, var(--text-primary, #000000))',
            border: '1px solid color-mix(in srgb, var(--sidebar-text, #FFFFFF) 18%, transparent)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            boxSizing: 'border-box',
            width: '100%',
        },
        avatar: {
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light, rgba(26, 37, 23, 0.15))',
            color: 'var(--primary, #1A2517)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            flexShrink: 0,
        },
        userDetails: {
            flex: 1,
            minWidth: 0,
            marginLeft: '12px',
            overflow: 'hidden',
        },
        userName: {
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--sidebar-text, #FFFFFF)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
            lineHeight: 1.3,
        },
        userRole: {
            fontSize: '11px',
            fontWeight: 400,
            color: 'var(--sidebar-muted, #AABBD4)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
            lineHeight: 1.3,
        },
        logoutBtn: {
            display: 'flex',
            width: '32px',
            height: '32px',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 0,
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--sidebar-text, #FFFFFF)',
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: '8px',
            transition: 'opacity 150ms ease',
        },
        mainContent: {
            flex: 1,
            height: '100vh',
            overflowY: 'auto',
            padding: '28px 36px',
            paddingLeft: '36px',
            paddingBottom: '100px',
            marginLeft: sidebarCollapsed ? '80px' : '256px',
            transition: 'margin-left 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            width: sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
            maxWidth: sidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
            boxSizing: 'border-box',
            minWidth: 0,
        },
        mobileHeader: {
            display: 'none',
            height: '64px',
            background: 'var(--navbar, #FFFFFF)',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
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
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 48,
            backdropFilter: 'blur(2px)',
        }
    };

    return (
        <div style={styles.container}>
            {/* Inject CSS for Media Queries, Collapse Control & Hover Behavior */}
            <style>{`
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
                    border: 1px solid var(--border, #E2E8F0);
                    border-radius: 9999px;
                    background: var(--surface, #FFFFFF);
                    color: var(--sidebar-muted, #AABBD4);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
                    cursor: pointer;
                    transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
                }
                .sidebar-collapse-toggle:hover {
                    color: var(--sidebar-text, #FFFFFF);
                    background-color: var(--primary, #1A2517);
                }
                .sidebar-nav-link:not(.active-nav-link):hover {
                    background-color: rgba(255, 255, 255, 0.08) !important;
                    opacity: 0.88;
                }
                .sidebar-logout-btn:hover {
                    opacity: 0.8;
                }
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
                {/* Collapse Control Button */}
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

                {/* Brand Header */}
                <div style={styles.brandHeader}>
                    {sidebarCollapsed ? (
                        <img
                            src="/campo-logos/icon-192.png"
                            alt="Campo Logo"
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                objectFit: 'contain',
                                display: 'block'
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                                src="/campo-logos/campo_logo_transparent_hq.png"
                                alt="Campo"
                                style={{
                                    height: '28px',
                                    maxWidth: '120px',
                                    objectFit: 'contain',
                                    display: 'block'
                                }}
                            />
                            <span style={styles.subtitle}>Support &amp; Maintenance</span>
                        </div>
                    )}
                </div>

                {/* Navigation Sections */}
                <nav style={styles.nav} className="custom-scrollbar">
                    {SECTIONS.map((section) => {
                        const sectionItems = navItems.filter((item) => item.group === section);
                        // Do not show sections that have no permitted items
                        if (!sectionItems.length) return null;

                        return (
                            <div key={section} style={styles.sectionContainer}>
                                {!sidebarCollapsed && (
                                    <div style={styles.sectionHeading}>{section}</div>
                                )}
                                <div style={styles.sectionItems}>
                                    {sectionItems.map((item) => {
                                        const Icon = item.icon;
                                        const active = isItemActive(item);

                                        return (
                                            <NavLink
                                                key={item.id}
                                                to={item.path}
                                                title={sidebarCollapsed ? item.label : undefined}
                                                style={styles.navItem(active)}
                                                className={`sidebar-nav-link ${active ? 'active-nav-link' : ''}`}
                                            >
                                                <Icon size={sidebarCollapsed ? 20 : 18} strokeWidth={2} />
                                                {!sidebarCollapsed && <span>{item.label}</span>}
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom User Profile */}
                <div style={styles.profileWrapper}>
                    <div
                        style={styles.profileCard}
                        title={sidebarCollapsed ? `${user?.name || user?.username || 'Admin'} (${user?.role === 'super_admin' ? 'Superadmin' : user?.role ? user.role.replace(/_/g, ' ') : 'User'})` : undefined}
                    >
                        <div style={styles.avatar}>
                            {(user?.name || user?.username || 'A').charAt(0).toUpperCase()}
                        </div>
                        {!sidebarCollapsed && (
                            <>
                                <div style={styles.userDetails}>
                                    <p style={styles.userName}>
                                        {user?.name || user?.username || 'Admin'}
                                    </p>
                                    <p style={styles.userRole}>
                                        {user?.role === 'super_admin' ? 'Superadmin' : user?.role ? user.role.replace(/_/g, ' ') : 'User'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    aria-label="Sign out"
                                    title="Sign Out"
                                    style={styles.logoutBtn}
                                    className="sidebar-logout-btn"
                                >
                                    <LogOut size={16} strokeWidth={2} />
                                </button>
                            </>
                        )}
                    </div>
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
                        <item.icon size={24} strokeWidth={2} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default AdminLayout;
