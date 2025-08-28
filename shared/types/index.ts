// Market Data Types
export interface StockData {
    symbol: string;
    exchange: 'NSE' | 'BSE';
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
    prevClose: number;
    change: number;
    changePercent: number;
    vwap?: number;
    marketCap?: number;
}

export interface CandlestickData extends StockData {
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d';
    ema20?: number;
    ema50?: number;
    rsi?: number;
    macd?: number;
    bollingerUpper?: number;
    bollingerLower?: number;
}

// Signal Types
export interface TradingSignal {
    id: string;
    symbol: string;
    signalType: 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';
    confidence: number; // 0-100
    source: 'TECHNICAL' | 'BREAKOUT' | 'VOLUME' | 'NEWS' | 'COMBINED';
    entry: number;
    target: number;
    stopLoss: number;
    timestamp: Date;
    reason: string;
    indicators: TechnicalIndicators;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BreakoutSignal {
    symbol: string;
    type: 'BREAKOUT' | 'BREAKDOWN';
    level: number;
    volume: number;
    volumeRatio: number; // current volume / avg volume
    strength: number; // 1-10 scale
    timeframe: string;
    resistance?: number;
    support?: number;
    timestamp: Date;
    patternType?: 'TRIANGLE' | 'RECTANGLE' | 'FLAG' | 'PENNANT' | 'CHANNEL';
}

// Technical Analysis Types
export interface TechnicalIndicators {
    rsi: number;
    macd: {
        macd: number;
        signal: number;
        histogram: number;
    };
    bollinger: {
        upper: number;
        middle: number;
        lower: number;
    };
    ema: {
        ema20: number;
        ema50: number;
        ema200: number;
    };
    volume: {
        current: number;
        avgVolume20: number;
        volumeRatio: number;
    };
    atr: number;
    adx: number;
}

export interface SupportResistance {
    symbol: string;
    support: number[];
    resistance: number[];
    pivotPoint: number;
    timestamp: Date;
}

// Market Analysis Types
export interface MarketSentiment {
    bullish: number;
    bearish: number;
    neutral: number;
    fearGreedIndex?: number;
    timestamp: Date;
}

export interface SectorAnalysis {
    sector: string;
    performance: number;
    topGainers: string[];
    topLosers: string[];
    momentum: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
}

// Portfolio Types
export interface Position {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    side: 'LONG' | 'SHORT';
    timestamp: Date;
}

export interface Portfolio {
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    positions: Position[];
    cashBalance: number;
    exposureRatio: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Configuration Types
export interface TradingViewConfig {
    username: string;
    password: string;
    sessionId?: string;
    symbols: string[];
    timeframes: string[];
    indicators: string[];
}

export interface ScreenerConfig {
    apiKey?: string;
    baseUrl: string;
    filters: ScreenerFilter[];
    updateInterval: number;
}

export interface ScreenerFilter {
    name: string;
    condition: string;
    value: number | string;
    operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
}

// WebSocket Types
export interface WebSocketMessage {
    type: 'PRICE_UPDATE' | 'SIGNAL' | 'BREAKOUT' | 'ALERT' | 'ORDER_UPDATE';
    data: any;
    timestamp: Date;
}

export interface PriceUpdate {
    symbol: string;
    price: number;
    change: number;
    volume: number;
    timestamp: Date;
}

// Alert Types
export interface Alert {
    id: string;
    symbol: string;
    type: 'PRICE_ALERT' | 'BREAKOUT_ALERT' | 'VOLUME_ALERT' | 'SIGNAL_ALERT';
    condition: string;
    target: number;
    isActive: boolean;
    triggeredAt?: Date;
    message: string;
    channels: ('EMAIL' | 'SMS' | 'PUSH' | 'TELEGRAM')[];
}

// Notification Types
export interface NotificationConfig {
    email?: {
        enabled: boolean;
        recipients: string[];
        smtp: {
            host: string;
            port: number;
            username: string;
            password: string;
        };
    };
    sms?: {
        enabled: boolean;
        provider: 'TWILIO' | 'AWS_SNS';
        apiKey: string;
        apiSecret: string;
        numbers: string[];
    };
    telegram?: {
        enabled: boolean;
        botToken: string;
        chatIds: string[];
    };
    push?: {
        enabled: boolean;
        vapidKeys: {
            public: string;
            private: string;
        };
    };
}

// Risk Management Types
export interface RiskParameters {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    correlationLimit: number;
    sectorExposureLimit: number;
    volatilityLimit: number;
}

export interface RiskMetrics {
    currentExposure: number;
    dailyPnl: number;
    drawdown: number;
    sharpeRatio: number;
    maxConsecutiveLosses: number;
    winRate: number;
    riskScore: number; // 0-100
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
    requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Error Types
export interface AppError {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
    source: string;
}

// Event Types
export interface SystemEvent {
    type: 'SYSTEM_START' | 'SYSTEM_STOP' | 'ERROR' | 'WARNING' | 'INFO';
    message: string;
    timestamp: Date;
    metadata?: any;
}