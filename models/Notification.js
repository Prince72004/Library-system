const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  notificationId: {
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
  type: {
    type: String,
    enum: ['DUE_REMINDER', 'OVERDUE', 'REQUEST_STATUS', 'CIRCULATION', 'GENERAL'],
    default: 'GENERAL'
  },
  title: {
    type: String,
    default: 'Library Notification'
  },
  message: {
    type: String,
    required: true
  },
  link: {
    type: String,
    default: '#'
  },
  status: {
    type: String,
    enum: ['UNREAD', 'READ'],
    default: 'UNREAD'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

NotificationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
