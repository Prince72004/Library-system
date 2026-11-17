const Notification = require('../models/Notification');
const Circulation = require('../models/Circulation');
const Setting = require('../models/Setting');

// Middleware to populate unread notification count & list in res.locals
const loadNotifications = async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const userId = req.session.user._id;

      // If user is a patron, check if they have upcoming due dates (< 3 days) or overdue books
      if (req.session.user.role === 'PATRON') {
        const activeCirculations = await Circulation.find({
          userId,
          status: { $in: ['ISSUED', 'OVERDUE'] },
          returnDate: null
        }).populate('bookId');

        const now = new Date();
        for (const circ of activeCirculations) {
          if (!circ.bookId) continue;

          // Check if overdue
          if (now > circ.dueDate) {
            if (circ.status !== 'OVERDUE') {
              circ.status = 'OVERDUE';
              await circ.save();
            }

            // Create notification if not already notified in the last 24 hours
            const existingNotif = await Notification.findOne({
              userId,
              type: 'OVERDUE',
              message: { $regex: circ.bookId.title }
            });

            if (!existingNotif) {
              await Notification.create({
                notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                userId,
                type: 'OVERDUE',
                title: 'Book Overdue Alert!',
                message: `The book "${circ.bookId.title}" is overdue since ${circ.dueDate.toLocaleDateString()}. Please return it to avoid additional fines.`,
                link: '/patron/my-books'
              });
            }
          } else {
            // Check if due in <= 3 days
            const daysLeft = Math.ceil((circ.dueDate - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3 && daysLeft >= 0) {
              const existingReminder = await Notification.findOne({
                userId,
                type: 'DUE_REMINDER',
                message: { $regex: circ.bookId.title }
              });

              if (!existingReminder) {
                await Notification.create({
                  notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  userId,
                  type: 'DUE_REMINDER',
                  title: 'Upcoming Due Date Reminder',
                  message: `The book "${circ.bookId.title}" is due in ${daysLeft === 0 ? 'today' : daysLeft + ' day(s)'} on ${circ.dueDate.toLocaleDateString()}.`,
                  link: '/patron/my-books'
                });
              }
            }
          }
        }
      }

      // Fetch unread count & recent notifications
      const unreadCount = await Notification.countDocuments({
        userId,
        status: 'UNREAD'
      });
      const recentNotifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5);

      res.locals.unreadCount = unreadCount;
      res.locals.recentNotifications = recentNotifications;
    } catch (err) {
      console.error('Error in loadNotifications middleware:', err);
      res.locals.unreadCount = 0;
      res.locals.recentNotifications = [];
    }
  } else {
    res.locals.unreadCount = 0;
    res.locals.recentNotifications = [];
  }
  next();
};

module.exports = loadNotifications;
