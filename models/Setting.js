const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default_config'
  },
  maxBooksPerPatron: {
    type: Number,
    default: 3
  },
  loanPeriodDays: {
    type: Number,
    default: 14
  },
  fineRatePerDay: {
    type: Number,
    default: 5
  },
  libraryName: {
    type: String,
    default: 'Department of Computer Science Library, AMU'
  }
}, { timestamps: true });

// Static helper to get system settings
SettingSchema.statics.getConfig = async function() {
  let config = await this.findOne({ key: 'default_config' });
  if (!config) {
    config = await this.create({
      key: 'default_config',
      maxBooksPerPatron: parseInt(process.env.MAX_BOOKS_PER_PATRON) || 3,
      loanPeriodDays: parseInt(process.env.LOAN_PERIOD_DAYS) || 14,
      fineRatePerDay: parseInt(process.env.FINE_RATE_PER_DAY) || 5,
      libraryName: 'Department of Computer Science Library, AMU'
    });
  }
  return config;
};

module.exports = mongoose.model('Setting', SettingSchema);
