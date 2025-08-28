import dotenv from 'dotenv';
import axios from 'axios';
import * as cron from 'node-cron';
import { createClient } from 'redis';
import winston from 'winston';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { 
    StockData, 
    ScreenerConfig, 
    ScreenerFilter,
    TradingSignal,
    SectorAnalysis,
    MarketSentiment,
    AppError
} from '../../shared/types';
import { 
    logMessage, 
    logError, 
    isMarketOpen, 
    validateSymbol,
    sanitizeSymbol,
    createAppError,
    formatCurrency,
    formatNumber
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
    defaultMeta: { service: 'screener-integration' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

interface ScreenerStockData {
    symbol: string;
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    marketCap: number;
    pe: number;
    pb: number;
    roe: number;
    roce: number;
    sector: string;
    industry: string;
    volume: number;
    avgVolume: number;
    high52w: number;
    low52w: number;
    dividend: number;
    debtToEquity: number;
    eps: number;
    bookValue: number;
    salesGrowth: number;
    profitGrowth: number;
}

interface ScreenerScreenResult {
    stocks: ScreenerStockData[];
    timestamp: Date;
    filterUsed: string;
    count: number;
}

class ScreenerIntegration {
    private config: ScreenerConfig;
    private redisClient: any;
    private browser: any = null;
    private isInitialized: boolean = false;
    private screenResults: Map<string, ScreenerScreenResult> = new Map();
    private sectorData: Map<string, SectorAnalysis> = new Map();

    // Default screening filters for Indian market
    private defaultFilters: ScreenerFilter[] = [
        {
            name: 'Market Capitalization',
            condition: 'market_cap',
            value: 1000,
            operator: '>'
        },
        {
            name: 'Price to Earnings',
            condition: 'pe',
            value: 50,
            operator: '<'
        },
        {
            name: 'Return on Equity',
            condition: 'roe',
            value: 15,
            operator: '>'
        },
        {
            name: 'Debt to Equity',
            condition: 'debt_to_equity',
            value: 1,
            operator: '<'
        },
        {
            name: 'Sales Growth',
            condition: 'sales_growth',
            value: 10,
            operator: '>'
        }
    ];

    constructor(config: ScreenerConfig) {
        this.config = {
            ...config,
            filters: [...config.filters, ...this.defaultFilters]
        };
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
        // Run screening every hour during market hours
        cron.schedule('0 * * * *', async () => {
            if (isMarketOpen()) {
                await this.runAllScreens();
            }
        });

        // Update sector analysis every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            if (isMarketOpen()) {
                await this.updateSectorAnalysis();
            }
        });

        // End of day comprehensive analysis
        cron.schedule('0 16 * * 1-5', async () => {
            await this.endOfDayAnalysis();
        });
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Screener Integration...');
            
            // Initialize browser for web scraping
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // Test API connectivity
            await this.testConnectivity();

            this.isInitialized = true;
            logger.info('Screener Integration initialized successfully');
        } catch (error) {
            logError(error as Error, 'Failed to initialize Screener Integration');
            throw error;
        }
    }

    private async testConnectivity(): Promise<void> {
        try {
            const response = await axios.get('https://www.screener.in/', {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.status === 200) {
                logger.info('Screener.in connectivity test passed');
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        } catch (error) {
            logError(error as Error, 'Screener.in connectivity test failed');
            throw error;
        }
    }

    async runScreen(filterName: string, customFilters?: ScreenerFilter[]): Promise<ScreenerScreenResult> {
        try {
            const filters = customFilters || this.config.filters;
            logger.info(`Running screen: ${filterName}`);

            // Simulate screening results for demonstration
            // In a real implementation, this would scrape Screener.in
            const stocks = await this.simulateScreeningResults(filters);

            const result: ScreenerScreenResult = {
                stocks,
                timestamp: new Date(),
                filterUsed: filterName,
                count: stocks.length
            };

            // Cache results
            this.screenResults.set(filterName, result);
            await this.cacheScreenResults(filterName, result);

            logger.info(`Screen ${filterName} completed with ${stocks.length} results`);
            return result;
        } catch (error) {
            logError(error as Error, `Failed to run screen: ${filterName}`);
            throw error;
        }
    }

    private async simulateScreeningResults(filters: ScreenerFilter[]): Promise<ScreenerStockData[]> {
        // This is a simulation for demonstration
        // In a real implementation, this would scrape actual data from Screener.in
        const sampleStocks = [
            'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
            'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
            'LT', 'ASIANPAINT', 'MARUTI', 'TITAN', 'NESTLEIND'
        ];

        return sampleStocks.map(symbol => ({
            symbol,
            name: `${symbol} Limited`,
            currentPrice: Math.random() * 2000 + 500,
            change: Math.random() * 100 - 50,
            changePercent: Math.random() * 10 - 5,
            marketCap: Math.random() * 500000 + 10000,
            pe: Math.random() * 50 + 5,
            pb: Math.random() * 10 + 0.5,
            roe: Math.random() * 40 + 5,
            roce: Math.random() * 35 + 5,
            sector: 'Technology',
            industry: 'Software',
            volume: Math.floor(Math.random() * 1000000),
            avgVolume: Math.floor(Math.random() * 800000),
            high52w: Math.random() * 2500 + 1000,
            low52w: Math.random() * 1000 + 200,
            dividend: Math.random() * 5,
            debtToEquity: Math.random() * 2,
            eps: Math.random() * 100 + 10,
            bookValue: Math.random() * 1000 + 100,
            salesGrowth: Math.random() * 50 - 10,
            profitGrowth: Math.random() * 60 - 15
        }));
    }

    async runAllScreens(): Promise<void> {
        try {
            logger.info('Running all predefined screens...');

            const screens = [
                { name: 'High Growth', filters: this.getHighGrowthFilters() },
                { name: 'Value Stocks', filters: this.getValueStockFilters() },
                { name: 'Quality Stocks', filters: this.getQualityStockFilters() },
                { name: 'Momentum', filters: this.getMomentumFilters() }
            ];

            const results = await Promise.allSettled(
                screens.map(screen => this.runScreen(screen.name, screen.filters))
            );

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    logger.info(`Screen ${screens[index].name} completed successfully`);
                } else {
                    logError(result.reason, `Screen ${screens[index].name} failed`);
                }
            });

        } catch (error) {
            logError(error as Error, 'Failed to run all screens');
        }
    }

    private getHighGrowthFilters(): ScreenerFilter[] {
        return [
            { name: 'Sales Growth', condition: 'sales_growth_3y', value: 20, operator: '>' },
            { name: 'Profit Growth', condition: 'profit_growth_3y', value: 25, operator: '>' },
            { name: 'ROE', condition: 'roe', value: 20, operator: '>' },
            { name: 'PE', condition: 'pe', value: 40, operator: '<' }
        ];
    }

    private getValueStockFilters(): ScreenerFilter[] {
        return [
            { name: 'PE', condition: 'pe', value: 15, operator: '<' },
            { name: 'PB', condition: 'pb', value: 2, operator: '<' },
            { name: 'Dividend Yield', condition: 'dividend_yield', value: 2, operator: '>' },
            { name: 'ROE', condition: 'roe', value: 15, operator: '>' }
        ];
    }

    private getQualityStockFilters(): ScreenerFilter[] {
        return [
            { name: 'ROE', condition: 'roe', value: 20, operator: '>' },
            { name: 'ROCE', condition: 'roce', value: 20, operator: '>' },
            { name: 'Debt to Equity', condition: 'debt_to_equity', value: 0.5, operator: '<' },
            { name: 'Interest Coverage', condition: 'interest_coverage', value: 5, operator: '>' }
        ];
    }

    private getMomentumFilters(): ScreenerFilter[] {
        return [
            { name: 'Price Performance 1Y', condition: 'price_performance_1y', value: 20, operator: '>' },
            { name: 'Volume Growth', condition: 'volume_growth', value: 30, operator: '>' },
            { name: 'EPS Growth', condition: 'eps_growth', value: 15, operator: '>' }
        ];
    }

    async updateSectorAnalysis(): Promise<void> {
        try {
            logger.info('Updating sector analysis...');

            // Simulate sector data for demonstration
            const sectors = ['Technology', 'Banking', 'FMCG', 'Auto', 'Pharma', 'Metals', 'Energy'];
            
            for (const sector of sectors) {
                const performance = Math.random() * 20 - 10; // -10% to +10%
                const sectorAnalysis: SectorAnalysis = {
                    sector,
                    performance,
                    momentum: performance > 5 ? 'BULLISH' : performance < -5 ? 'BEARISH' : 'SIDEWAYS',
                    topGainers: ['STOCK1', 'STOCK2', 'STOCK3'],
                    topLosers: ['STOCK4', 'STOCK5', 'STOCK6']
                };

                this.sectorData.set(sector, sectorAnalysis);
                await this.cacheSectorData(sector, sectorAnalysis);
            }

            logger.info(`Updated analysis for ${sectors.length} sectors`);
        } catch (error) {
            logError(error as Error, 'Failed to update sector analysis');
        }
    }

    private async cacheScreenResults(filterName: string, result: ScreenerScreenResult): Promise<void> {
        try {
            if (!this.redisClient) return;

            await this.redisClient.setEx(
                `screener:results:${filterName}`,
                3600, // 1 hour TTL
                JSON.stringify(result)
            );
        } catch (error) {
            logError(error as Error, 'Failed to cache screen results');
        }
    }

    private async cacheSectorData(sector: string, data: SectorAnalysis): Promise<void> {
        try {
            if (!this.redisClient) return;

            await this.redisClient.setEx(
                `screener:sector:${sector}`,
                1800, // 30 minutes TTL
                JSON.stringify(data)
            );
        } catch (error) {
            logError(error as Error, 'Failed to cache sector data');
        }
    }

    async getScreenResults(filterName: string): Promise<ScreenerScreenResult | null> {
        try {
            return this.screenResults.get(filterName) || null;
        } catch (error) {
            logError(error as Error, `Failed to get screen results for ${filterName}`);
            return null;
        }
    }

    async getSectorAnalysis(sector?: string): Promise<SectorAnalysis[]> {
        try {
            if (sector) {
                const data = this.sectorData.get(sector);
                return data ? [data] : [];
            }

            return Array.from(this.sectorData.values());
        } catch (error) {
            logError(error as Error, 'Failed to get sector analysis');
            return [];
        }
    }

    private async endOfDayAnalysis(): Promise<void> {
        try {
            logger.info('Running end of day analysis...');

            // Update all screens and sector analysis
            await this.runAllScreens();
            await this.updateSectorAnalysis();

            logger.info('End of day analysis completed');
        } catch (error) {
            logError(error as Error, 'Failed to run end of day analysis');
        }
    }

    async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down Screener Integration...');
            
            if (this.browser) {
                await this.browser.close();
            }
            
            if (this.redisClient) {
                await this.redisClient.disconnect();
            }
            
            logger.info('Screener Integration shutdown completed');
        } catch (error) {
            logError(error as Error, 'Error during shutdown');
        }
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const config: ScreenerConfig = {
            baseUrl: 'https://www.screener.in',
            filters: [],
            updateInterval: 3600000 // 1 hour
        };

        const screener = new ScreenerIntegration(config);
        await screener.initialize();

        // Run initial screening
        await screener.runAllScreens();

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await screener.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await screener.shutdown();
            process.exit(0);
        });

        logger.info('Screener Integration started successfully');
    } catch (error) {
        logError(error as Error, 'Failed to start Screener Integration');
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main();
}

export { ScreenerIntegration };
