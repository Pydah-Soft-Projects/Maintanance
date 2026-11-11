const express = require('express');
const router = express.Router();
const approvalWorkflowController = require('../controllers/approvalWorkflowController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');

router.use(authMiddleware);
router.use(verifyPermission('employee_management', 'roles'));

router.get('/', approvalWorkflowController.getConfiguration);
router.post('/groups', approvalWorkflowController.createGroup);
router.put('/groups/:groupId', approvalWorkflowController.updateGroup);
router.post('/groups/:groupId/members', approvalWorkflowController.addGroupMember);
router.delete('/groups/:groupId/members/:userId', approvalWorkflowController.removeGroupMember);
router.delete('/groups/:groupId', approvalWorkflowController.deactivateGroup);
router.put('/workflows', approvalWorkflowController.saveWorkflow);
router.delete('/workflows', approvalWorkflowController.deactivateWorkflow);

module.exports = router;
