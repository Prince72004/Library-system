module.exports = {
  // Ensure user is authenticated
  ensureAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      return next();
    }
    req.flash('error_msg', 'Please log in to access this resource.');
    res.redirect('/auth/login');
  },

  // Ensure user has specific role
  ensureRole: (roles) => {
    return (req, res, next) => {
      if (!req.session || !req.session.user) {
        req.flash('error_msg', 'Please log in first.');
        return res.redirect('/auth/login');
      }

      const userRole = req.session.user.role;
      if (Array.isArray(roles) ? roles.includes(userRole) : userRole === roles) {
        return next();
      }

      req.flash('error_msg', 'Access denied. You do not have permission for this section.');
      if (userRole === 'STAFF') {
        return res.redirect('/staff/dashboard');
      } else {
        return res.redirect('/patron/dashboard');
      }
    };
  },

  // Forward authenticated user away from login/register
  forwardAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      if (req.session.user.role === 'STAFF') {
        return res.redirect('/staff/dashboard');
      }
      return res.redirect('/patron/dashboard');
    }
    next();
  }
};
