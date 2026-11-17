const mongoose = require('mongoose');

const CirculationSchema = new mongoose.Schema({
  circulationId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  copyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookCopy'
  },
  copyCode: {
    type: String,
    trim: true
  },
  issueDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: {
    type: Date,
    default: null
  },
  fine: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ISSUED', 'RETURNED', 'OVERDUE'],
    default: 'ISSUED'
  },
  renewalCount: {
    type: Number,
    default: 0
  },
  remarks: {
    type: String
  }
}, { timestamps: true });

// Helper to check if record is overdue
CirculationSchema.methods.isOverdue = function() {
  if (this.returnDate) {
    return this.returnDate > this.dueDate;
  }
  return new Date() > this.dueDate;
};

// Helper to calculate overdue fine based on fine rate
CirculationSchema.methods.calculateFine = function(ratePerDay = 5) {
  const endDate = this.returnDate ? new Date(this.returnDate) : new Date();
  const due = new Date(this.dueDate);
  if (endDate > due) {
    const diffMs = endDate - due;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays * ratePerDay;
  }
  return 0;
};

CirculationSchema.index({ userId: 1, status: 1 });
CirculationSchema.index({ bookId: 1 });
CirculationSchema.index({ copyId: 1 });
CirculationSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Circulation', CirculationSchema);
