require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./utils/errorHandler');
const { scheduleAutoFeedDeduction } = require('./utils/cron');

const authRoutes = require('./routes/authRoutes');
const feedIngredientRoutes = require('./routes/feedIngredientRoutes');
const feedBatchRoutes = require('./routes/feedBatchRoutes');
const flockRoutes = require('./routes/flockRoutes');
const eggLogRoutes = require('./routes/eggLogRoutes');
const dailyEggStockRoutes = require('./routes/dailyEggStockRoutes');
const feedingLogRoutes = require('./routes/feedingLogRoutes');
const manureLogRoutes = require('./routes/manureLogRoutes');
const birdSaleRoutes = require('./routes/birdSaleRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const userRoutes = require('./routes/userRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/feed-ingredients', feedIngredientRoutes);
app.use('/api/feed-batches', feedBatchRoutes);
app.use('/api/flock', flockRoutes);
app.use('/api/egg-logs', eggLogRoutes);
app.use('/api/daily-egg-stock', dailyEggStockRoutes);
app.use('/api/feeding-logs', feedingLogRoutes);
app.use('/api/manure-logs', manureLogRoutes);
app.use('/api/bird-sales', birdSaleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Poultry production server running on port ${PORT}`);
  scheduleAutoFeedDeduction();
});