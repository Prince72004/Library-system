const mongoose = require('mongoose');

const BookCopySchema = new mongoose.Schema({
  copyId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  copyNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ISSUED', 'MAINTENANCE', 'LOST', 'DAMAGED'],
    default: 'AVAILABLE'
  },
  shelfLocation: {
    type: String,
    default: 'Main Stack'
  },
  currentCirculationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circulation',
    default: null
  },
  conditionNotes: {
    type: String,
    default: 'Good'
  }
}, { timestamps: true });

BookCopySchema.index({ bookId: 1, status: 1 });

module.exports = mongoose.model('BookCopy', BookCopySchema);
