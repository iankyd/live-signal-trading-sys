# Live Signal Trading System - Setup Guide

## 🚀 Quick Start Guide

This guide will help you set up the Live Signal Trading System for Indian markets in under 30 minutes.

## 📋 Prerequisites

### System Requirements
- **Operating System**: macOS, Linux, or Windows 10+
- **Node.js**: Version 18.0 or higher
- **Memory**: 8GB RAM minimum, 16GB recommended
- **Storage**: 50GB free space
- **Network**: Stable internet connection (10Mbps+)

### Required Software
```bash
# Check versions
node --version  # Should be 18.0+
npm --version   # Should be 8.0+
git --version   # Any recent version
```

### Optional Tools
- **Docker & Docker Compose** (for containerized setup)
- **VS Code** with TypeScript extensions
- **Postman** for API testing

## 🛠️ Installation Steps

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/live-signal-trading-system.git
cd live-signal-trading-system
```

### Step 2: Install Dependencies
```bash
# Install dependencies for all applications
npm run install:all

# Alternative: Install manually for each app
cd apps/tradingview-integration && npm install
cd ../screener-integration && npm install
cd ../market-data-collector && npm install
cd ../signal-engine && npm install
cd ../breakout-analysis && npm install
cd ../../dashboard && npm install
```

### Step 3: Setup Database Services

#### Option A: Using Docker (Recommended)
```bash
# Start Redis and MongoDB
docker-compose up -d redis mongodb

# Verify services are running
docker-compose ps
```

#### Option B: Local Installation

**Install Redis:**
```bash
# macOS
brew install redis
redis-server

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://redis.io/docs/getting-started/installation/install-redis-on-windows/
```

**Install MongoDB:**
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Windows
# Download from https://www.mongodb.com/try/download/community
```

### Step 4: Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
```env
# Database Configuration
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/trading_system

# Server Ports
MARKET_DATA_PORT=3001
SIGNAL_ENGINE_PORT=3002
WEBSOCKET_PORT=3003
DASHBOARD_PORT=3000

# TradingView Configuration (Optional for demo)
TRADINGVIEW_USERNAME=your_username
TRADINGVIEW_PASSWORD=your_password

# Notification Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Development Mode
NODE_ENV=development
DEBUG=true
```

### Step 5: Build Applications
```bash
# Build all TypeScript applications
npm run build:all

# Alternative: Build individually
cd apps/market-data-collector && npm run build
cd ../tradingview-integration && npm run build
cd ../screener-integration && npm run build
cd ../signal-engine && npm run build
cd ../breakout-analysis && npm run build
```

### Step 6: Start Services
```bash
# Start all services with PM2 (recommended)
npm run start:all

# Alternative: Start each service manually in separate terminals
cd apps/market-data-collector && npm run dev
cd apps/tradingview-integration && npm run dev
cd apps/screener-integration && npm run dev
cd apps/signal-engine && npm run dev
cd apps/breakout-analysis && npm run dev

# Start the dashboard
cd dashboard && npm start
```

### Step 7: Verify Installation
```bash
# Check service health
curl http://localhost:3001/health  # Market Data Collector
curl http://localhost:3002/health  # Signal Engine

# Check WebSocket connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3003

# Access dashboard
open http://localhost:3000
```

## 🐳 Docker Setup (Alternative)

### Complete Docker Setup
```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Configuration
The `docker-compose.yml` includes:
- Redis for caching
- MongoDB for data persistence
- All microservices
- Nginx reverse proxy
- Dashboard application

## ⚙️ Configuration Options

### Market Data Configuration
Edit `config/market-data.json`:
```json
{
  "symbols": [
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
    "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK"
  ],
  "timeframes": ["1m", "5m", "15m", "1h", "1d"],
  "updateInterval": 5000,
  "enableVolumeAnalysis": true
}
```

### Signal Parameters
Edit `config/signals.json`:
```json
{
  "technical": {
    "rsi": { "period": 14, "oversold": 30, "overbought": 70 },
    "macd": { "fast": 12, "slow": 26, "signal": 9 },
    "bollinger": { "period": 20, "stdDev": 2 },
    "ema": { "periods": [20, 50, 200] }
  },
  "breakout": {
    "volumeThreshold": 1.5,
    "strengthMinimum": 5,
    "confirmationRequired": true
  },
  "fundamental": {
    "minMarketCap": 1000,
    "maxPE": 50,
    "minROE": 15,
    "maxDebtEquity": 1.0
  }
}
```

### Risk Management
Edit `config/risk.json`:
```json
{
  "position": {
    "maxSize": 100000,
    "maxPercentage": 5,
    "stopLossDefault": 0.05
  },
  "portfolio": {
    "maxDailyLoss": 50000,
    "maxDrawdown": 100000,
    "maxCorrelation": 0.7
  },
  "alerts": {
    "minConfidence": 60,
    "riskFilter": ["LOW", "MEDIUM"],
    "duplicateWindow": 300
  }
}
```

## 🔔 Notification Setup

### Email Notifications
1. **Gmail Setup:**
   ```bash
   # Enable 2-factor authentication
   # Generate app password
   # Use app password in SMTP_PASS
   ```

2. **Other Providers:**
   ```env
   # Outlook
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   
   # Yahoo
   SMTP_HOST=smtp.mail.yahoo.com
   SMTP_PORT=587
   ```

### Telegram Bot Setup
1. **Create Bot:**
   - Message @BotFather on Telegram
   - Send `/newbot` and follow instructions
   - Copy the bot token

2. **Get Chat ID:**
   ```bash
   # Send a message to your bot, then:
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   # Find your chat ID in the response
   ```

3. **Configuration:**
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_CHAT_ID=123456789
   ```

