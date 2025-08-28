import { analyzeBreakouts } from '../../shared/utils';
import { getLiveData } from '../tradingview-integration/src';
import { fetchStockData } from '../screener-integration/src';

const main = async () => {
    try {
        const liveData = await getLiveData();
        const stockData = await fetchStockData();

        const breakoutAnalysis = analyzeBreakouts(liveData, stockData);
        console.log('Breakout Analysis Results:', breakoutAnalysis);
    } catch (error) {
        console.error('Error during breakout analysis:', error);
    }
};

main();