const Circulation = require('../models/Circulation');
const ServiceRequest = require('../models/ServiceRequest');
const Fine = require('../models/Fine');
const Book = require('../models/Book');
const Setting = require('../models/Setting');

// Helper to convert array of objects to CSV string
function convertToCSV(data, fields) {
  if (!data || data.length === 0) return '';
  const header = fields.map(f => `"${f.label}"`).join(',');
  const rows = data.map(item => {
    return fields.map(f => {
      let val = item;
      for (const key of f.key.split('.')) {
        val = val ? val[key] : '';
      }
      if (val instanceof Date) {
        val = val.toLocaleDateString();
      }
      val = val === null || val === undefined ? '' : String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [header, ...rows].join('\r\n');
}

module.exports = {
  // Reports Dashboard (FR-010)
  getReportsDashboard: async (req, res) => {
    try {
      const now = new Date();
      const config = await Setting.getConfig();

      // Counts
      const totalIssuedActive = await Circulation.countDocuments({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      });

      const totalOverdueActive = await Circulation.countDocuments({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        dueDate: { $lt: now },
        returnDate: null
      });

      const totalFinesAgg = await Fine.aggregate([
        { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]);

      const requestsByTypeAgg = await ServiceRequest.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);

      const requestsByStatusAgg = await ServiceRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      res.render('reports/index', {
        title: 'Library Operational Reports & Analytics (FR-010)',
        page: 'reports',
        totalIssuedActive,
        totalOverdueActive,
        totalFinesAgg: JSON.stringify(totalFinesAgg),
        requestsByTypeAgg: JSON.stringify(requestsByTypeAgg),
        requestsByStatusAgg: JSON.stringify(requestsByStatusAgg),
        config
      });
    } catch (err) {
      console.error('Error in getReportsDashboard:', err);
      req.flash('error_msg', 'Failed to load reports dashboard.');
      res.redirect('/staff/dashboard');
    }
  },

  // Issued Books Report
  getIssuedReport: async (req, res) => {
    try {
      const { format } = req.query;
      const issues = await Circulation.find({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        returnDate: null
      })
        .populate('userId')
        .populate('bookId')
        .sort({ issueDate: -1 });

      if (format === 'csv') {
        const fields = [
          { label: 'Circulation ID', key: 'circulationId' },
          { label: 'Copy ID', key: 'copyCode' },
          { label: 'Patron Name', key: 'userId.name' },
          { label: 'Patron Email', key: 'userId.email' },
          { label: 'Enrollment No', key: 'userId.enrollmentNo' },
          { label: 'Book ID', key: 'bookId.bookId' },
          { label: 'Book Title', key: 'bookId.title' },
          { label: 'Issue Date', key: 'issueDate' },
          { label: 'Due Date', key: 'dueDate' },
          { label: 'Status', key: 'status' }
        ];
        const csv = convertToCSV(issues, fields);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="issued_books_report.csv"');
        return res.send(csv);
      }

      res.render('reports/circulation', {
        title: 'Active Issued Books Report',
        page: 'reports',
        issues
      });
    } catch (err) {
      console.error('Error in getIssuedReport:', err);
      req.flash('error_msg', 'Failed to generate issued books report.');
      res.redirect('/reports');
    }
  },

  // Overdue Books Report (with computed overdue days and fines)
  getOverdueReport: async (req, res) => {
    try {
      const { format } = req.query;
      const config = await Setting.getConfig();
      const now = new Date();

      const overdueLoans = await Circulation.find({
        status: { $in: ['ISSUED', 'OVERDUE'] },
        dueDate: { $lt: now },
        returnDate: null
      })
        .populate('userId')
        .populate('bookId')
        .sort({ dueDate: 1 });

      const enriched = overdueLoans.map(c => {
        const item = c.toObject();
        const diffMs = now - new Date(item.dueDate);
        const daysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        item.daysOverdue = daysLate;
        item.calculatedFine = daysLate * config.fineRatePerDay;
        return item;
      });

      if (format === 'csv') {
        const fields = [
          { label: 'Circulation ID', key: 'circulationId' },
          { label: 'Copy ID', key: 'copyCode' },
          { label: 'Patron Name', key: 'userId.name' },
          { label: 'Patron Email', key: 'userId.email' },
          { label: 'Phone', key: 'userId.phone' },
          { label: 'Book Title', key: 'bookId.title' },
          { label: 'Due Date', key: 'dueDate' },
          { label: 'Days Overdue', key: 'daysOverdue' },
          { label: 'Calculated Fine (Rs)', key: 'calculatedFine' }
        ];
        const csv = convertToCSV(enriched, fields);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="overdue_books_report.csv"');
        return res.send(csv);
      }

      const totalAccumulatedFine = enriched.reduce((sum, item) => sum + item.calculatedFine, 0);

      res.render('reports/overdue', {
        title: 'Overdue Books & Fines Report',
        page: 'reports',
        overdueLoans: enriched,
        totalAccumulatedFine,
        config
      });
    } catch (err) {
      console.error('Error in getOverdueReport:', err);
      req.flash('error_msg', 'Failed to generate overdue report.');
      res.redirect('/reports');
    }
  },

  // Fine Collections Report
  getFinesReport: async (req, res) => {
    try {
      const { format, status } = req.query;
      const filter = {};
      if (status && status !== 'ALL') filter.status = status;

      const fines = await Fine.find(filter)
        .populate('userId')
        .populate({
          path: 'circulationId',
          populate: { path: 'bookId' }
        })
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const fields = [
          { label: 'Fine ID', key: 'fineId' },
          { label: 'Patron Name', key: 'userId.name' },
          { label: 'Patron Email', key: 'userId.email' },
          { label: 'Book Title', key: 'circulationId.bookId.title' },
          { label: 'Amount (Rs)', key: 'amount' },
          { label: 'Reason', key: 'reason' },
          { label: 'Status', key: 'status' },
          { label: 'Date Assessed', key: 'createdAt' },
          { label: 'Date Paid', key: 'paidAt' }
        ];
        const csv = convertToCSV(fines, fields);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="fines_collection_report.csv"');
        return res.send(csv);
      }

      const totalPending = fines.filter(f => f.status === 'PENDING').reduce((s, f) => s + f.amount, 0);
      const totalPaid = fines.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0);
      const totalWaived = fines.filter(f => f.status === 'WAIVED').reduce((s, f) => s + f.amount, 0);

      res.render('reports/fines', {
        title: 'Fine Collections & Settlement Report',
        page: 'reports',
        fines,
        selectedStatus: status || 'ALL',
        totalPending,
        totalPaid,
        totalWaived
      });
    } catch (err) {
      console.error('Error in getFinesReport:', err);
      req.flash('error_msg', 'Failed to generate fines report.');
      res.redirect('/reports');
    }
  },

  // Service Request Statistics Report
  getRequestsReport: async (req, res) => {
    try {
      const { format } = req.query;
      const requests = await ServiceRequest.find()
        .populate('userId')
        .populate('bookId')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const fields = [
          { label: 'Request ID', key: 'requestId' },
          { label: 'Patron Name', key: 'userId.name' },
          { label: 'Request Type', key: 'type' },
          { label: 'Book Title / Suggestion', key: 'bookId.title' },
          { label: 'Status', key: 'status' },
          { label: 'Submitted Date', key: 'submittedAt' },
          { label: 'Staff Remarks', key: 'staffRemarks' }
        ];
        const csv = convertToCSV(requests, fields);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="service_requests_report.csv"');
        return res.send(csv);
      }

      const totalCount = requests.length;
      const pendingCount = requests.filter(r => r.status === 'PENDING').length;
      const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
      const resolvedCount = requests.filter(r => r.status === 'RESOLVED').length;
      const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

      res.render('reports/requests', {
        title: 'Service Request Statistics Report',
        page: 'reports',
        requests,
        totalCount,
        pendingCount,
        approvedCount,
        resolvedCount,
        rejectedCount
      });
    } catch (err) {
      console.error('Error in getRequestsReport:', err);
      req.flash('error_msg', 'Failed to generate request statistics report.');
      res.redirect('/reports');
    }
  }
};
