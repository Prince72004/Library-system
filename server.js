require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const morgan = require('morgan');

const connectDB = require('./config/db');
const loadNotifications = require('./middleware/notifications');

const app = express();

// Trust reverse proxy (Render / Cloudflare)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Body Parser & Form Data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// HTTP Request Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Set View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Session Setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'amu_library_mca_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Connect Flash
app.use(flash());

// Global Variables Middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// Notifications Middleware (auto-checks due dates for patrons)
app.use(loadNotifications);

// Routes
const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const patronRoutes = require('./routes/patronRoutes');
const staffRoutes = require('./routes/staffRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.get('/', (req, res) => {
  res.redirect('/catalog');
});

app.use('/auth', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/patron', patronRoutes);
app.use('/staff', staffRoutes);
app.use('/reports', reportRoutes);

// 404 Error Handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found',
    page: '404'
  });
});

// 500 Error Handler
app.use((err, req, res, next) => {
  console.error('Server Internal Error:', err);
  res.status(500).render('500', {
    title: '500 - Server Error',
    page: '500',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Library System running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
