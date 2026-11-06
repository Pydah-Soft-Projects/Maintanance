require('dotenv').config();
const { masterPool } = require('../config/database');

async function removeAssignments() {
    try {
        const complaintNumber = process.env.COMPLAINT_NUMBER;
        if (!complaintNumber) throw new Error('Set COMPLAINT_NUMBER before running this script.');
        console.log(`Connecting to database to remove assignments for ${complaintNumber}...`);
        
        const [complaints] = await masterPool.query(
            'SELECT id FROM complaints WHERE complaint_number = ?',
            [complaintNumber]
        );
        
        if (complaints.length === 0) {
            console.log(`Complaint ${complaintNumber} not found.`);
            return;
        }
        
        await masterPool.query(
            "UPDATE complaints SET assignments = JSON_ARRAY(), updated_at = NOW() WHERE id = ?",
            [complaints[0].id]
        );
        
        console.log('Successfully removed complaint assignments.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await masterPool.end();
    }
}

removeAssignments();
