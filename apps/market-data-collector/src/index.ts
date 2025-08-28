import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import WebSocket from 'ws';
import * as cron from 'node-cron';
import { createClient } from 'redis';
import winston from 'winston';
import mongoose from 'mongoose';
import { 
    StockData, 
    CandlestickData, 
    WebSocketMessage,
    PriceUpdate,
    MarketSentiment,
    SectorAnalysis
} from '../../shared/types';
import { 
    logMessage, 
    logError, 
    isMarketOpen, 
    validateSymbol,
    sanitizeSymbol,
    formatCurrency,
    getMarketTime
} from '../../shared/utils';

// Load environment variables
dotenv.config();

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'market-data-collector' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// MongoDB Schema for storing market data
const StockDataSchema = new mongoose.Schema({
    symbol: { type: String, required: true, index: true },
    exchange: { type: String, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
    prevClose: { type: Number },
    change: { type: Number },
    changePercent: { type: Number },
    vwap: { type: Number },
    marketCap: { type: Number }
});

const CandleDataSchema = new mongoose.Schema({
    symbol: { type: String, required: true, index: true },
    timeframe: { type: String, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
    exchange: { type: String, required: true },
    prevClose: { type: Number },
    change: { type: Number },
    changePercent: { type: Number }
});

const StockDataModel = mongoose.model('StockData', StockDataSchema);
const CandleDataModel = mongoose.model('CandleData', CandleDataSchema);

interface DataProvider {
    name: string;
    connect(): Promise<void>;
    subscribe(symbols: string[]): Promise<void>;
    disconnect(): Promise<void>;
}

class NSEDataProvider implements DataProvider {
    name = 'NSE';
    private websocket: WebSocket | null = null;
    private isConnected = false;

    async connect(): Promise<void> {
        try {
            // This is a simulation - NSE doesn't provide direct WebSocket API
            logger.info('NSE Data Provider connected (simulated)');
            this.isConnected = true;
        } catch (error) {
            logError(error as Error, 'Failed to connect to NSE data provider');
            throw error;
        }
    }

    async subscribe(symbols: string[]): Promise<void> {
        // Simulate subscription
        logger.info(`NSE: Subscribed to ${symbols.length} symbols`);
    }

    async disconnect(): Promise<void> {
        if (this.websocket) {
            this.websocket.close();
        }
        this.isConnected = false;
        logger.info('NSE Data Provider disconnected');
    }
}

class YahooFinanceProvider implements DataProvider {
    name = 'Yahoo Finance';
    private isConnected = false;

    async connect(): Promise<void> {
        try {
            logger.info('Yahoo Finance Provider connected');
            this.isConnected = true;
        } catch (error) {
            logError(error as Error, 'Failed to connect to Yahoo Finance provider');
            throw error;
        }
    }

    async subscribe(symbols: string[]): Promise<void> {
        logger.info(`Yahoo Finance: Subscribed to ${symbols.length} symbols`);
    }

    async disconnect(): Promise<void> {
        this.isConnected = false;
        logger.info('Yahoo Finance Provider disconnected');
    }
}

class MarketDataCollector {
    private redisClient: any;
    private mongoConnection: any;
    private socketServer: SocketIOServer;
    private httpServer: any;
    private dataProviders: DataProvider[] = [];
    private watchedSymbols: Set<string> = new Set();
    private priceCache: Map<string, StockData> = new Map();
    private candleCache: Map<string, CandlestickData[]> = new Map();
    private isInitialized = false;

    // Indian market symbols
    private defaultSymbols = [
        'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
        'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
        'LT', 'ASIANPAINT', 'MARUTI', 'TITAN', 'NESTLEIND',
        'BAJFINANCE', 'HCLTECH', 'WIPRO', 'ULTRACEMCO', 'POWERGRID',
        'ADANIPORTS', 'AXISBANK', 'COALINDIA', 'DRREDDY', 'EICHERMOT',
        'GRASIM', 'HEROMOTOCO', 'JSWSTEEL', 'M&M', 'NTPC',
        'ONGC', 'SHREECEM', 'SUNPHARMA', 'TATAMOTORS', 'TATASTEEL',
        'TECHM', 'UPL', 'VEDL', 'BPCL', 'CIPLA'
    ];

    constructor() {
        this.initializeHttpServer();
        this.initializeRedis();
        this.initializeMongoDB();
        this.initializeDataProviders();
        this.setupScheduledTasks();
        
        // Add default symbols
        this.defaultSymbols.forEach(symbol => {
            if (validateSymbol(symbol)) {
                this.watchedSymbols.add(symbol);
            }
        });
    }

    private initializeHttpServer(): void {
        this.httpServer = createServer();
        this.socketServer = new SocketIOServer(this.httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });

        this.socketServer.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            socket.on('subscribe', (symbols: string[]) => {
                this.handleClientSubscription(socket, symbols);
            });

            socket.on('unsubscribe', (symbols: string[]) => {
                this.handleClientUnsubscription(socket, symbols);
            });

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    private async initializeRedis(): Promise<void> {
        try {
            this.redisClient = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });
            
            this.redisClient.on('error', (err: Error) => {
                logError(err, 'Redis connection error');
            });

            await this.redisClient.connect();
            logger.info('Redis client connected successfully');
        } catch (error) {
            logError(error as Error, 'Failed to initialize Redis');
        }
    }

    private async initializeMongoDB(): Promise<void> {
        try {
            const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/trading_system';
            this.mongoConnection = await mongoose.connect(mongoUrl);
            logger.info('MongoDB connected successfully');
        } catch (error) {
            logError(error as Error, 'Failed to initialize MongoDB');
        }
    }

    private initializeDataProviders(): void {
        this.dataProviders = [
            new NSEDataProvider(),
            new YahooFinanceProvider()
        ];
    }

    private setupScheduledTasks(): void {
        // Simulate price updates every 5 seconds during market hours
        cron.schedule('*/5 * * * * *', async () => {
            if (isMarketOpen()) {
                await this.simulatePriceUpdates();
            }
        });

        // Generate candle data every minute
        cron.schedule('* * * * *', async () => {
            if (isMarketOpen()) {
                await this.generateCandleData();
            }
        });

        // Save data to MongoDB every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            await this.persistData();
        });

        // Market open initialization
        cron.schedule('15 9 * * 1-5', async () => {
            await this.onMarketOpen();
        });

        // Market close cleanup
        cron.schedule('30 15 * * 1-5', async () => {
            await this.onMarketClose();
        });
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Market Data Collector...');

            // Connect all data providers
            await Promise.allSettled(
                this.dataProviders.map(provider => provider.connect())
            );

            // Subscribe to symbols
            await Promise.allSettled(
                this.dataProviders.map(provider => 
                    provider.subscribe(Array.from(this.watchedSymbols))
                )
            );

            // Start HTTP server
            const port = process.env.MARKET_DATA_PORT || 3001;
            this.httpServer.listen(port, () => {
                logger.info(`Market Data Collector server running on port ${port}`);
            });

            this.isInitialized = true;
            logger.info('Market Data Collector initialized successfully');
        } catch (error) {
            logError(error as Error, 'Failed to initialize Market Data Collector');
            throw error;
        }
    }

    private async simulatePriceUpdates(): Promise<void> {
        try {
            const updates: PriceUpdate[] = [];

            for (const symbol of this.watchedSymbols) {
                const lastPrice = this.priceCache.get(symbol)?.close || Math.random() * 1000 + 500;
                const change = (Math.random() - 0.5) * 20; // Random change between -10 and +10
                const newPrice = Math.max(lastPrice + change, 1); // Ensure price doesn't go below 1
                const volume = Math.floor(Math.random() * 100000) + 10000;

                const stockData: StockData = {
                    symbol,
                    exchange: 'NSE',
                    open: lastPrice,
                    high: Math.max(lastPrice, newPrice),
                    low: Math.min(lastPrice, newPrice),
                    close: newPrice,
                    volume,
                    timestamp: getMarketTime(),
                    prevClose: lastPrice,
                    change: newPrice - lastPrice,
                    changePercent: lastPrice > 0 ? ((newPrice - lastPrice) / lastPrice) * 100 : 0
                };

                this.priceCache.set(symbol, stockData);

                const priceUpdate: PriceUpdate = {
                    symbol,
                    price: newPrice,
                    change: newPrice - lastPrice,
                    volume,
                    timestamp: getMarketTime()
                };

                updates.push(priceUpdate);

                // Cache in Redis
                await this.cachePriceData(stockData);
            }

            // Broadcast to all connected clients
            this.broadcastPriceUpdates(updates);

        } catch (error) {
            logError(error as Error, 'Failed to simulate price updates');
        }
    }

    private async generateCandleData(): Promise<void> {
        try {
            const timeframes = ['1m', '5m', '15m', '1h'];
            
            for (const symbol of this.watchedSymbols) {
                const currentData = this.priceCache.get(symbol);
                if (!currentData) continue;

                for (const timeframe of timeframes) {
                    const candleData: CandlestickData = {
                        ...currentData,
                        timeframe: timeframe as any
                    };

                    // Update candle cache
                    const cacheKey = `${symbol}:${timeframe}`;
                    if (!this.candleCache.has(cacheKey)) {
                        this.candleCache.set(cacheKey, []);
                    }

                    const candles = this.candleCache.get(cacheKey)!;
                    candles.push(candleData);

                    // Keep only last 200 candles
                    if (candles.length > 200) {
                        candles.shift();
                    }

                    // Cache in Redis
                    await this.cacheCandleData(symbol, timeframe, candles);
                }
            }
        } catch (error) {
            logError(error as Error, 'Failed to generate candle data');
        }
    }

    private async cachePriceData(stockData: StockData): Promise<void> {
        try {
            if (!this.redisClient) return;

            await this.redisClient.setEx(
                `price:${stockData.symbol}`,
                300, // 5 minutes TTL
                JSON.stringify(stockData)
            );

            // Also add to price history
            await this.redisClient.lPush(
                `price_history:${stockData.symbol}`,
                JSON.stringify({
                    price: stockData.close,
                    volume: stockData.volume,
                    timestamp: stockData.timestamp
                })
            );

            // Keep only last 1000 price points
            await this.redisClient.lTrim(`price_history:${stockData.symbol}`, 0, 999);

        } catch (error) {
            logError(error as Error, 'Failed to cache price data');
        }
    }

    private async cacheCandleData(symbol: string, timeframe: string, candles: CandlestickData[]): Promise<void> {
        try {
            if (!this.redisClient) return;

            await this.redisClient.setEx(
                `candles:${symbol}:${timeframe}`,
                3600, // 1 hour TTL
                JSON.stringify(candles)
            );
        } catch (error) {
            logError(error as Error, 'Failed to cache candle data');
        }
    }

    private broadcastPriceUpdates(updates: PriceUpdate[]): void {
        const message: WebSocketMessage = {
            type: 'PRICE_UPDATE',
            data: updates,
            timestamp: getMarketTime()
        };

        this.socketServer.emit('price_updates', message);
    }

    private handleClientSubscription(socket: any, symbols: string[]): void {
        const validSymbols = symbols.filter(validateSymbol);
        
        validSymbols.forEach(symbol => {
            const cleanSymbol = sanitizeSymbol(symbol);
            socket.join(`symbol:${cleanSymbol}`);
            
            // Send current price if available
            const currentData = this.priceCache.get(cleanSymbol);
            if (currentData) {
                socket.emit('price_update', {
                    type: 'PRICE_UPDATE',
                    data: currentData,
                    timestamp: getMarketTime()
                });
            }
        });

        logger.info(`Client ${socket.id} subscribed to ${validSymbols.length} symbols`);
    }

    private handleClientUnsubscription(socket: any, symbols: string[]): void {
        symbols.forEach(symbol => {
            const cleanSymbol = sanitizeSymbol(symbol);
            socket.leave(`symbol:${cleanSymbol}`);
        });

        logger.info(`Client ${socket.id} unsubscribed from ${symbols.length} symbols`);
    }

    private async persistData(): Promise<void> {
        try {
            const stockDataToSave: any[] = [];
            const candleDataToSave: any[] = [];

            // Prepare stock data for saving
            for (const [symbol, stockData] of this.priceCache) {
                stockDataToSave.push(new StockDataModel(stockData));
            }

            // Prepare candle data for saving
            for (const [cacheKey, candles] of this.candleCache) {
                const [symbol, timeframe] = cacheKey.split(':');
                const latestCandle = candles[candles.length - 1];
                if (latestCandle) {
                    candleDataToSave.push(new CandleDataModel({
                        ...latestCandle,
                        symbol,
                        timeframe
                    }));
                }
            }

            // Save to MongoDB
            if (stockDataToSave.length > 0) {
                await StockDataModel.insertMany(stockDataToSave, { ordered: false });
                logger.debug(`Saved ${stockDataToSave.length} stock data records`);
            }

            if (candleDataToSave.length > 0) {
                await CandleDataModel.insertMany(candleDataToSave, { ordered: false });
                logger.debug(`Saved ${candleDataToSave.length} candle data records`);
            }

        } catch (error) {
            logError(error as Error, 'Failed to persist data');
        }
    }

    private async onMarketOpen(): Promise<void> {
        try {
            logger.info('Market opened - starting data collection');
            
            // Reset daily statistics
            await this.redisClient.del('daily_stats:*');
            
            // Start intensive data collection
            this.broadcastMarketEvent('MARKET_OPEN');
            
        } catch (error) {
            logError(error as Error, 'Failed to handle market open');
        }
    }

    private async onMarketClose(): Promise<void> {
        try {
            logger.info('Market closed - stopping data collection');
            
            // Final data persistence
            await this.persistData();
            
            // Generate end of day summary
            await this.generateEndOfDaySummary();
            
            this.broadcastMarketEvent('MARKET_CLOSE');
            
        } catch (error) {
            logError(error as Error, 'Failed to handle market close');
        }
    }

    private async generateEndOfDaySummary(): Promise<void> {
        try {
            const summary = {
                date: getMarketTime().toISOString().split('T')[0],
                totalSymbols: this.watchedSymbols.size,
                topGainers: this.getTopMovers('gainers'),
                topLosers: this.getTopMovers('losers'),
                totalVolume: this.getTotalVolume(),
                timestamp: getMarketTime()
            };

            await this.redisClient.setEx(
                'daily_summary',
                86400, // 24 hours TTL
                JSON.stringify(summary)
            );

            this.socketServer.emit('daily_summary', summary);
            logger.info('End of day summary generated');
        } catch (error) {
            logError(error as Error, 'Failed to generate end of day summary');
        }
    }

    private getTopMovers(type: 'gainers' | 'losers'): Array<{symbol: string, change: number, changePercent: number}> {
        const movers = Array.from(this.priceCache.values())
            .map(data => ({
                symbol: data.symbol,
                change: data.change || 0,
                changePercent: data.changePercent || 0
            }))
            .sort((a, b) => type === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent)
            .slice(0, 10);

        return movers;
    }

    private getTotalVolume(): number {
        return Array.from(this.priceCache.values())
            .reduce((total, data) => total + (data.volume || 0), 0);
    }

    private broadcastMarketEvent(event: string): void {
        const message: WebSocketMessage = {
            type: 'MARKET_EVENT',
            data: { event, timestamp: getMarketTime() },
            timestamp: getMarketTime()
        };

        this.socketServer.emit('market_event', message);
    }

    public async addSymbol(symbol: string): Promise<void> {
        const cleanSymbol = sanitizeSymbol(symbol);
        if (validateSymbol(cleanSymbol) && !this.watchedSymbols.has(cleanSymbol)) {
            this.watchedSymbols.add(cleanSymbol);
            
            // Subscribe with all data providers
            await Promise.allSettled(
                this.dataProviders.map(provider => provider.subscribe([cleanSymbol]))
            );
            
            logger.info(`Added symbol: ${cleanSymbol}`);
        }
    }

    public async removeSymbol(symbol: string): Promise<void> {
        const cleanSymbol = sanitizeSymbol(symbol);
        if (this.watchedSymbols.has(cleanSymbol)) {
            this.watchedSymbols.delete(cleanSymbol);
            this.priceCache.delete(cleanSymbol);
            
            // Remove from candle cache
            const timeframes = ['1m', '5m', '15m', '1h'];
            timeframes.forEach(timeframe => {
                this.candleCache.delete(`${cleanSymbol}:${timeframe}`);
            });
            
            logger.info(`Removed symbol: ${cleanSymbol}`);
        }
    }

    public async getCurrentPrice(symbol: string): Promise<StockData | null> {
        const cleanSymbol = sanitizeSymbol(symbol);
        return this.priceCache.get(cleanSymbol) || null;
    }

    public async getCandleData(symbol: string, timeframe: string): Promise<CandlestickData[]> {
        const cacheKey = `${sanitizeSymbol(symbol)}:${timeframe}`;
        return this.candleCache.get(cacheKey) || [];
    }

    public getWatchedSymbols(): string[] {
        return Array.from(this.watchedSymbols);
    }

    async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down Market Data Collector...');
            
            // Disconnect all data providers
            await Promise.allSettled(
                this.dataProviders.map(provider => provider.disconnect())
            );
            
            // Close server
            this.socketServer.close();
            this.httpServer.close();
            
            // Disconnect databases
            if (this.redisClient) {
                await this.redisClient.disconnect();
            }
            
            if (this.mongoConnection) {
                await mongoose.disconnect();
            }
            
            logger.info('Market Data Collector shutdown completed');
        } catch (error) {
            logError(error as Error, 'Error during shutdown');
        }
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const collector = new MarketDataCollector();
        await collector.initialize();

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await collector.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await collector.shutdown();
            process.exit(0);
        });

        logger.info('Market Data Collector started successfully');
    } catch (error) {
        logError(error as Error, 'Failed to start Market Data Collector');
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main();
}

export { MarketDataCollector };
