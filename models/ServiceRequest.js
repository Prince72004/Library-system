const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema({
  requestId: {
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
    default: null
  },
  circulationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circulation',
    default: null
  },
  copyCode: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['RESERVATION', 'RENEWAL', 'COMPLAINT', 'SUGGESTION'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'],
    default: 'PENDING'
  },
  details: {
    type: String,
    required: [true, 'Details are required']
  },
  suggestedTitle: {
    type: String
  },
  suggestedAuthor: {
    type: String
  },
  staffRemarks: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

ServiceRequestSchema.index({ userId: 1, status: 1 });
ServiceRequestSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
