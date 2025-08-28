# Live Signal Trading System

This project is designed to facilitate live signal trading and analysis of break-in and break-out points specifically for the Indian stock market. It integrates with TradingView and Screener for stock selection and live chart analysis.

## Project Structure

The project consists of several applications and shared utilities:

```
live-signal-trading-system
├── apps
│   ├── tradingview-integration       # Handles TradingView API integration
│   ├── screener-integration           # Connects to Screener API for stock selection
│   ├── signal-engine                  # Processes trading signals from both integrations
│   └── breakout-analysis              # Analyzes breakout and breakdown points
├── shared
│   ├── types                          # Common types and interfaces
│   └── utils                          # Utility functions for the applications
└── README.md                          # Project documentation
```

## Applications

### TradingView Integration
- **Path:** `apps/tradingview-integration`
- **Description:** This application connects to TradingView's API and manages live data feeds for stock analysis.

### Screener Integration
- **Path:** `apps/screener-integration`
- **Description:** This application connects to the Screener API for stock selection and analysis.

### Signal Engine
- **Path:** `apps/signal-engine`
- **Description:** This application processes signals from both TradingView and Screener, implementing the logic for live trading signals.

### Breakout Analysis
- **Path:** `apps/breakout-analysis`
- **Description:** This application analyzes breakout and breakdown points based on live data from the other applications.

## Shared Utilities

### Types
- **Path:** `shared/types`
- **Description:** Exports common types and interfaces used across the applications to ensure type safety and consistency.

### Utils
- **Path:** `shared/utils`
- **Description:** Exports utility functions that can be used across the applications, such as logging and data formatting functions.

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to each application directory and install dependencies:
   ```
   cd apps/tradingview-integration
   npm install
   ```

3. Repeat the installation for `screener-integration`, `signal-engine`, and `breakout-analysis`.

4. Build the applications:
   ```
   npm run build
   ```

5. Start the applications as needed.

## Usage Guidelines

- Ensure you have valid API keys for TradingView and Screener.
- Configure the applications as per your requirements in their respective `package.json` files.
- Monitor the logs for any errors or issues during runtime.

## System Architecture

The system is designed to be modular, allowing for easy integration and maintenance of each component. The applications communicate with each other to provide a seamless trading experience, leveraging live data for real-time analysis and decision-making.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.