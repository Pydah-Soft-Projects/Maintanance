const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');
const { MODULES, PERMISSIONS } = require('../constants/rbac');

// Protect all routes
router.use(authMiddleware);

// Get all employees
router.get('/', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), employeeController.getEmployees);

// Get HRMS directory for searching and creating users (live search, not stored)
router.get('/hrms-directory', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), employeeController.getHrmsEmployees);

// Get available users (not yet assigned as employees)
router.get('/available-users', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), employeeController.getAvailableUsers);

// Create new employee assignment
router.post('/', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), employeeController.createEmployee);

// Update employee role
router.put('/:id', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), employeeController.updateEmployee);

// Get employee history
router.get('/:id/history', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.READ), employeeController.getEmployeeHistory);

// Delete employee (soft delete)
router.delete('/:id', verifyPermission(MODULES.EMPLOYEE_MANAGEMENT, PERMISSIONS.WRITE), employeeController.deleteEmployee);

module.exports = router;
