const Book = require('../models/Book');
const Circulation = require('../models/Circulation');
const ServiceRequest = require('../models/ServiceRequest');
const Fine = require('../models/Fine');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');

module.exports = {
  // Patron Dashboard
  getDashboard: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const config = await Setting.getConfig();

      // Active loans
      const activeLoans = await Circulation.find({
        userId,
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      }).populate('bookId');

      // Check overdue count & dynamically calculate current fines
      let overdueCount = 0;
      let estimatedCurrentFine = 0;
      const now = new Date();

      for (const loan of activeLoans) {
        if (now > loan.dueDate) {
          overdueCount++;
          const daysLate = Math.ceil((now - loan.dueDate) / (1000 * 60 * 60 * 24));
          estimatedCurrentFine += daysLate * config.fineRatePerDay;
        }
      }

      // Pending requests
      const pendingRequestsCount = await ServiceRequest.countDocuments({
        userId,
        status: 'PENDING'
      });

      // Total pending fines in Fine collection
      const pendingFines = await Fine.find({ userId, status: 'PENDING' });
      const totalPendingFineAmount = pendingFines.reduce((acc, curr) => acc + curr.amount, 0);

      // Recent requests
      const recentRequests = await ServiceRequest.find({ userId })
        .populate('bookId')
        .sort({ createdAt: -1 })
        .limit(5);

      // Recent notifications
      const recentNotifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5);

      res.render('patron/dashboard', {
        title: 'Patron Dashboard - Library System',
        page: 'patron-dashboard',
        activeLoans,
        activeLoansCount: activeLoans.length,
        maxBooksAllowed: config.maxBooksPerPatron,
        overdueCount,
        estimatedCurrentFine,
        pendingRequestsCount,
        totalPendingFineAmount,
        recentRequests,
        recentNotifications
      });
    } catch (err) {
      console.error('Error in patron getDashboard:', err);
      req.flash('error_msg', 'Failed to load dashboard.');
      res.redirect('/catalog');
    }
  },

  // My Books (Active and Historical Circulations)
  getMyBooks: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const config = await Setting.getConfig();

      const circulations = await Circulation.find({ userId })
        .populate('bookId')
        .sort({ createdAt: -1 });

      const now = new Date();
      // Calculate dynamic fine for display on active overdue loans
      const enrichedCirculations = circulations.map(circ => {
        const item = circ.toObject();
        if (item.status !== 'RETURNED' && now > new Date(item.dueDate)) {
          const daysLate = Math.ceil((now - new Date(item.dueDate)) / (1000 * 60 * 60 * 24));
          item.currentFine = daysLate * config.fineRatePerDay;
          item.isOverdueNow = true;
          item.daysOverdue = daysLate;
        } else {
          item.currentFine = item.fine || 0;
          item.isOverdueNow = false;
        }
        return item;
      });

      res.render('patron/my-books', {
        title: 'My Borrowed Books & Loan History',
        page: 'my-books',
        circulations: enrichedCirculations,
        config
      });
    } catch (err) {
      console.error('Error in getMyBooks:', err);
      req.flash('error_msg', 'Could not load your borrowed books.');
      res.redirect('/patron/dashboard');
    }
  },

  // Service Request Form
  getRequestForm: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const { type, bookId, circulationId } = req.query;

      // Fetch active loans for renewal dropdown
      const activeLoans = await Circulation.find({
        userId,
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      }).populate('bookId');

      // Fetch all books for reservation dropdown
      const allBooks = await Book.find().sort({ title: 1 });

      let selectedBook = null;
      if (bookId) {
        selectedBook = await Book.findById(bookId);
      }

      res.render('patron/request-submit', {
        title: 'Submit Service Request - Library System',
        page: 'request-submit',
        defaultType: type || 'RESERVATION',
        selectedBookId: bookId || '',
        selectedCirculationId: circulationId || '',
        selectedBook,
        activeLoans,
        allBooks
      });
    } catch (err) {
      console.error('Error in getRequestForm:', err);
      req.flash('error_msg', 'Could not load request form.');
      res.redirect('/patron/dashboard');
    }
  },

  // Submit Service Request (FR-004, FR-005)
  postSubmitRequest: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const { type, bookId, circulationId, details, suggestedTitle, suggestedAuthor } = req.body;
      const config = await Setting.getConfig();

      if (!type || !details || details.trim() === '') {
        req.flash('error_msg', 'Please provide the request type and required details.');
        return res.redirect('/patron/request-submit');
      }

      // Business Rule Validation (FR-005)
      if (type === 'RESERVATION') {
        if (!bookId) {
          req.flash('error_msg', 'Please select a book to reserve.');
          return res.redirect('/patron/request-submit?type=RESERVATION');
        }

        // Check if user already reached maximum books limit
        const activeCirculationsCount = await Circulation.countDocuments({
          userId,
          status: { $in: ['ISSUED', 'OVERDUE'] },
          returnDate: null
        });

        if (activeCirculationsCount >= config.maxBooksPerPatron) {
          req.flash('error_msg', `Borrowing rule validation failed: You currently have ${activeCirculationsCount} books issued, which meets or exceeds the maximum limit of ${config.maxBooksPerPatron}.`);
          return res.redirect('/patron/request-submit?type=RESERVATION');
        }

        // Check if patron already has an active loan for this same book
        const alreadyIssued = await Circulation.findOne({
          userId,
          bookId,
          status: { $in: ['ISSUED', 'OVERDUE'] },
          returnDate: null
        });
        if (alreadyIssued) {
          req.flash('error_msg', 'You already have this book currently checked out.');
          return res.redirect('/patron/request-submit?type=RESERVATION');
        }

        // Check if user already has a pending reservation for this book
        const existingReservation = await ServiceRequest.findOne({
          userId,
          bookId,
          type: 'RESERVATION',
          status: 'PENDING'
        });
        if (existingReservation) {
          req.flash('error_msg', 'You already have a pending reservation request for this book.');
          return res.redirect('/patron/my-requests');
        }
      }

      if (type === 'RENEWAL') {
        if (!circulationId) {
          req.flash('error_msg', 'Please select the issued book you wish to renew.');
          return res.redirect('/patron/request-submit?type=RENEWAL');
        }

        const circ = await Circulation.findOne({ _id: circulationId, userId }).populate('bookId');
        if (!circ || circ.status === 'RETURNED') {
          req.flash('error_msg', 'Valid active circulation record not found for renewal.');
          return res.redirect('/patron/request-submit?type=RENEWAL');
        }

        if (circ.renewalCount >= 2) {
          req.flash('error_msg', 'Renewal limit reached: A book can be renewed a maximum of 2 times.');
          return res.redirect('/patron/my-books');
        }

        // Check if already requested renewal for this loan
        const existingRenewal = await ServiceRequest.findOne({
          userId,
          circulationId,
          type: 'RENEWAL',
          status: 'PENDING'
        });
        if (existingRenewal) {
          req.flash('error_msg', 'You already have a pending renewal request for this loan.');
          return res.redirect('/patron/my-requests');
        }
      }

      if (type === 'SUGGESTION') {
        if (!suggestedTitle || suggestedTitle.trim() === '') {
          req.flash('error_msg', 'Please provide the title of the book you want to suggest.');
          return res.redirect('/patron/request-submit?type=SUGGESTION');
        }
      }

      // Generate Unique Request ID
      const count = await ServiceRequest.countDocuments();
      const requestId = `REQ-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(3, '0')}`;

      const newRequest = new ServiceRequest({
        requestId,
        userId,
        bookId: bookId || null,
        circulationId: circulationId || null,
        type,
        status: 'PENDING',
        details: details.trim(),
        suggestedTitle: suggestedTitle ? suggestedTitle.trim() : '',
        suggestedAuthor: suggestedAuthor ? suggestedAuthor.trim() : '',
        submittedAt: new Date()
      });

      await newRequest.save();

      // Create confirmation notification for patron
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId,
        type: 'REQUEST_STATUS',
        title: 'Service Request Submitted',
        message: `Your ${type.toLowerCase()} request (${requestId}) was successfully submitted and is pending staff review.`,
        link: '/patron/my-requests'
      });

      req.flash('success_msg', `Service request ${requestId} submitted successfully. You can track its progress here.`);
      res.redirect('/patron/my-requests');
    } catch (err) {
      console.error('Error submitting service request:', err);
      req.flash('error_msg', 'Failed to submit service request. Please try again.');
      res.redirect('/patron/request-submit');
    }
  },

  // My Requests (FR-006 Tracking)
  getMyRequests: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const { status, type } = req.query;

      const filter = { userId };
      if (status && status !== 'ALL') filter.status = status;
      if (type && type !== 'ALL') filter.type = type;

      const requests = await ServiceRequest.find(filter)
        .populate('bookId')
        .populate('circulationId')
        .sort({ createdAt: -1 });

      res.render('patron/my-requests', {
        title: 'My Service Requests - Track Status',
        page: 'my-requests',
        requests,
        selectedStatus: status || 'ALL',
        selectedType: type || 'ALL'
      });
    } catch (err) {
      console.error('Error in getMyRequests:', err);
      req.flash('error_msg', 'Failed to retrieve your service requests.');
      res.redirect('/patron/dashboard');
    }
  },

  // My Fines (FR-007)
  getMyFines: async (req, res) => {
    try {
      const userId = req.session.user._id;

      const fines = await Fine.find({ userId })
        .populate({
          path: 'circulationId',
          populate: { path: 'bookId' }
        })
        .sort({ createdAt: -1 });

      const totalPending = fines
        .filter(f => f.status === 'PENDING')
        .reduce((sum, f) => sum + f.amount, 0);

      const totalPaid = fines
        .filter(f => f.status === 'PAID')
        .reduce((sum, f) => sum + f.amount, 0);

      res.render('patron/my-fines', {
        title: 'My Fines & Overdue Charges',
        page: 'my-fines',
        fines,
        totalPending,
        totalPaid
      });
    } catch (err) {
      console.error('Error in getMyFines:', err);
      req.flash('error_msg', 'Could not load your fines record.');
      res.redirect('/patron/dashboard');
    }
  },

  // Notifications List (FR-008)
  getNotifications: async (req, res) => {
    try {
      const userId = req.session.user._id;

      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 });

      res.render('patron/notifications', {
        title: 'My Notifications & Alerts',
        page: 'notifications',
        notifications
      });
    } catch (err) {
      console.error('Error in getNotifications:', err);
      req.flash('error_msg', 'Could not load notifications.');
      res.redirect('/patron/dashboard');
    }
  },

  // Mark single notification as read
  postMarkNotificationRead: async (req, res) => {
    try {
      const userId = req.session.user._id;
      const { id } = req.params;

      await Notification.findOneAndUpdate(
        { _id: id, userId },
        { status: 'READ' }
      );

      res.redirect(req.header('Referer') || '/patron/notifications');
    } catch (err) {
      console.error('Error marking notification read:', err);
      res.redirect('/patron/notifications');
    }
  },

  // Mark all notifications as read
  postMarkAllNotificationsRead: async (req, res) => {
    try {
      const userId = req.session.user._id;

      await Notification.updateMany(
        { userId, status: 'UNREAD' },
        { status: 'READ' }
      );

      req.flash('success_msg', 'All notifications marked as read.');
      res.redirect('/patron/notifications');
    } catch (err) {
      console.error('Error marking all notifications read:', err);
      res.redirect('/patron/notifications');
    }
  }
};
