const express = require('express');
const router = express.Router();
const rbacUserController = require('../controllers/rbacUserController');
const authMiddleware = require('../middleware/auth');

// Protect all routes
router.use(authMiddleware);

router.get('/', rbacUserController.getUsers);
router.get('/hrms-directory', rbacUserController.getHrmsDirectory);
router.post('/hrms-link', rbacUserController.linkHrmsUser);
router.post('/', rbacUserController.createUser);
router.put('/:id/access', rbacUserController.updateUserAccess);
router.put('/:id', rbacUserController.updateUser);
router.delete('/:id', rbacUserController.deleteUser);

module.exports = router;
