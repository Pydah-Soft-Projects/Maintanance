async function getEligibleApprovers(connection, memberTypes) {
    const conditions = [];
    if (memberTypes.includes('manager')) {
        conditions.push("u.role = 'manager'");
    }
    if (memberTypes.includes('sub_admin')) {
        conditions.push("u.role = 'sub_admin'");
    }
    if (memberTypes.includes('super_admin')) {
        conditions.push("u.role = 'super_admin'");
    }
    if (memberTypes.includes('worker')) {
        conditions.push(`(
            u.role = 'worker' AND EXISTS (
                SELECT 1
                FROM approval_service_group_members gm
                JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
                WHERE gm.user_id = u.id AND g.member_type = 'worker'
            )
        )`);
    }
    if (!conditions.length) return [];

    const [users] = await connection.query(
        `SELECT DISTINCT u.role AS member_type, u.id
         FROM users u
        WHERE u.is_active = 1 AND u.is_ticket_employee = 1
           AND (${conditions.join(' OR ')})
         ORDER BY u.id`
    );
    return users.map((user) => ({ member_type: user.member_type, id: Number(user.id) }));
}

async function getEligibleApproverCounts(connection, memberTypes) {
    const members = await getEligibleApprovers(connection, memberTypes);
    return members.reduce((counts, member) => {
        counts[member.member_type] = (counts[member.member_type] || 0) + 1;
        return counts;
    }, {});
}

module.exports = { getEligibleApprovers, getEligibleApproverCounts };
