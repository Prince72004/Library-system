const User = require('../models/User');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const Circulation = require('../models/Circulation');
const ServiceRequest = require('../models/ServiceRequest');
const Fine = require('../models/Fine');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');

module.exports = {
  // Staff Dashboard (FR-009)
  getDashboard: async (req, res) => {
    try {
      const config = await Setting.getConfig();

      // Counts for KPIs
      const totalBooks = await Book.countDocuments();
      const availableBooks = await Book.countDocuments({ availableCopies: { $gt: 0 } });
      const issuedBooks = await Circulation.countDocuments({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      });

      const now = new Date();
      const overdueBooks = await Circulation.countDocuments({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        dueDate: { $lt: now },
        returnDate: null
      });

      const pendingRequests = await ServiceRequest.countDocuments({ status: 'PENDING' });
      const totalPatrons = await User.countDocuments({ role: 'PATRON' });

      // Fine calculations
      const pendingFines = await Fine.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalPendingFine = pendingFines.length > 0 ? pendingFines[0].total : 0;

      const collectedFines = await Fine.aggregate([
        { $match: { status: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalCollectedFine = collectedFines.length > 0 ? collectedFines[0].total : 0;

      // Recent active circulations
      const recentCirculations = await Circulation.find()
        .populate('userId')
        .populate('bookId')
        .sort({ createdAt: -1 })
        .limit(6);

      // Recent pending requests
      const recentRequests = await ServiceRequest.find({ status: 'PENDING' })
        .populate('userId')
        .populate('bookId')
        .sort({ createdAt: -1 })
        .limit(6);

      // Data for charts: Request types distribution
      const requestStats = await ServiceRequest.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);

      // Category breakdown
      const categoryStats = await Book.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]);

      res.render('staff/dashboard', {
        title: 'Staff Control Dashboard - Library System',
        page: 'staff-dashboard',
        stats: {
          totalBooks,
          availableBooks,
          issuedBooks,
          overdueBooks,
          pendingRequests,
          totalPatrons,
          totalPendingFine,
          totalCollectedFine
        },
        recentCirculations,
        recentRequests,
        requestStats: JSON.stringify(requestStats),
        categoryStats: JSON.stringify(categoryStats),
        config
      });
    } catch (err) {
      console.error('Error in staff getDashboard:', err);
      req.flash('error_msg', 'Failed to load staff dashboard.');
      res.redirect('/catalog');
    }
  },

  // Issue Book Form (FR-003)
  getIssueBook: async (req, res) => {
    try {
      const { bookId, copyId, patronId } = req.query;
      const config = await Setting.getConfig();

      // Only active patrons
      const patrons = await User.find({ role: 'PATRON', accountStatus: 'ACTIVE' }).sort({ name: 1 });
      // Only available books
      const availableBooks = await Book.find({ availableCopies: { $gt: 0 } }).sort({ title: 1 });
      // Available physical copies
      const availableCopies = await BookCopy.find({ status: 'AVAILABLE' })
        .populate('bookId')
        .sort({ copyId: 1 });

      let selectedBook = null;
      if (bookId) {
        selectedBook = await Book.findById(bookId);
      }

      let selectedCopy = null;
      if (copyId) {
        selectedCopy = await BookCopy.findOne({ copyId: copyId.toUpperCase() }).populate('bookId');
        if (selectedCopy && selectedCopy.bookId) {
          selectedBook = selectedCopy.bookId;
        }
      }

      let selectedPatron = null;
      if (patronId) {
        selectedPatron = await User.findById(patronId);
      }

      res.render('staff/issue-book', {
        title: 'Issue Book to Patron - Circulation',
        page: 'issue-book',
        patrons,
        availableBooks,
        availableCopies,
        selectedBook,
        selectedCopy,
        selectedPatron,
        config
      });
    } catch (err) {
      console.error('Error loading issue book form:', err);
      req.flash('error_msg', 'Failed to load issue page.');
      res.redirect('/staff/dashboard');
    }
  },

  // Process Book Issue (FR-003, Sequence Diagram 3.8)
  postIssueBook: async (req, res) => {
    try {
      const { patronEmailOrId, bookTitleOrId, specificCopyId, customDueDays } = req.body;
      const config = await Setting.getConfig();

      // 1. Find patron
      const patron = await User.findOne({
        $or: [
          { email: patronEmailOrId.toLowerCase().trim() },
          { userId: patronEmailOrId.trim() },
          { enrollmentNo: patronEmailOrId.trim() }
        ]
      });

      if (!patron) {
        req.flash('error_msg', `Patron "${patronEmailOrId}" not found.`);
        return res.redirect('/staff/circulation/issue');
      }

      if (patron.accountStatus !== 'ACTIVE') {
        req.flash('error_msg', `Cannot issue book: Patron account is currently ${patron.accountStatus}.`);
        return res.redirect('/staff/circulation/issue');
      }

      // Check borrowing limit (max-books-per-patron rule)
      const activeCirculationsCount = await Circulation.countDocuments({
        userId: patron._id,
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      });

      if (activeCirculationsCount >= config.maxBooksPerPatron) {
        req.flash('error_msg', `Cannot issue book: Patron has reached maximum borrowing limit (${activeCirculationsCount}/${config.maxBooksPerPatron} books).`);
        return res.redirect('/staff/circulation/issue');
      }

      // 2. Identify Book and Specific Physical Copy
      let book = null;
      let targetCopy = null;

      // Check if a specific copy ID was selected from dropdown or entered in input
      const copyIdentifier = (specificCopyId && specificCopyId.trim() !== '') ? specificCopyId : bookTitleOrId;
      if (copyIdentifier && copyIdentifier.trim() !== '') {
        targetCopy = await BookCopy.findOne({
          copyId: copyIdentifier.trim().toUpperCase()
        }).populate('bookId');

        if (targetCopy) {
          book = targetCopy.bookId;
        }
      }

      // If not matched by Copy ID, lookup by Book ID or Title
      if (!book) {
        if (bookTitleOrId.match(/^[0-9a-fA-F]{24}$/)) {
          book = await Book.findById(bookTitleOrId);
        }
        if (!book) {
          book = await Book.findOne({
            $or: [
              { bookId: bookTitleOrId.trim() },
              { title: new RegExp(`^${bookTitleOrId.trim()}$`, 'i') }
            ]
          });
        }
      }

      if (!book) {
        req.flash('error_msg', `Book or Copy "${bookTitleOrId}" not found in catalog.`);
        return res.redirect('/staff/circulation/issue');
      }

      // If specific copy wasn't manually selected, allocate the first available physical copy of this book
      if (!targetCopy) {
        targetCopy = await BookCopy.findOne({
          bookId: book._id,
          status: 'AVAILABLE'
        }).sort({ copyNumber: 1 });
      }

      if (!targetCopy || targetCopy.status !== 'AVAILABLE') {
        req.flash('error_msg', `Cannot issue: Physical copy ${targetCopy ? targetCopy.copyId : ''} is not available (Status: ${targetCopy ? targetCopy.status : 'None available'}).`);
        return res.redirect('/staff/circulation/issue');
      }

      // Check if user already holds a copy of this book
      const alreadyHasBook = await Circulation.findOne({
        userId: patron._id,
        bookId: book._id,
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      });

      if (alreadyHasBook) {
        req.flash('error_msg', `Patron already currently has a copy (${alreadyHasBook.copyCode || 'book'}) of "${book.title}" issued.`);
        return res.redirect('/staff/circulation/issue');
      }

      // 3. Calculate Due Date (Issue Date + loan period)
      const days = parseInt(customDueDays) || config.loanPeriodDays;
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + days * 24 * 60 * 60 * 1000);

      // Generate Circulation ID
      const circCount = await Circulation.countDocuments();
      const circulationId = `CIRC-${Date.now().toString().slice(-6)}-${String(circCount + 1).padStart(3, '0')}`;

      // 4. Create Circulation Record linked to Copy
      const newCirculation = new Circulation({
        circulationId,
        userId: patron._id,
        bookId: book._id,
        copyId: targetCopy._id,
        copyCode: targetCopy.copyId,
        issueDate,
        dueDate,
        status: 'ISSUED',
        fine: 0
      });
      await newCirculation.save();

      // 5. Update Target Copy Status to ISSUED
      targetCopy.status = 'ISSUED';
      targetCopy.currentCirculationId = newCirculation._id;
      await targetCopy.save();

      // 6. Update Book Available Copies count
      const availableCount = await BookCopy.countDocuments({
        bookId: book._id,
        status: 'AVAILABLE'
      });
      book.availableCopies = availableCount;
      book.availability = availableCount > 0;
      await book.save();

      // If there was a pending reservation by this patron for this book, resolve it
      await ServiceRequest.updateMany(
        { userId: patron._id, bookId: book._id, type: 'RESERVATION', status: 'PENDING' },
        { status: 'RESOLVED', staffRemarks: `Copy ${targetCopy.copyId} issued on ${issueDate.toLocaleDateString()} (${circulationId})`, resolvedAt: new Date() }
      );

      // 7. Create Notification for Patron
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: patron._id,
        type: 'CIRCULATION',
        title: 'Book Issued Successfully',
        message: `"${book.title}" (Copy ID: ${targetCopy.copyId}) has been issued to you. Due date: ${dueDate.toLocaleDateString()}.`,
        link: '/patron/my-books'
      });

      req.flash('success_msg', `Success! "${book.title}" [Copy: ${targetCopy.copyId}] issued to ${patron.name} (${patron.userId}). Due date: ${dueDate.toLocaleDateString()}`);
      res.redirect('/staff/circulation');
    } catch (err) {
      console.error('Error issuing book:', err);
      req.flash('error_msg', 'Failed to issue book. An error occurred.');
      res.redirect('/staff/circulation/issue');
    }
  },

  // Return Book View & Quick Return list (FR-003, Sequence Diagram 3.8/3.9)
  getReturnBook: async (req, res) => {
    try {
      const { search } = req.query;
      const config = await Setting.getConfig();

      let query = {
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      };

      const activeCirculations = await Circulation.find(query)
        .populate('userId')
        .populate('bookId')
        .sort({ dueDate: 1 });

      const now = new Date();
      const enrichedCirculations = activeCirculations.map(circ => {
        const item = circ.toObject();
        if (now > new Date(item.dueDate)) {
          const daysLate = Math.ceil((now - new Date(item.dueDate)) / (1000 * 60 * 60 * 24));
          item.isOverdue = true;
          item.daysOverdue = daysLate;
          item.calculatedFine = daysLate * config.fineRatePerDay;
        } else {
          item.isOverdue = false;
          item.daysOverdue = 0;
          item.calculatedFine = 0;
        }
        return item;
      });

      // Filter by search if provided
      let filtered = enrichedCirculations;
      if (search && search.trim() !== '') {
        const s = search.toLowerCase().trim();
        filtered = enrichedCirculations.filter(c =>
          (c.bookId && c.bookId.title.toLowerCase().includes(s)) ||
          (c.bookId && c.bookId.bookId.toLowerCase().includes(s)) ||
          (c.userId && c.userId.name.toLowerCase().includes(s)) ||
          (c.userId && c.userId.email.toLowerCase().includes(s)) ||
          (c.userId && c.userId.userId.toLowerCase().includes(s)) ||
          (c.circulationId && c.circulationId.toLowerCase().includes(s))
        );
      }

      res.render('staff/return-book', {
        title: 'Return Books & Fine Evaluation - Circulation',
        page: 'return-book',
        circulations: filtered,
        searchQuery: search || '',
        config
      });
    } catch (err) {
      console.error('Error in getReturnBook:', err);
      req.flash('error_msg', 'Failed to load return books page.');
      res.redirect('/staff/dashboard');
    }
  },

  // Process Book Return (FR-003, FR-007 Automated Fine Calculation)
  postReturnBook: async (req, res) => {
    try {
      const { circulationId, remarks, waiveFine } = req.body;
      const config = await Setting.getConfig();

      const circ = await Circulation.findById(circulationId)
        .populate('userId')
        .populate('bookId');

      if (!circ) {
        req.flash('error_msg', 'Circulation record not found.');
        return res.redirect('/staff/circulation/return');
      }

      if (circ.returnDate) {
        req.flash('error_msg', 'This book has already been returned.');
        return res.redirect('/staff/circulation/return');
      }

      const returnDate = new Date();
      circ.returnDate = returnDate;
      circ.status = 'RETURNED';
      if (remarks) circ.remarks = remarks;

      // Automated Overdue Fine Calculation (FR-007)
      let fineAmount = 0;
      let fineRecord = null;
      const isOverdue = returnDate > circ.dueDate;

      if (isOverdue) {
        const diffMs = returnDate - circ.dueDate;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        fineAmount = diffDays * config.fineRatePerDay;
        circ.fine = fineAmount;

        // Create Fine Record
        const fineCount = await Fine.countDocuments();
        const fineId = `FINE-${Date.now().toString().slice(-6)}-${String(fineCount + 1).padStart(3, '0')}`;

        fineRecord = new Fine({
          fineId,
          circulationId: circ._id,
          userId: circ.userId._id,
          amount: fineAmount,
          reason: `Overdue Return: ${diffDays} day(s) late (Rate: Rs ${config.fineRatePerDay}/day)`,
          status: waiveFine === 'true' ? 'WAIVED' : 'PENDING'
        });
        await fineRecord.save();

        // Overdue Fine Notification for Patron
        await Notification.create({
          notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: circ.userId._id,
          type: 'OVERDUE',
          title: 'Overdue Fine Assessed',
          message: `The book "${circ.bookId.title}" was returned ${diffDays} day(s) late. A fine of Rs ${fineAmount} has been registered to your account.`,
          link: '/patron/my-fines'
        });
      } else {
        circ.fine = 0;
      }

      await circ.save();

      // Restock individual physical BookCopy
      if (circ.copyId) {
        await BookCopy.findByIdAndUpdate(circ.copyId, {
          status: 'AVAILABLE',
          currentCirculationId: null
        });
      } else if (circ.copyCode) {
        await BookCopy.findOneAndUpdate({ copyId: circ.copyCode }, {
          status: 'AVAILABLE',
          currentCirculationId: null
        });
      }

      // Update book availability copies count
      const book = await Book.findById(circ.bookId._id);
      if (book) {
        const availableCount = await BookCopy.countDocuments({
          bookId: book._id,
          status: 'AVAILABLE'
        });
        book.availableCopies = availableCount;
        book.availability = availableCount > 0;
        await book.save();
      }

      // Return confirmation Notification
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: circ.userId._id,
        type: 'CIRCULATION',
        title: 'Book Return Confirmed',
        message: `"${circ.bookId.title}" [Copy: ${circ.copyCode || 'Standard'}] has been successfully returned to the library. Thank you!`,
        link: '/patron/my-books'
      });

      let msg = `Book "${circ.bookId.title}" (Copy: ${circ.copyCode || 'Standard'}) returned successfully from ${circ.userId.name}.`;
      if (fineAmount > 0) {
        msg += ` Overdue fine calculated: Rs ${fineAmount} (${fineRecord.status}).`;
      }
      req.flash('success_msg', msg);
      res.redirect('/staff/circulation/return');
    } catch (err) {
      console.error('Error returning book:', err);
      req.flash('error_msg', 'Failed to process book return.');
      res.redirect('/staff/circulation/return');
    }
  },

  // All Circulations List
  getCirculations: async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status && status !== 'ALL') filter.status = status;

      const circulations = await Circulation.find(filter)
        .populate('userId')
        .populate('bookId')
        .sort({ createdAt: -1 });

      res.render('staff/circulation-list', {
        title: 'Circulation Transactions History',
        page: 'circulations',
        circulations,
        selectedStatus: status || 'ALL'
      });
    } catch (err) {
      console.error('Error in getCirculations:', err);
      req.flash('error_msg', 'Failed to retrieve circulations.');
      res.redirect('/staff/dashboard');
    }
  },

  // Manage Service Requests (FR-005)
  getRequests: async (req, res) => {
    try {
      const { status, type } = req.query;
      const filter = {};
      if (status && status !== 'ALL') filter.status = status;
      if (type && type !== 'ALL') filter.type = type;

      const requests = await ServiceRequest.find(filter)
        .populate('userId')
        .populate('bookId')
        .populate('circulationId')
        .sort({ createdAt: -1 });

      res.render('staff/requests-manage', {
        title: 'Service Requests Management - Staff',
        page: 'staff-requests',
        requests,
        selectedStatus: status || 'ALL',
        selectedType: type || 'ALL'
      });
    } catch (err) {
      console.error('Error in getRequests:', err);
      req.flash('error_msg', 'Failed to retrieve service requests.');
      res.redirect('/staff/dashboard');
    }
  },

  // Request Details & Action view (FR-005)
  getRequestDetail: async (req, res) => {
    try {
      const request = await ServiceRequest.findById(req.params.id)
        .populate('userId')
        .populate('bookId')
        .populate({
          path: 'circulationId',
          populate: { path: 'bookId' }
        });

      if (!request) {
        req.flash('error_msg', 'Service request not found.');
        return res.redirect('/staff/requests');
      }

      res.render('staff/request-detail', {
        title: `Service Request ${request.requestId}`,
        page: 'staff-requests',
        request
      });
    } catch (err) {
      console.error('Error in getRequestDetail:', err);
      req.flash('error_msg', 'Could not open request details.');
      res.redirect('/staff/requests');
    }
  },

  // Update Service Request Status: Approve / Reject / Resolve (FR-005)
  postUpdateRequestStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { action, staffRemarks } = req.body;
      const config = await Setting.getConfig();

      const request = await ServiceRequest.findById(id)
        .populate('userId')
        .populate('bookId')
        .populate('circulationId');

      if (!request) {
        req.flash('error_msg', 'Service request not found.');
        return res.redirect('/staff/requests');
      }

      let newStatus = 'PENDING';
      if (action === 'APPROVE') newStatus = 'APPROVED';
      else if (action === 'REJECT') newStatus = 'REJECTED';
      else if (action === 'RESOLVE') newStatus = 'RESOLVED';

      request.status = newStatus;
      request.staffRemarks = staffRemarks ? staffRemarks.trim() : `Action: ${action} by library staff`;
      if (newStatus === 'RESOLVED' || newStatus === 'REJECTED') {
        request.resolvedAt = new Date();
      }

      // Special action for RENEWAL approval: extend due date!
      if (request.type === 'RENEWAL' && (action === 'APPROVE' || action === 'RESOLVE')) {
        if (request.circulationId) {
          const circ = await Circulation.findById(request.circulationId._id);
          if (circ && circ.status !== 'RETURNED') {
            const currentDue = new Date(circ.dueDate);
            const extendedDue = new Date(currentDue.getTime() + config.loanPeriodDays * 24 * 60 * 60 * 1000);
            circ.dueDate = extendedDue;
            circ.renewalCount = (circ.renewalCount || 0) + 1;
            circ.status = 'ISSUED'; // reset overdue if renewed
            await circ.save();
            request.staffRemarks += ` (Due date extended to ${extendedDue.toLocaleDateString()})`;
          }
        }
      }

      await request.save();

      // Create status update Notification for Patron (FR-008)
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: request.userId._id,
        type: 'REQUEST_STATUS',
        title: `Service Request ${newStatus}`,
        message: `Your ${request.type.toLowerCase()} request (${request.requestId}) has been ${newStatus.toLowerCase()}. Remarks: ${request.staffRemarks}`,
        link: '/patron/my-requests'
      });

      req.flash('success_msg', `Request ${request.requestId} updated to ${newStatus}.`);
      res.redirect(`/staff/requests/${request._id}`);
    } catch (err) {
      console.error('Error updating request status:', err);
      req.flash('error_msg', 'Failed to update request.');
      res.redirect('/staff/requests');
    }
  },

  // Book Inventory Management (List)
  getBooks: async (req, res) => {
    try {
      const { search } = req.query;
      const query = {};
      if (search && search.trim() !== '') {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [
          { title: regex },
          { author: regex },
          { category: regex },
          { bookId: regex },
          { isbn: regex }
        ];
      }

      const books = await Book.find(query).sort({ createdAt: -1 });

      res.render('staff/books-manage', {
        title: 'Manage Book Catalog & Inventory',
        page: 'staff-books',
        books,
        searchQuery: search || ''
      });
    } catch (err) {
      console.error('Error in staff getBooks:', err);
      req.flash('error_msg', 'Failed to load books catalog.');
      res.redirect('/staff/dashboard');
    }
  },

  // Add Book Form
  getAddBook: (req, res) => {
    res.render('staff/book-form', {
      title: 'Add New Book to Catalog',
      page: 'staff-books',
      book: null,
      isEdit: false
    });
  },

  // Process Add Book
  postAddBook: async (req, res) => {
    try {
      const { title, author, category, isbn, publisher, edition, shelfLocation, coverImage, totalCopies, description } = req.body;

      if (!title || !author) {
        req.flash('error_msg', 'Book title and author are required.');
        return res.redirect('/staff/books/add');
      }

      const count = await Book.countDocuments();
      const bookId = `BK-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(3, '0')}`;
      const copies = parseInt(totalCopies) || 1;

      const newBook = new Book({
        bookId,
        title: title.trim(),
        author: author.trim(),
        category: category ? category.trim() : 'General',
        isbn: isbn ? isbn.trim() : '',
        publisher: publisher ? publisher.trim() : '',
        edition: edition ? edition.trim() : '',
        shelfLocation: shelfLocation ? shelfLocation.trim() : 'Main Stack',
        coverImage: coverImage ? coverImage.trim() : '',
        totalCopies: copies,
        availableCopies: copies,
        availability: copies > 0,
        description: description ? description.trim() : ''
      });

      await newBook.save();

      // Automatically generate unique BookCopy records for each copy! (Mentor feedback)
      for (let i = 1; i <= copies; i++) {
        const copyId = `${bookId}-C${String(i).padStart(2, '0')}`;
        await BookCopy.create({
          copyId,
          bookId: newBook._id,
          copyNumber: i,
          status: 'AVAILABLE',
          shelfLocation: newBook.shelfLocation || 'Main Stack',
          conditionNotes: 'Good'
        });
      }

      req.flash('success_msg', `Book "${newBook.title}" added to catalog with ID: ${bookId} and ${copies} unique copies generated (${bookId}-C01 to ${bookId}-C${String(copies).padStart(2, '0')}).`);
      res.redirect('/staff/books');
    } catch (err) {
      console.error('Error adding book:', err);
      req.flash('error_msg', 'Failed to add book. Please try again.');
      res.redirect('/staff/books/add');
    }
  },

  // Edit Book Form
  getEditBook: async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error_msg', 'Book not found.');
        return res.redirect('/staff/books');
      }

      res.render('staff/book-form', {
        title: `Edit Book - ${book.title}`,
        page: 'staff-books',
        book,
        isEdit: true
      });
    } catch (err) {
      console.error('Error loading edit book form:', err);
      req.flash('error_msg', 'Could not open book edit page.');
      res.redirect('/staff/books');
    }
  },

  // Process Edit Book
  postEditBook: async (req, res) => {
    try {
      const { title, author, category, isbn, publisher, edition, shelfLocation, coverImage, totalCopies, availableCopies, description } = req.body;

      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error_msg', 'Book not found.');
        return res.redirect('/staff/books');
      }

      book.title = title.trim();
      book.author = author.trim();
      book.category = category ? category.trim() : 'General';
      book.isbn = isbn ? isbn.trim() : '';
      book.publisher = publisher ? publisher.trim() : '';
      book.edition = edition ? edition.trim() : '';
      book.shelfLocation = shelfLocation ? shelfLocation.trim() : '';
      if (typeof coverImage !== 'undefined') book.coverImage = coverImage.trim();
      book.description = description ? description.trim() : '';

      let targetCopies = parseInt(totalCopies);
      const reqAvail = parseInt(availableCopies);
      if (!isNaN(reqAvail) && (isNaN(targetCopies) || reqAvail > targetCopies)) {
        targetCopies = reqAvail;
      }

      const existingCopies = await BookCopy.find({ bookId: book._id }).sort({ copyNumber: 1 });
      const existingCount = existingCopies.length;

      if (!isNaN(targetCopies) && targetCopies > 0) {
        if (targetCopies > existingCount) {
          // Increase copies: generate additional BookCopy records
          let highestNum = 0;
          for (const c of existingCopies) {
            if (c.copyNumber > highestNum) highestNum = c.copyNumber;
          }

          const needed = targetCopies - existingCount;
          for (let k = 1; k <= needed; k++) {
            const nextNum = highestNum + k;
            let copyCode = `${book.bookId}-C${String(nextNum).padStart(2, '0')}`;
            const exists = await BookCopy.findOne({ copyId: copyCode });
            if (exists) {
              copyCode = `${book.bookId}-C${Date.now().toString().slice(-4)}${nextNum}`;
            }

            await BookCopy.create({
              copyId: copyCode,
              bookId: book._id,
              copyNumber: nextNum,
              status: 'AVAILABLE',
              shelfLocation: book.shelfLocation || 'Main Stack',
              conditionNotes: 'Good'
            });
          }
        } else if (targetCopies < existingCount) {
          // Decrease copies: remove available copies from highest numbers downwards
          const toRemoveCount = existingCount - targetCopies;
          const availableToRemove = await BookCopy.find({
            bookId: book._id,
            status: 'AVAILABLE'
          }).sort({ copyNumber: -1 }).limit(toRemoveCount);

          for (const copy of availableToRemove) {
            await BookCopy.findByIdAndDelete(copy._id);
          }
        }
      }

      // Sync final total and available counts from BookCopy collection
      const finalTotal = await BookCopy.countDocuments({ bookId: book._id });
      const finalAvailable = await BookCopy.countDocuments({ bookId: book._id, status: 'AVAILABLE' });

      book.totalCopies = finalTotal > 0 ? finalTotal : (targetCopies || 1);
      book.availableCopies = finalTotal > 0 ? finalAvailable : (targetCopies || 1);
      book.availability = book.availableCopies > 0;

      await book.save();

      let msg = `Book "${book.title}" updated successfully. Total copies: ${book.totalCopies} (${book.availableCopies} available on shelf).`;
      if (!isNaN(targetCopies) && targetCopies < existingCount && finalTotal > targetCopies) {
        msg += ` (Note: Could not reduce to ${targetCopies} copies because ${finalTotal - finalAvailable} copies are currently issued to patrons.)`;
      }
      req.flash('success_msg', msg);
      res.redirect('/staff/books');
    } catch (err) {
      console.error('Error updating book:', err);
      req.flash('error_msg', 'Failed to update book.');
      res.redirect('/staff/books');
    }
  },

  // View & Manage Individual Physical Copies of a Book
  getBookCopies: async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error_msg', 'Book not found.');
        return res.redirect('/staff/books');
      }

      const copies = await BookCopy.find({ bookId: book._id })
        .populate({
          path: 'currentCirculationId',
          populate: { path: 'userId', select: 'name email userId enrollmentNo' }
        })
        .sort({ copyNumber: 1 });

      res.render('staff/book-copies', {
        title: `Manage Copies - ${book.title}`,
        page: 'staff-books',
        book,
        copies
      });
    } catch (err) {
      console.error('Error in getBookCopies:', err);
      req.flash('error_msg', 'Could not load book copies.');
      res.redirect('/staff/books');
    }
  },

  // Add individual or multiple new physical copies to an existing title
  postAddCopy: async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error_msg', 'Book not found.');
        return res.redirect('/staff/books');
      }

      const { shelfLocation, customCopyId, numberOfCopies } = req.body;
      const countToAdd = Math.max(1, parseInt(numberOfCopies) || 1);

      // Find highest copyNumber so far to avoid any duplicate key collisions
      const highestCopy = await BookCopy.findOne({ bookId: book._id }).sort({ copyNumber: -1 });
      let currentMaxNum = highestCopy ? highestCopy.copyNumber : 0;

      const createdCodes = [];
      for (let i = 1; i <= countToAdd; i++) {
        currentMaxNum++;
        let copyId;
        if (countToAdd === 1 && customCopyId && customCopyId.trim() !== '') {
          copyId = customCopyId.trim().toUpperCase();
        } else {
          copyId = `${book.bookId}-C${String(currentMaxNum).padStart(2, '0')}`;
        }

        // Avoid collision
        const existing = await BookCopy.findOne({ copyId });
        if (existing) {
          copyId = `${book.bookId}-C${Date.now().toString().slice(-4)}${currentMaxNum}`;
        }

        await BookCopy.create({
          copyId,
          bookId: book._id,
          copyNumber: currentMaxNum,
          status: 'AVAILABLE',
          shelfLocation: shelfLocation ? shelfLocation.trim() : (book.shelfLocation || 'Main Stack'),
          conditionNotes: 'Good'
        });
        createdCodes.push(copyId);
      }

      // Update book totals
      const totalCount = await BookCopy.countDocuments({ bookId: book._id });
      const availCount = await BookCopy.countDocuments({ bookId: book._id, status: 'AVAILABLE' });
      book.totalCopies = totalCount;
      book.availableCopies = availCount;
      book.availability = availCount > 0;
      await book.save();

      req.flash('success_msg', `Added ${countToAdd} physical ${countToAdd === 1 ? 'copy' : 'copies'} (${createdCodes.slice(0, 3).join(', ')}${createdCodes.length > 3 ? '...' : ''}) to "${book.title}".`);
      res.redirect(`/staff/books/${book._id}/copies`);
    } catch (err) {
      console.error('Error adding copy:', err);
      req.flash('error_msg', 'Failed to add physical copy.');
      res.redirect('/staff/books');
    }
  },

  // Delete an unissued physical copy
  postDeleteCopy: async (req, res) => {
    try {
      const { copyId } = req.params;
      const copy = await BookCopy.findById(copyId);
      if (!copy) {
        req.flash('error_msg', 'Physical copy not found.');
        return res.redirect('/staff/books');
      }

      if (copy.status === 'ISSUED') {
        req.flash('error_msg', `Cannot remove copy "${copy.copyId}": It is currently issued to a patron.`);
        return res.redirect(`/staff/books/${copy.bookId}/copies`);
      }

      const bookId = copy.bookId;
      await BookCopy.findByIdAndDelete(copyId);

      // Resync parent book stock
      const totalCount = await BookCopy.countDocuments({ bookId });
      const availCount = await BookCopy.countDocuments({ bookId, status: 'AVAILABLE' });
      await Book.findByIdAndUpdate(bookId, {
        totalCopies: totalCount,
        availableCopies: availCount,
        availability: availCount > 0
      });

      req.flash('success_msg', `Physical copy "${copy.copyId}" removed from inventory.`);
      res.redirect(`/staff/books/${bookId}/copies`);
    } catch (err) {
      console.error('Error deleting physical copy:', err);
      req.flash('error_msg', 'Failed to delete physical copy.');
      res.redirect('/staff/books');
    }
  },

  // Update physical copy status (e.g. mark as DAMAGED, LOST, MAINTENANCE, AVAILABLE)
  postUpdateCopyStatus: async (req, res) => {
    try {
      const { copyId } = req.params;
      const { status, conditionNotes, shelfLocation } = req.body;

      const copy = await BookCopy.findById(copyId).populate('bookId');
      if (!copy) {
        req.flash('error_msg', 'Copy record not found.');
        return res.redirect('/staff/books');
      }

      copy.status = status;
      if (conditionNotes) copy.conditionNotes = conditionNotes.trim();
      if (shelfLocation) copy.shelfLocation = shelfLocation.trim();
      if (status !== 'ISSUED') {
        copy.currentCirculationId = null;
      }
      await copy.save();

      // Sync parent book availability
      const availCount = await BookCopy.countDocuments({
        bookId: copy.bookId._id,
        status: 'AVAILABLE'
      });
      const totalCount = await BookCopy.countDocuments({ bookId: copy.bookId._id });
      await Book.findByIdAndUpdate(copy.bookId._id, {
        availableCopies: availCount,
        totalCopies: totalCount,
        availability: availCount > 0
      });

      req.flash('success_msg', `Physical copy "${copy.copyId}" status updated to ${status}.`);
      res.redirect(`/staff/books/${copy.bookId._id}/copies`);
    } catch (err) {
      console.error('Error updating copy status:', err);
      req.flash('error_msg', 'Failed to update copy status.');
      res.redirect('/staff/books');
    }
  },

  // Delete Book and all its copies
  postDeleteBook: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if book has active circulations
      const activeCirc = await Circulation.findOne({
        bookId: id,
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      });

      if (activeCirc) {
        req.flash('error_msg', 'Cannot delete book: Copies of this book are currently issued to patrons.');
        return res.redirect('/staff/books');
      }

      await BookCopy.deleteMany({ bookId: id });
      await Book.findByIdAndDelete(id);
      req.flash('success_msg', 'Book and all its physical copies removed from catalog.');
      res.redirect('/staff/books');
    } catch (err) {
      console.error('Error deleting book:', err);
      req.flash('error_msg', 'Failed to delete book.');
      res.redirect('/staff/books');
    }
  },

  // Fines Management (FR-007)
  getFines: async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status && status !== 'ALL') filter.status = status;

      const fines = await Fine.find(filter)
        .populate('userId')
        .populate({
          path: 'circulationId',
          populate: { path: 'bookId' }
        })
        .sort({ createdAt: -1 });

      const totalPending = fines.filter(f => f.status === 'PENDING').reduce((s, f) => s + f.amount, 0);
      const totalPaid = fines.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0);

      res.render('staff/fines-manage', {
        title: 'Fines Management & Settlement - Staff',
        page: 'staff-fines',
        fines,
        selectedStatus: status || 'ALL',
        totalPending,
        totalPaid
      });
    } catch (err) {
      console.error('Error in getFines:', err);
      req.flash('error_msg', 'Failed to load fines.');
      res.redirect('/staff/dashboard');
    }
  },

  // Update Fine Status (Paid or Waived)
  postUpdateFineStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      const fine = await Fine.findById(id).populate('userId');
      if (!fine) {
        req.flash('error_msg', 'Fine record not found.');
        return res.redirect('/staff/fines');
      }

      fine.status = status;
      if (status === 'PAID') {
        fine.paidAt = new Date();
      }
      if (remarks) fine.remarks = remarks;
      await fine.save();

      // Create Notification for patron
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: fine.userId._id,
        type: 'GENERAL',
        title: `Fine Status Updated: ${status}`,
        message: `Your fine (${fine.fineId}) of Rs ${fine.amount} has been marked as ${status}. ${remarks ? 'Remarks: ' + remarks : ''}`,
        link: '/patron/my-fines'
      });

      req.flash('success_msg', `Fine ${fine.fineId} marked as ${status}.`);
      res.redirect('/staff/fines');
    } catch (err) {
      console.error('Error updating fine status:', err);
      req.flash('error_msg', 'Failed to update fine.');
      res.redirect('/staff/fines');
    }
  },

  // Users Management
  getUsers: async (req, res) => {
    try {
      const { role } = req.query;
      const filter = {};
      if (role && role !== 'ALL') filter.role = role;

      const users = await User.find(filter).sort({ role: 1, name: 1 });

      res.render('staff/users-manage', {
        title: 'User Accounts Management - Staff',
        page: 'staff-users',
        users,
        selectedRole: role || 'ALL'
      });
    } catch (err) {
      console.error('Error in getUsers:', err);
      req.flash('error_msg', 'Failed to load user accounts.');
      res.redirect('/staff/dashboard');
    }
  },

  // Toggle User Account Status (ACTIVE/INACTIVE)
  postToggleUserStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id);

      if (!user) {
        req.flash('error_msg', 'User not found.');
        return res.redirect('/staff/users');
      }

      // Prevent disabling current logged in user
      if (user._id.toString() === req.session.user._id.toString()) {
        req.flash('error_msg', 'You cannot disable your own staff account.');
        return res.redirect('/staff/users');
      }

      user.accountStatus = user.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await user.save();

      req.flash('success_msg', `Account status for ${user.name} changed to ${user.accountStatus}.`);
      res.redirect('/staff/users');
    } catch (err) {
      console.error('Error toggling user status:', err);
      req.flash('error_msg', 'Failed to update user status.');
      res.redirect('/staff/users');
    }
  },

  // System Settings View (Configurable fine rate, max books, due period)
  getSettings: async (req, res) => {
    try {
      const config = await Setting.getConfig();
      res.render('staff/settings', {
        title: 'System Configuration & Library Rules',
        page: 'staff-settings',
        config
      });
    } catch (err) {
      console.error('Error loading settings:', err);
      req.flash('error_msg', 'Could not load settings.');
      res.redirect('/staff/dashboard');
    }
  },

  // Update Settings
  postSettings: async (req, res) => {
    try {
      const { maxBooksPerPatron, loanPeriodDays, fineRatePerDay, libraryName } = req.body;
      let config = await Setting.getConfig();

      config.maxBooksPerPatron = parseInt(maxBooksPerPatron) || 3;
      config.loanPeriodDays = parseInt(loanPeriodDays) || 14;
      config.fineRatePerDay = parseFloat(fineRatePerDay) || 5;
      if (libraryName) config.libraryName = libraryName.trim();

      await config.save();

      req.flash('success_msg', 'System settings and borrowing rules updated successfully.');
      res.redirect('/staff/settings');
    } catch (err) {
      console.error('Error updating settings:', err);
      req.flash('error_msg', 'Failed to update settings.');
      res.redirect('/staff/settings');
    }
  }
};
