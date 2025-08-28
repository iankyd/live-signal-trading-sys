import { 
    StockData, 
    TechnicalIndicators, 
    TradingSignal, 
    BreakoutSignal, 
    SupportResistance,
    CandlestickData,
    RiskMetrics,
    AppError 
} from '../types';

// Date and Time Utils
export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const formatDateTime = (date: Date): string => {
    return date.toISOString();
};

export const getMarketTime = (): Date => {
    // Convert to IST (UTC+5:30)
    const utc = new Date();
    const ist = new Date(utc.getTime() + (5.5 * 60 * 60 * 1000));
    return ist;
};

export const isMarketOpen = (): boolean => {
    const now = getMarketTime();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    // Market closed on weekends
    if (day === 0 || day === 6) return false;
    
    // Market hours: 9:15 AM to 3:30 PM IST
    return currentTime >= 915 && currentTime <= 1530;
};

// Logging Utils
export const logMessage = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, metadata?: any): void => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        metadata
    };
    console.log(`[${timestamp}] [${level}] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
};

export const logError = (error: Error | AppError, context?: string): void => {
    logMessage('ERROR', `${context ? `${context}: ` : ''}${error.message}`, {
        stack: 'stack' in error ? error.stack : undefined,
        details: 'details' in error ? error.details : undefined
    });
};

// Math and Calculation Utils
export const calculatePercentageChange = (oldValue: number, newValue: number): number => {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
};

export const roundToDecimals = (value: number, decimals: number = 2): number => {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const calculateSMA = (prices: number[], period: number): number => {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
};

export const calculateEMA = (prices: number[], period: number, smoothing: number = 2): number => {
    if (prices.length < period) return 0;
    
    const multiplier = smoothing / (period + 1);
    let ema = calculateSMA(prices.slice(0, period), period);
    
    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
};

export const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

export const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2) => {
    const sma = calculateSMA(prices, period);
    const squaredDiffs = prices.slice(-period).map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
        upper: sma + (standardDeviation * stdDev),
        middle: sma,
        lower: sma - (standardDeviation * stdDev)
    };
};

export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    
    // For signal line, we need to calculate EMA of MACD line
    // This is simplified - in practice, you'd need historical MACD values
    const signalLine = macdLine * 0.8; // Approximation
    const histogram = macdLine - signalLine;
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram
    };
};

// Technical Analysis Utils
export const calculateTechnicalIndicators = (candleData: CandlestickData[]): TechnicalIndicators => {
    const closes = candleData.map(candle => candle.close);
    const volumes = candleData.map(candle => candle.volume);
    const highs = candleData.map(candle => candle.high);
    const lows = candleData.map(candle => candle.low);
    
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const avgVolume = calculateSMA(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];
    
    // ATR calculation (simplified)
    const atr = calculateATR(highs, lows, closes);
    
    // ADX calculation (simplified)
    const adx = calculateADX(highs, lows, closes);
    
    return {
        rsi,
        macd,
        bollinger,
        ema: {
            ema20,
            ema50,
            ema200
        },
        volume: {
            current: currentVolume,
            avgVolume20: avgVolume,
            volumeRatio: avgVolume > 0 ? currentVolume / avgVolume : 1
        },
        atr,
        adx
    };
};

export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
    if (highs.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }
    
    return calculateSMA(trueRanges, period);
};

export const calculateADX = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
    // Simplified ADX calculation
    if (highs.length < period + 1) return 0;
    
    let plusDM = 0;
    let minusDM = 0;
    
    for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        
        if (upMove > downMove && upMove > 0) {
            plusDM += upMove;
        } else if (downMove > upMove && downMove > 0) {
            minusDM += downMove;
        }
    }
    
    const atr = calculateATR(highs, lows, closes, period);
    if (atr === 0) return 0;
    
    const plusDI = (plusDM / highs.length) / atr * 100;
    const minusDI = (minusDM / highs.length) / atr * 100;
    
    if (plusDI + minusDI === 0) return 0;
    
    return Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
};

// Breakout Detection Utils
export const detectBreakout = (
    currentPrice: number,
    resistance: number,
    volume: number,
    avgVolume: number,
    minVolumeRatio: number = 1.5
): BreakoutSignal | null => {
    const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
    
    if (currentPrice > resistance && volumeRatio >= minVolumeRatio) {
        return {
            symbol: '', // Will be set by caller
            type: 'BREAKOUT',
            level: resistance,
            volume,
            volumeRatio,
            strength: Math.min(10, Math.floor(volumeRatio * 2)),
            timeframe: '5m',
            resistance,
            timestamp: new Date()
        };
    }
    
    return null;
};

export const detectBreakdown = (
    currentPrice: number,
    support: number,
    volume: number,
    avgVolume: number,
    minVolumeRatio: number = 1.5
): BreakoutSignal | null => {
    const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
    
    if (currentPrice < support && volumeRatio >= minVolumeRatio) {
        return {
            symbol: '', // Will be set by caller
            type: 'BREAKDOWN',
            level: support,
            volume,
            volumeRatio,
            strength: Math.min(10, Math.floor(volumeRatio * 2)),
            timeframe: '5m',
            support,
            timestamp: new Date()
        };
    }
    
    return null;
};

export const findSupportResistance = (candleData: CandlestickData[]): SupportResistance => {
    const highs = candleData.map(c => c.high);
    const lows = candleData.map(c => c.low);
    const closes = candleData.map(c => c.close);
    
    // Simplified support/resistance detection
    const resistance = findResistanceLevels(highs);
    const support = findSupportLevels(lows);
    const pivotPoint = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    
    return {
        symbol: '', // Will be set by caller
        support,
        resistance,
        pivotPoint,
        timestamp: new Date()
    };
};

const findResistanceLevels = (highs: number[]): number[] => {
    const resistance: number[] = [];
    const window = 5;
    
    for (let i = window; i < highs.length - window; i++) {
        const current = highs[i];
        let isResistance = true;
        
        for (let j = i - window; j <= i + window; j++) {
            if (j !== i && highs[j] >= current) {
                isResistance = false;
                break;
            }
        }
        
        if (isResistance) {
            resistance.push(current);
        }
    }
    
    return resistance.slice(-3); // Return last 3 resistance levels
};

const findSupportLevels = (lows: number[]): number[] => {
    const support: number[] = [];
    const window = 5;
    
    for (let i = window; i < lows.length - window; i++) {
        const current = lows[i];
        let isSupport = true;
        
        for (let j = i - window; j <= i + window; j++) {
            if (j !== i && lows[j] <= current) {
                isSupport = false;
                break;
            }
        }
        
        if (isSupport) {
            support.push(current);
        }
    }
    
    return support.slice(-3); // Return last 3 support levels
};

// Signal Generation Utils
export const generateTradingSignal = (
    symbol: string,
    price: number,
    indicators: TechnicalIndicators,
    supportResistance: SupportResistance
): TradingSignal | null => {
    let signalType: 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL' = 'HOLD';
    let confidence = 0;
    let reasons: string[] = [];
    let target = price;
    let stopLoss = price;
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    
    // RSI signals
    if (indicators.rsi < 30) {
        signalType = 'BUY';
        confidence += 25;
        reasons.push('RSI oversold');
        target = price * 1.05;
        stopLoss = price * 0.95;
    } else if (indicators.rsi > 70) {
        signalType = 'SELL';
        confidence += 25;
        reasons.push('RSI overbought');
        target = price * 0.95;
        stopLoss = price * 1.05;
    }
    
    // MACD signals
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
        if (signalType === 'BUY') {
            signalType = 'STRONG_BUY';
            confidence += 20;
        } else if (signalType === 'HOLD') {
            signalType = 'BUY';
            confidence += 15;
        }
        reasons.push('MACD bullish crossover');
    } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
        if (signalType === 'SELL') {
            signalType = 'STRONG_SELL';
            confidence += 20;
        } else if (signalType === 'HOLD') {
            signalType = 'SELL';
            confidence += 15;
        }
        reasons.push('MACD bearish crossover');
    }
    
    // EMA signals
    if (price > indicators.ema.ema20 && indicators.ema.ema20 > indicators.ema.ema50) {
        confidence += 15;
        reasons.push('Price above EMAs in uptrend');
    } else if (price < indicators.ema.ema20 && indicators.ema.ema20 < indicators.ema.ema50) {
        confidence += 15;
        reasons.push('Price below EMAs in downtrend');
    }
    
    // Volume confirmation
    if (indicators.volume.volumeRatio > 1.5) {
        confidence += 10;
        reasons.push('High volume confirmation');
    }
    
    // Support/Resistance signals
    const nearSupport = supportResistance.support.some(level => Math.abs(price - level) / level < 0.02);
    const nearResistance = supportResistance.resistance.some(level => Math.abs(price - level) / level < 0.02);
    
    if (nearSupport && signalType === 'BUY') {
        confidence += 15;
        reasons.push('Near support level');
        risk = 'LOW';
    } else if (nearResistance && signalType === 'SELL') {
        confidence += 15;
        reasons.push('Near resistance level');
        risk = 'LOW';
    }
    
    // Don't generate signals with low confidence
    if (confidence < 40) {
        return null;
    }
    
    return {
        id: generateId(),
        symbol,
        signalType,
        confidence: Math.min(100, confidence),
        source: 'TECHNICAL',
        entry: price,
        target,
        stopLoss,
        timestamp: new Date(),
        reason: reasons.join(', '),
        indicators,
        risk
    };
};

// Utility Functions
export const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

export const validateSymbol = (symbol: string): boolean => {
    return /^[A-Z]{1,20}$/.test(symbol);
};

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

export const formatNumber = (num: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

// Risk Management Utils
export const calculatePositionSize = (
    accountBalance: number,
    riskPercentage: number,
    entryPrice: number,
    stopLoss: number
): number => {
    const riskAmount = accountBalance * (riskPercentage / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    return riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
};

export const calculateRiskReward = (entryPrice: number, target: number, stopLoss: number): number => {
    const profit = Math.abs(target - entryPrice);
    const loss = Math.abs(entryPrice - stopLoss);
    return loss > 0 ? profit / loss : 0;
};

// Data Validation Utils
export const validateStockData = (data: any): data is StockData => {
    return (
        typeof data === 'object' &&
        typeof data.symbol === 'string' &&
        typeof data.open === 'number' &&
        typeof data.high === 'number' &&
        typeof data.low === 'number' &&
        typeof data.close === 'number' &&
        typeof data.volume === 'number' &&
        data.timestamp instanceof Date
    );
};

export const sanitizeSymbol = (symbol: string): string => {
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// Error Handling Utils
export const createAppError = (code: string, message: string, details?: any, source?: string): AppError => {
    return {
        code,
        message,
        details,
        timestamp: new Date(),
        source: source || 'UNKNOWN'
    };
};

export const isAppError = (error: any): error is AppError => {
    return (
        typeof error === 'object' &&
        typeof error.code === 'string' &&
        typeof error.message === 'string' &&
        error.timestamp instanceof Date
    );
};