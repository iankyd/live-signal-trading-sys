import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import cors from 'cors';

// Simple test server without external dependencies
const app = express();
const httpServer = createServer(app);

// Enable CORS
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.use(express.json());

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Sample Indian stock symbols
const symbols = [
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
    'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK'
];

// In-memory storage for testing
const stockPrices: { [key: string]: any } = {};

// Initialize sample data
symbols.forEach(symbol => {
    stockPrices[symbol] = {
        symbol,
        price: Math.random() * 1000 + 500,
        change: (Math.random() - 0.5) * 20,
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date()
    };
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Market Data Collector Test Server',
        timestamp: new Date(),
        connectedClients: io.engine.clientsCount
    });
});

// Get all symbols
app.get('/api/symbols', (req, res) => {
    res.json({ 
        symbols,
        count: symbols.length 
    });
});

// Get current price for a symbol
app.get('/api/price/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const price = stockPrices[symbol];
    
    if (price) {
        res.json(price);
    } else {
        res.status(404).json({ error: 'Symbol not found' });
    }
});

// Get all current prices
app.get('/api/prices', (req, res) => {
    res.json(Object.values(stockPrices));
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send initial data
    socket.emit('initial_data', Object.values(stockPrices));
    
    // Handle symbol subscription
    socket.on('subscribe', (symbolList: string[]) => {
        console.log(`Client ${socket.id} subscribed to:`, symbolList);
        symbolList.forEach(symbol => {
            socket.join(`symbol:${symbol.toUpperCase()}`);
        });
        
        // Send current data for subscribed symbols
        const data = symbolList.map(symbol => stockPrices[symbol.toUpperCase()]).filter(Boolean);
        socket.emit('subscribed_data', data);
    });
    
    // Handle unsubscribe
    socket.on('unsubscribe', (symbolList: string[]) => {
        symbolList.forEach(symbol => {
            socket.leave(`symbol:${symbol.toUpperCase()}`);
        });
    });
    
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Simulate real-time price updates
function simulateMarketData() {
    symbols.forEach(symbol => {
        const currentPrice = stockPrices[symbol];
        const change = (Math.random() - 0.5) * 10; // Random change between -5 and +5
        const newPrice = Math.max(currentPrice.price + change, 1);
        
        stockPrices[symbol] = {
            ...currentPrice,
            price: newPrice,
            change: newPrice - currentPrice.price,
            changePercent: ((newPrice - currentPrice.price) / currentPrice.price) * 100,
            volume: Math.floor(Math.random() * 100000) + 10000,
            timestamp: new Date()
        };
        
        // Broadcast to subscribed clients
        io.to(`symbol:${symbol}`).emit('price_update', stockPrices[symbol]);
    });
    
    // Broadcast all prices to general listeners
    io.emit('market_update', Object.values(stockPrices));
}

// Start price simulation (every 2 seconds)
const simulationInterval = setInterval(simulateMarketData, 2000);

// Start server
const PORT = process.env.MARKET_DATA_PORT || 3001;
httpServer.listen(PORT, () => {
    console.log('🚀 Market Data Test Server running on port', PORT);
    console.log('📊 Simulating price updates for Indian market stocks');
    console.log('🔗 WebSocket endpoint: ws://localhost:' + PORT);
    console.log('📈 Health check: http://localhost:' + PORT + '/health');
    console.log('💹 Prices API: http://localhost:' + PORT + '/api/prices');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    clearInterval(simulationInterval);
    httpServer.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

export default app;
