const User = require('../models/User');

module.exports = {
  // Render login page
  getLogin: (req, res) => {
    res.render('auth/login', {
      title: 'Login - Library Issue & Service Request System',
      page: 'login'
    });
  },

  // Process login
  postLogin: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        req.flash('error_msg', 'Please fill in both email and password.');
        return res.redirect('/auth/login');
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        req.flash('error_msg', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      if (user.accountStatus !== 'ACTIVE') {
        req.flash('error_msg', 'Your account is inactive or suspended. Please contact library staff.');
        return res.redirect('/auth/login');
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        req.flash('error_msg', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      // Save user session
      req.session.user = {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        enrollmentNo: user.enrollmentNo
      };

      req.flash('success_msg', `Welcome back, ${user.name}!`);

      if (user.role === 'STAFF') {
        return res.redirect('/staff/dashboard');
      } else {
        return res.redirect('/patron/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error_msg', 'An error occurred during login. Please try again.');
      res.redirect('/auth/login');
    }
  },

  // Render register page
  getRegister: (req, res) => {
    res.render('auth/register', {
      title: 'Patron Registration - Library System',
      page: 'register'
    });
  },

  // Process register
  postRegister: async (req, res) => {
    try {
      const { name, email, password, confirmPassword, department, enrollmentNo, phone } = req.body;

      if (!name || !email || !password || !confirmPassword) {
        req.flash('error_msg', 'Please fill in all required fields.');
        return res.redirect('/auth/register');
      }

      if (password !== confirmPassword) {
        req.flash('error_msg', 'Passwords do not match.');
        return res.redirect('/auth/register');
      }

      if (password.length < 6) {
        req.flash('error_msg', 'Password must be at least 6 characters.');
        return res.redirect('/auth/register');
      }

      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        req.flash('error_msg', 'An account with that email already exists.');
        return res.redirect('/auth/register');
      }

      // Generate unique User ID e.g. PAT-2026-XXXX
      const count = await User.countDocuments({ role: 'PATRON' });
      const userId = `PAT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const newUser = new User({
        userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: 'PATRON',
        department: department ? department.trim() : 'Computer Science',
        enrollmentNo: enrollmentNo ? enrollmentNo.trim() : '',
        phone: phone ? phone.trim() : '',
        accountStatus: 'ACTIVE'
      });

      await newUser.save();

      req.flash('success_msg', 'Registration successful! You can now log in with your credentials.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error('Registration error:', err);
      req.flash('error_msg', 'An error occurred during registration.');
      res.redirect('/auth/register');
    }
  },

  // Logout
  getLogout: (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error('Logout session destroy error:', err);
      res.redirect('/auth/login');
    });
  }
};
