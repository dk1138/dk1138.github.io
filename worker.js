/**
 * worker.js
 * Background thread for running Monte Carlo simulations without freezing the UI.
 * Logic is now imported from financeEngine.js to maintain a single source of truth.
 */

// Import the shared financial logic engine
importScripts('financeEngine.js');

self.onmessage = function(e) {
    try {
        const data = e.data;
        const trajectories = [];
        
        if (!data || !data.simulations) {
            throw new Error("Invalid payload sent to the worker.");
        }
        
        for (let i = 0; i < data.simulations; i++) {
            // OPTIMIZATION: Deep clone the engine data for EVERY simulation run using structuredClone.
            // This is much faster and safer than JSON.parse(JSON.stringify())
            const clonedData = structuredClone(data);
            const engine = new FinanceEngine(clonedData);
            
            let simContext = { method: clonedData.method };
            
            if (clonedData.method === 'historical') {
                if (!clonedData.sp500 || clonedData.sp500.length === 0) {
                    throw new Error("Historical S&P 500 sequence is missing.");
                }
                const startIdx = Math.floor(Math.random() * clonedData.sp500.length);
                simContext.histSequence = [];
                for (let y = 0; y < 100; y++) {
                    simContext.histSequence.push(clonedData.sp500[(startIdx + y) % clonedData.sp500.length]);
                }
            } else {
                simContext.volatility = clonedData.volatility;
            }

            // Run simulation using the shared engine (detailed = false returns just the Net Worth array)
            const result = engine.runSimulation(false, simContext);
            
            if (!result || result.length === 0) {
                throw new Error("Engine returned an empty projection.");
            }
            
            trajectories.push(result);
        }
        
        // Post the final success packet back to the main thread
        self.postMessage({ success: true, trajectories: trajectories });
        
    } catch (error) {
        // If anything crashes, catch it and send the exact error back to the UI
        self.postMessage({ success: false, error: error.message, stack: error.stack });
    }
};
