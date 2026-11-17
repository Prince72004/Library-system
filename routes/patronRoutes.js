const express = require('express');
const router = express.Router();
const patronController = require('../controllers/patronController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

// Protect all patron routes
router.use(ensureAuthenticated);
router.use(ensureRole(['PATRON']));

// Dashboard
router.get('/dashboard', patronController.getDashboard);

// Borrowed books & loan history
router.get('/my-books', patronController.getMyBooks);

// Service requests submission (FR-004)
router.get('/request-submit', patronController.getRequestForm);
router.post('/request-submit', patronController.postSubmitRequest);

// Service requests tracking (FR-006)
router.get('/my-requests', patronController.getMyRequests);

// Fines & charges (FR-007)
router.get('/my-fines', patronController.getMyFines);

// Notifications & alerts (FR-008)
router.get('/notifications', patronController.getNotifications);
router.post('/notifications/:id/read', patronController.postMarkNotificationRead);
router.post('/notifications/read-all', patronController.postMarkAllNotificationsRead);

module.exports = router;