### SMS Setup (Twilio)
1. **Create Twilio Account:**
   - Sign up at https://www.twilio.com
   - Get Account SID and Auth Token
   - Purchase a phone number

2. **Configuration:**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

## 🧪 Testing the Setup

### Health Checks
```bash
# Run health check script
npm run health-check

# Manual checks
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
```

### Sample Data Test
```bash
# Generate test signals
npm run test:signals

# Simulate market data
npm run test:market-data

# Test notifications
npm run test:notifications
```

### Integration Tests
```bash
# Run full integration test suite
npm run test:integration

# Test specific components
npm run test:websocket
npm run test:signals
npm run test:data-flow
```

## 🎯 First Use Guide

### 1. Access Dashboard
Open http://localhost:3000 in your browser

### 2. Monitor Live Data
- View real-time price updates
- Check market status
- Monitor active signals

### 3. Configure Alerts
- Set notification preferences
- Configure signal filters
- Test alert delivery

### 4. Analyze Signals
- Review signal history
- Check confidence scores
- Analyze performance metrics

## 🐛 Troubleshooting

### Common Issues

**Services Won't Start:**
```bash
# Check port conflicts
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Kill conflicting processes
kill -9 <PID>

# Restart services
npm run restart:all
```

**Database Connection Issues:**
```bash
# Check Redis
redis-cli ping

# Check MongoDB
mongo --eval "db.stats()"

# Restart databases
docker-compose restart redis mongodb
```

**WebSocket Connection Failed:**
```bash
# Check WebSocket server
curl -i http://localhost:3003/health

# Check browser console for errors
# Verify CORS configuration
```

**No Market Data:**
```bash
# Check data collector logs
tail -f logs/market-data-collector.log

# Verify market hours (9:15 AM - 3:30 PM IST)
date -u

# Test data sources manually
curl http://localhost:3001/api/symbols
```

### Log Analysis
```bash
# View all logs
npm run logs

# View specific service logs
docker-compose logs market-data-collector
docker-compose logs signal-engine

# Follow logs in real-time
docker-compose logs -f
```

### Performance Issues
```bash
# Monitor resource usage
htop  # or top on macOS
docker stats

# Check database performance
mongo --eval "db.getProfilingStatus()"
redis-cli info stats
```

## 🔧 Development Mode

### Enable Debug Mode
```env
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

### Hot Reload Setup
```bash
# Start with hot reload
npm run dev:all

# Watch for changes
npm run watch:all
```

### Development Tools
```bash
# Code formatting
npm run format

# Linting
npm run lint

# Type checking
npm run type-check
```

## 📊 Monitoring Setup

### Logs Configuration
```javascript
// Winston configuration in each service
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console()
  ]
});
```

### Health Monitoring
```bash
# Set up monitoring endpoints
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health

# Monitor system metrics
npm run monitor
```

## 🚀 Production Deployment

### Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Database connections tested
- [ ] SSL certificates installed
- [ ] Monitoring tools configured
- [ ] Backup procedures implemented
- [ ] Load testing completed

### Deployment Commands
```bash
# Production build
npm run build:prod

# Start production services
npm run start:prod

# Monitor deployment
npm run monitor:prod
```

## 📞 Support

### Getting Help
- **Documentation**: Check `docs/` directory
- **Issues**: GitHub Issues for bug reports
- **Community**: Join our Discord/Telegram community

### Reporting Issues
Include the following information:
- Operating system and version
- Node.js and npm versions
- Error logs from relevant services
- Steps to reproduce the issue

### Performance Optimization
- Monitor resource usage
- Optimize database queries
- Configure caching appropriately
- Scale services based on load

---

**✅ Setup Complete!** 

Your Live Signal Trading System should now be running and ready for use. Access the dashboard at http://localhost:3000 to start monitoring live market signals.

**⚠️ Important**: This system is for educational purposes. Always verify signals and conduct your own analysis before making trading decisions.
