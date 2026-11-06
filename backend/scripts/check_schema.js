require('dotenv').config();
const { masterPool } = require('../config/database');

async function test() {
    for (const table of ['users', 'categories', 'roles', 'complaints']) {
        const [columns] = await masterPool.query(`DESCRIBE \`${table}\``);
        console.log(table, columns);
    }
    await masterPool.end();
}
test();
