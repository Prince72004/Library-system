const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  bookId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Book title is required'],
    trim: true
  },
  author: {
    type: String,
    required: [true, 'Author name is required'],
    trim: true
  },
  category: {
    type: String,
    default: 'General'
  },
  isbn: {
    type: String,
    trim: true
  },
  publisher: {
    type: String,
    trim: true
  },
  edition: {
    type: String,
    trim: true
  },
  coverImage: {
    type: String,
    trim: true,
    default: ''
  },
  shelfLocation: {
    type: String,
    default: 'Main Stack'
  },
  totalCopies: {
    type: Number,
    default: 1,
    min: 1
  },
  availableCopies: {
    type: Number,
    default: 1,
    min: 0
  },
  availability: {
    type: Boolean,
    default: true
  },
  description: {
    type: String
  }
}, { timestamps: true });

// Auto-sync availability boolean before saving
BookSchema.pre('save', function(next) {
  this.availability = this.availableCopies > 0;
  next();
});

// Indexes for fast searching (SRS requirement 2.3 & 2.2)
BookSchema.index({ title: 'text', author: 'text', category: 'text' });
BookSchema.index({ category: 1 });
BookSchema.index({ availability: 1 });

module.exports = mongoose.model('Book', BookSchema);
