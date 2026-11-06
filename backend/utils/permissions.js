const parsePermissions = (permissions) => {
    if (!permissions) return {};
    const parsed = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

const normalizeTicketPermissions = (permissions) => {
    const normalized = { ...parsePermissions(permissions) };
    const tabPermissions = {
        ticket_management: ['pending', 'assigned', 'resolved', 'student', 'faculty'],
        employee_management: ['users', 'roles']
    };

    for (const [module, tabs] of Object.entries(tabPermissions)) {
        const existing = normalized[module];
        const modulePermissions = existing && typeof existing === 'object' && !Array.isArray(existing)
            ? { ...existing }
            : {};
        for (const tab of tabs) {
            if (modulePermissions[tab] === undefined) {
                modulePermissions[tab] = tab === 'roles'
                    ? false
                    : modulePermissions.read === true;
            }
        }
        normalized[module] = modulePermissions;
    }

    return normalized;
};

const mergePermissions = (rolePermissions, userPermissions) => {
    const effectivePermissions = { ...parsePermissions(rolePermissions) };

    for (const [module, override] of Object.entries(parsePermissions(userPermissions))) {
        const roleModule = effectivePermissions[module];
        if (
            override && typeof override === 'object' && !Array.isArray(override) &&
            roleModule && typeof roleModule === 'object' && !Array.isArray(roleModule)
        ) {
            effectivePermissions[module] = { ...roleModule, ...override };
        } else {
            effectivePermissions[module] = override;
        }
    }

    return normalizeTicketPermissions(effectivePermissions);
};

module.exports = { mergePermissions, normalizeTicketPermissions };
