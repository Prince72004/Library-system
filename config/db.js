const mongoose = require('mongoose');
const dns = require('dns');

// Only set custom DNS on Windows (fixes Windows-specific SRV lookup issues)
if (process.platform === 'win32') {
  try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library_system';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Connection Error]: ${error.message}`);
  }
};

module.exports = connectDB;
