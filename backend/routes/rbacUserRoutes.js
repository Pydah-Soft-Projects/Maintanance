const express = require('express');
const router = express.Router();
const rbacUserController = require('../controllers/rbacUserController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');
const { MODULES, PERMISSIONS } = require('../constants/rbac');

// Protect all routes
router.use(authMiddleware);

router.get('/', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), rbacUserController.getUsers);
router.get('/hrms-directory', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), rbacUserController.getHrmsDirectory);
router.post('/hrms-link', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), rbacUserController.linkHrmsUser);
router.post('/', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), rbacUserController.createUser);
router.put('/:id/access', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), rbacUserController.updateUserAccess);
router.put('/:id', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), rbacUserController.updateUser);
router.delete('/:id', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), rbacUserController.deleteUser);

module.exports = router;
