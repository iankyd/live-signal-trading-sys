import dotenv from 'dotenv';
import WebSocket from 'ws';
import axios from 'axios';
import * as cron from 'node-cron';
import { createClient } from 'redis';
import winston from 'winston';
import puppeteer from 'puppeteer';
import { 
    StockData, 
    CandlestickData, 
    TradingViewConfig, 
    TechnicalIndicators,
    WebSocketMessage,
    TradingSignal,
    AppError
} from '../../shared/types';
import { 
    logMessage, 
    logError, 
    isMarketOpen, 
    calculateTechnicalIndicators,
    generateTradingSignal,
    findSupportResistance,
    validateSymbol,
    createAppError,
    sanitizeSymbol
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
    defaultMeta: { service: 'tradingview-integration' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

interface TradingViewWebSocketData {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    change: number;
    changePercent: number;
}

class TradingViewIntegration {
    private config: TradingViewConfig;
    private websocket: WebSocket | null = null;
    private redisClient: any;
    private browser: any = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private watchedSymbols: Set<string> = new Set();
    private candleDataCache: Map<string, CandlestickData[]> = new Map();

    constructor(config: TradingViewConfig) {
        this.config = config;
        this.initializeRedis();
        this.setupScheduledTasks();
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

    private setupScheduledTasks(): void {
        // Schedule market data collection during market hours
        cron.schedule('*/1 * * * *', async () => {
            if (isMarketOpen()) {
                await this.collectMarketData();
            }
        });

        // Schedule technical analysis every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            if (isMarketOpen()) {
                await this.runTechnicalAnalysis();
            }
        });

        // Schedule end of day cleanup
        cron.schedule('0 16 * * 1-5', async () => {
            await this.endOfDayCleanup();
        });
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing TradingView Integration...');
            
            // Initialize browser for web scraping if needed
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // Add default symbols for Indian market
            const defaultSymbols = [
                'NSE:RELIANCE', 'NSE:TCS', 'NSE:INFY', 'NSE:HDFCBANK', 'NSE:ICICIBANK',
                'NSE:HINDUNILVR', 'NSE:ITC', 'NSE:SBIN', 'NSE:BHARTIARTL', 'NSE:KOTAKBANK',
                'NSE:LT', 'NSE:ASIANPAINT', 'NSE:MARUTI', 'NSE:TITAN', 'NSE:NESTLEIND',
                'NSE:BAJFINANCE', 'NSE:HCLTECH', 'NSE:WIPRO', 'NSE:ULTRACEMCO', 'NSE:POWERGRID'
            ];

            for (const symbol of [...this.config.symbols, ...defaultSymbols]) {
                if (validateSymbol(symbol.replace('NSE:', ''))) {
                    this.watchedSymbols.add(symbol);
                }
            }

            await this.connectWebSocket();
            logger.info('TradingView Integration initialized successfully');
        } catch (error) {
            logError(error as Error, 'Failed to initialize TradingView Integration');
            throw error;
        }
    }

    private async connectWebSocket(): Promise<void> {
        try {
            // Note: TradingView doesn't provide official WebSocket API
            // This is a simplified implementation that would need to be adapted
            // to work with actual TradingView data feeds or alternative providers
            
            const wsUrl = process.env.TRADINGVIEW_WS_URL || 'wss://data.tradingview.com/socket.io/websocket';
            
            this.websocket = new WebSocket(wsUrl);

            this.websocket.on('open', () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                logger.info('TradingView WebSocket connected');
                this.subscribeToSymbols();
            });

            this.websocket.on('message', (data: string) => {
                this.handleWebSocketMessage(data);
            });

            this.websocket.on('close', () => {
                this.isConnected = false;
                logger.warn('TradingView WebSocket disconnected');
                this.handleReconnection();
            });

            this.websocket.on('error', (error: Error) => {
                logError(error, 'TradingView WebSocket error');
                this.handleReconnection();
            });

        } catch (error) {
            logError(error as Error, 'Failed to connect to TradingView WebSocket');
            throw error;
        }
    }

    // Additional methods would continue here...
    // For brevity, I'll continue with the core methods

    public async getSignals(symbol?: string): Promise<TradingSignal[]> {
        try {
            if (symbol) {
                const signals = await this.redisClient.lRange(`signals:${symbol}`, 0, -1);
                return signals.map((s: string) => JSON.parse(s));
            } else {
                const allSignals: TradingSignal[] = [];
                for (const sym of this.watchedSymbols) {
                    const cleanSym = sanitizeSymbol(sym.replace('NSE:', ''));
                    const signals = await this.redisClient.lRange(`signals:${cleanSym}`, 0, 9);
                    allSignals.push(...signals.map((s: string) => JSON.parse(s)));
                }
                return allSignals;
            }
        } catch (error) {
            logError(error as Error, 'Failed to get signals');
            return [];
        }
    }

    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down TradingView Integration...');
            
            if (this.websocket) {
                this.websocket.close();
            }
            
            if (this.browser) {
                await this.browser.close();
            }
            
            if (this.redisClient) {
                await this.redisClient.disconnect();
            }
            
            logger.info('TradingView Integration shutdown completed');
        } catch (error) {
            logError(error as Error, 'Error during shutdown');
        }
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const config: TradingViewConfig = {
            username: process.env.TRADINGVIEW_USERNAME || '',
            password: process.env.TRADINGVIEW_PASSWORD || '',
            symbols: [
                'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
                'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK'
            ],
            timeframes: ['1m', '5m', '15m', '1h', '1d'],
            indicators: ['RSI', 'MACD', 'EMA', 'BB', 'ADX']
        };

        const tradingView = new TradingViewIntegration(config);
        await tradingView.initialize();

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await tradingView.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await tradingView.shutdown();
            process.exit(0);
        });

        logger.info('TradingView Integration started successfully');
    } catch (error) {
        logError(error as Error, 'Failed to start TradingView Integration');
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main();
}

export { TradingViewIntegration };
