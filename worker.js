/**
 * worker.js
 * Background thread for running Monte Carlo simulations without freezing the UI.
 */

// Import the shared financial logic engine
importScripts('financeEngine.js');

self.onmessage = function(e) {
    // Determine if the message is wrapped in the new type/payload structure
    let payload = e.data;
    let isWrapped = false;
    
    if (e.data && e.data.type === 'RUN_MONTE_CARLO') {
        payload = e.data.payload;
        isWrapped = true;
    }

    const trajectories = [];
    let successCount = 0;
    
    for (let i = 0; i < payload.simulations; i++) {
        // CRITICAL: We must deep clone the payload for EVERY simulation. 
        // Otherwise, simulation #1 drains the portfolio, and simulation #2 starts with $0.
        const freshData = JSON.parse(JSON.stringify(payload));
        
        const engine = new FinanceEngine(freshData);
        let simContext = { method: payload.method };
        
        if (payload.method === 'historical') {
            const startIdx = Math.floor(Math.random() * payload.sp500.length);
            simContext.histSequence = [];
            for (let y = 0; y < 100; y++) {
                simContext.histSequence.push(payload.sp500[(startIdx + y) % payload.sp500.length]);
            }
        } else {
            simContext.volatility = payload.volatility;
        }

        // Run simulation using the shared engine (detailed = false returns just the Net Worth array)
        const trajectory = engine.runSimulation(false, simContext);
        trajectories.push(trajectory);
        
        // Track if this specific simulation ended with money left over
        if (trajectory[trajectory.length - 1] > 0) {
            successCount++;
        }
    }
    
    if (isWrapped) {
        // Sort trajectories by the final Net Worth amount (from worst outcome to best outcome)
        trajectories.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
        
        const numSims = payload.simulations;
        const p10Idx = Math.floor(numSims * 0.10); // Bottom 10% (Pessimistic)
        const p50Idx = Math.floor(numSims * 0.50); // 50th Percentile (Median)
        
        const result = {
            successRate: (successCount / numSims) * 100,
            medianTrajectory: trajectories[p50Idx],
            p10Trajectory: trajectories[p10Idx]
        };
        
        // Post back using the exact format optimizers.js is waiting for
        self.postMessage({ type: 'MONTE_CARLO_COMPLETE', payload: result });
    } else {
        // Fallback for older versions of the app
        self.postMessage({ trajectories });
    }
};
