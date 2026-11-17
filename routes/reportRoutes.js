const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

// Protect all report routes (Staff access)
router.use(ensureAuthenticated);
router.use(ensureRole(['STAFF']));

router.get('/', reportController.getReportsDashboard);
router.get('/circulation', reportController.getIssuedReport);
router.get('/overdue', reportController.getOverdueReport);
router.get('/fines', reportController.getFinesReport);
router.get('/requests', reportController.getRequestsReport);

module.exports = router;
