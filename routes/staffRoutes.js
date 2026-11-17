const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

// Protect all staff routes
router.use(ensureAuthenticated);
router.use(ensureRole(['STAFF']));

// Dashboard (FR-009)
router.get('/dashboard', staffController.getDashboard);

// Circulation - Issue & Return (FR-003)
router.get('/circulation', staffController.getCirculations);
router.get('/circulation/issue', staffController.getIssueBook);
router.post('/circulation/issue', staffController.postIssueBook);
router.get('/circulation/return', staffController.getReturnBook);
router.post('/circulation/return', staffController.postReturnBook);

// Service Request Management (FR-005)
router.get('/requests', staffController.getRequests);
router.get('/requests/:id', staffController.getRequestDetail);
router.post('/requests/:id/status', staffController.postUpdateRequestStatus);

// Catalog / Book Inventory Management
router.get('/books', staffController.getBooks);
router.get('/books/add', staffController.getAddBook);
router.post('/books/add', staffController.postAddBook);
router.get('/books/edit/:id', staffController.getEditBook);
router.post('/books/edit/:id', staffController.postEditBook);
router.post('/books/delete/:id', staffController.postDeleteBook);
router.get('/books/:id/copies', staffController.getBookCopies);
router.post('/books/:id/copies/add', staffController.postAddCopy);
router.post('/books/copies/:copyId/status', staffController.postUpdateCopyStatus);
router.post('/books/copies/:copyId/delete', staffController.postDeleteCopy);

// Fines Management (FR-007)
router.get('/fines', staffController.getFines);
router.post('/fines/:id/status', staffController.postUpdateFineStatus);

// User Accounts Management
router.get('/users', staffController.getUsers);
router.post('/users/:id/toggle', staffController.postToggleUserStatus);
router.get('/users/add-staff', staffController.getAddStaffUser);
router.post('/users/add-staff', staffController.postAddStaffUser);

// System Configuration & Library Rules
router.get('/settings', staffController.getSettings);
router.post('/settings', staffController.postSettings);

module.exports = router;
