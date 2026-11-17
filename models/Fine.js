const mongoose = require('mongoose');

const FineSchema = new mongoose.Schema({
  fineId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  circulationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circulation',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'WAIVED'],
    default: 'PENDING'
  },
  paidAt: {
    type: Date,
    default: null
  },
  remarks: {
    type: String
  }
}, { timestamps: true });

FineSchema.index({ userId: 1, status: 1 });
FineSchema.index({ circulationId: 1 });

module.exports = mongoose.model('Fine', FineSchema);
