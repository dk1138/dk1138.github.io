/**
 * worker.js
 * Background thread for running Monte Carlo simulations without freezing the UI.
 * Logic is now imported from financeEngine.js to maintain a single source of truth.
 */

// Import the shared financial logic engine
importScripts('financeEngine.js');

self.onmessage = function(e) {
    const data = e.data;
    
    // Instantiate the shared engine with the data from the main thread
    const engine = new FinanceEngine(data);
    const trajectories = [];
    
    for (let i = 0; i < data.simulations; i++) {
        let simContext = { returnTrajectory: true, method: data.method };
        
        if (data.method === 'historical') {
            const startIdx = Math.floor(Math.random() * data.sp500.length);
            simContext.histSequence = [];
            for (let y = 0; y < 100; y++) {
                simContext.histSequence.push(data.sp500[(startIdx + y) % data.sp500.length]);
            }
        } else {
            simContext.volatility = data.volatility;
        }

        // Run simulation using the shared engine (detailed = false)
        trajectories.push(engine.runSimulation(false, simContext));
    }
    
    self.postMessage({ trajectories });
};
