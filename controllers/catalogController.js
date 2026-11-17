const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const ServiceRequest = require('../models/ServiceRequest');
const Circulation = require('../models/Circulation');

module.exports = {
  // Catalog listing with search & filters
  getCatalog: async (req, res) => {
    try {
      const { search, category, availability, sort = 'title', page = 1 } = req.query;
      const limit = 12;
      const currentPage = parseInt(page) || 1;
      const skip = (currentPage - 1) * limit;

      const query = {};

      if (search && search.trim() !== '') {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [
          { title: regex },
          { author: regex },
          { category: regex },
          { isbn: regex },
          { bookId: regex }
        ];
      }

      if (category && category !== 'All') {
        query.category = category;
      }

      if (availability === 'available') {
        query.availableCopies = { $gt: 0 };
      } else if (availability === 'unavailable') {
        query.availableCopies = { $lte: 0 };
      }

      let sortOption = { title: 1 };
      if (sort === 'author') sortOption = { author: 1 };
      if (sort === 'newest') sortOption = { createdAt: -1 };
      if (sort === 'copies') sortOption = { availableCopies: -1 };

      const totalBooks = await Book.countDocuments(query);
      const totalPages = Math.ceil(totalBooks / limit) || 1;

      const books = await Book.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

      // Get all categories for filter dropdown
      const categories = await Book.distinct('category');

      res.render('catalog/index', {
        title: 'Library Book Catalog - Search & Browse',
        page: 'catalog',
        books,
        categories,
        totalBooks,
        currentPage,
        totalPages,
        searchQuery: search || '',
        selectedCategory: category || 'All',
        selectedAvailability: availability || 'all',
        selectedSort: sort
      });
    } catch (err) {
      console.error('Error in getCatalog:', err);
      req.flash('error_msg', 'Could not load full catalog from database.');
      res.render('catalog/index', {
        title: 'Online Book Catalog - AMU CS Library',
        page: 'catalog',
        books: [],
        categories: [],
        searchQuery: search || '',
        selectedCategory: 'All',
        selectedAvailability: 'all',
        pagination: { totalPages: 1, currentPage: 1, totalBooks: 0 },
        selectedSort: sort || 'title'
      });
    }
  },

  // Single book detail view
  getBookDetails: async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error_msg', 'Book not found.');
        return res.redirect('/catalog');
      }

      let userActiveLoan = null;
      let userPendingReservation = null;

      if (req.session && req.session.user) {
        userActiveLoan = await Circulation.findOne({
          userId: req.session.user._id,
          bookId: book._id,
          status: { $in: ['ISSUED', 'OVERDUE'] },
          returnDate: null
        });

        userPendingReservation = await ServiceRequest.findOne({
          userId: req.session.user._id,
          bookId: book._id,
          type: 'RESERVATION',
          status: 'PENDING'
        });
      }

      // Fetch all individual physical copies with current circulation details
      const copies = await BookCopy.find({ bookId: book._id })
        .populate({
          path: 'currentCirculationId',
          populate: { path: 'userId', select: 'name email userId enrollmentNo' }
        })
        .sort({ copyNumber: 1 });

      res.render('catalog/detail', {
        title: `${book.title} - Book Details`,
        page: 'catalog',
        book,
        copies,
        userActiveLoan,
        userPendingReservation
      });
    } catch (err) {
      console.error('Error in getBookDetails:', err);
      req.flash('error_msg', 'Error retrieving book details.');
      res.redirect('/catalog');
    }
  }
};
