require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const channelRoutes = require('./routes/channels');
const videoRoutes = require('./routes/videos');
const refreshRoutes = require('./routes/refresh');
const settingsRoutes = require('./routes/settings');
const { collectAll, collectYouTube, collectTikTok } = require('./cron/collector');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.status(200).send('API działa git!');
});

// Routes
app.use('/api/channels', channelRoutes);
app.use('/api/channels', videoRoutes);
app.use('/api', refreshRoutes);
app.use('/api', settingsRoutes);

// Schedule YouTube collection every hour (0 * * * *)
cron.schedule('0 * * * *', () => {
  console.log(`[cron] Hourly YouTube collection triggered at ${new Date().toISOString()}`);
  collectYouTube();
});

// Schedule TikTok collection every 6 hours (0 */6 * * *)
cron.schedule('0 */6 * * *', () => {
  console.log(`[cron] 6-hourly TikTok collection triggered at ${new Date().toISOString()}`);
  collectTikTok();
});

// Delayed initial collection — wait 5s for frontend to sync API keys via POST /api/settings
setTimeout(() => {
  console.log('[cron] Running initial collection (after 5s delay for key sync)...');
  collectAll();
}, 5000);

// Start server
app.listen(PORT, () => {
  console.log(`[server] Backend running on http://localhost:${PORT}`);
});
