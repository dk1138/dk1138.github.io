/**
 * Retirement Planner Pro - Optimizers Controller
 * Handles advanced simulations like Monte Carlo, Die With Zero, and RRSP Sweet Spot.
 */
class Optimizers {
    constructor(app) {
        this.app = app;
        this.currentOptPerson = 'p1';
    }

    // ---------------- SMART OPTIMIZERS START ---------------- //
    runDieWithZero() {
        const btn = document.getElementById('btnRunDwZ');
        if(btn) { btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculating...'; btn.disabled = true; }

        setTimeout(() => {
            const engine = new FinanceEngine(this.app.getEngineData());
            const baseResult = engine.runSimulation(false, null, this.app.data.getTotalDebt());
            const baseFinalNW = baseResult[baseResult.length - 1];
            
            const resultsDiv = document.getElementById('dwz_results');
            
            if (baseFinalNW <= 0) {
                resultsDiv.innerHTML = `<div class="alert alert-warning small mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Your current plan already projects a shortfall. To utilize this optimizer, you need a projected surplus at the end of your plan. Try saving more or lowering your retirement spending first.</div>`;
                resultsDiv.style.display = 'block';
                if(btn) { btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i>Run Optimizer'; btn.disabled = false; }
                return;
            }

            // --- Path 1: Spend More (Binary Search) ---
            let minMult = 1.0, maxMult = 10.0, bestMult = 1.0;
            for(let i=0; i<15; i++) {
                let mid = (minMult + maxMult) / 2;
                let testEngine = new FinanceEngine(this.app.getEngineData());
                let res = testEngine.runSimulation(false, { expenseMultiplier: mid }, this.app.data.getTotalDebt());
                let finalNW = res[res.length - 1];
                if (finalNW > 0) {
                    minMult = mid;
                    bestMult = mid;
                } else {
                    maxMult = mid;
                }
            }

            // Calculate actual spend difference
            let baseRetSpend = 0;
            if(this.app.state.expenseMode === 'Simple') {
                Object.values(this.app.expensesByCategory).forEach(c => c.items.forEach(i => baseRetSpend += (i.ret || 0) * (i.freq || 12)));
            } else {
                Object.values(this.app.expensesByCategory).forEach(c => c.items.forEach(i => baseRetSpend += (i.gogo || 0) * (i.freq || 12)));
            }
            let extraSpend = baseRetSpend * (bestMult - 1);
            
            // --- Path 2: Retire Earlier (Linear Search) ---
            let testP1Age = this.app.getVal('p1_retireAge');
            let testP2Age = this.app.state.mode === 'Couple' ? this.app.getVal('p2_retireAge') : testP1Age;
            let currentP1Age = Math.abs(new Date(Date.now() - new Date(this.app.getRaw('p1_dob')+"-01").getTime()).getUTCFullYear() - 1970);
            let currentP2Age = this.app.state.mode === 'Couple' ? Math.abs(new Date(Date.now() - new Date(this.app.getRaw('p2_dob')+"-01").getTime()).getUTCFullYear() - 1970) : currentP1Age;
            
            let bestP1Age = testP1Age, bestP2Age = testP2Age;
            let possibleToRetireEarlier = false;

            while (testP1Age > currentP1Age || (this.app.state.mode === 'Couple' && testP2Age > currentP2Age)) {
                if (testP1Age > currentP1Age) testP1Age--;
                if (this.app.state.mode === 'Couple' && testP2Age > currentP2Age) testP2Age--;
                
                let testData = this.app.getEngineData(); // Uses safe deep-clone
                testData.inputs['p1_retireAge'] = testP1Age;
                if(this.app.state.mode === 'Couple') testData.inputs['p2_retireAge'] = testP2Age;
                
                let testEngine = new FinanceEngine(testData);
                let res = testEngine.runSimulation(false, null, this.app.data.getTotalDebt());
                let finalNW = res[res.length - 1];
                
                if (finalNW >= 0) {
                    bestP1Age = testP1Age;
                    bestP2Age = testP2Age;
                    possibleToRetireEarlier = true;
                } else {
                    break;
                }
            }

            // --- Path 3: Legacy/Giveaway ---
            let presentValueLegacy = baseFinalNW / Math.pow(1 + this.app.getVal('inflation_rate')/100, baseResult.length - 1);

            let html = `
                <div class="mb-3">
                    <h6 class="text-success fw-bold small text-uppercase ls-1"><i class="bi bi-arrow-up-circle me-1"></i> Option 1: Upgrade Lifestyle</h6>
                    <div class="p-3 bg-black bg-opacity-25 border border-secondary rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>You can spend approximately <strong class="text-success">$${Math.round(extraSpend).toLocaleString()} more per year</strong> in retirement without running out of money.</div>
                        <button class="btn btn-sm btn-outline-success fw-bold text-nowrap" onclick="app.optimizers.applyDwZSpend(${bestMult})">Apply</button>
                    </div>
                </div>
            `;

            if (possibleToRetireEarlier) {
                let ageStr = this.app.state.mode === 'Couple' ? `P1 to age <strong class="text-info">${bestP1Age}</strong> & P2 to <strong class="text-info">${bestP2Age}</strong>` : `age <strong class="text-info">${bestP1Age}</strong>`;
                html += `
                    <div class="mb-3">
                        <h6 class="text-info fw-bold small text-uppercase ls-1"><i class="bi bi-calendar-minus me-1"></i> Option 2: Retire Earlier</h6>
                        <div class="p-3 bg-black bg-opacity-25 border border-secondary rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>You can move your retirement up to ${ageStr} on your current budget.</div>
                            <button class="btn btn-sm btn-outline-info fw-bold text-nowrap" onclick="app.optimizers.applyDwZAge(${bestP1Age}, ${bestP2Age})">Apply</button>
                        </div>
                    </div>
                `;
            }

            html += `
                <div>
                    <h6 class="text-purple fw-bold small text-uppercase ls-1" style="color:var(--purple);"><i class="bi bi-gift me-1"></i> Option 3: Leave a Legacy</h6>
                    <div class="p-3 bg-black bg-opacity-25 border border-secondary rounded-3">
                        If you change nothing, you are on track to leave behind <strong style="color:var(--purple);">$${Math.round(presentValueLegacy).toLocaleString()}</strong> in today's dollars to your estate or charity.
                    </div>
                </div>
            `;

            resultsDiv.innerHTML = html;
            resultsDiv.style.display = 'block';
            
            if(btn) { btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i>Run Optimizer'; btn.disabled = false; }
        }, 50);
    }

    applyDwZSpend(multiplier) {
        if(this.app.state.expenseMode === 'Simple') {
            Object.values(this.app.expensesByCategory).forEach(c => c.items.forEach(i => i.ret = Math.round((i.ret || 0) * multiplier)));
        } else {
            Object.values(this.app.expensesByCategory).forEach(c => c.items.forEach(i => {
                i.gogo = Math.round((i.gogo || 0) * multiplier);
                i.slow = Math.round((i.slow || 0) * multiplier);
                i.nogo = Math.round((i.nogo || 0) * multiplier);
            }));
        }
        this.app.data.renderExpenseRows();
        this.app.data.calcExpenses();
        this.app.run();
        document.querySelector('button[data-bs-target="#plan-pane"]')?.click();
        alert("Retirement spending has been upgraded!");
    }

    applyDwZAge(p1Age, p2Age) {
        document.getElementById('p1_retireAge').value = p1Age;
        this.app.state.inputs['p1_retireAge'] = p1Age;
        this.app.ui.updateSidebarSync('p1_retireAge', p1Age);
        
        if (this.app.state.mode === 'Couple') {
            document.getElementById('p2_retireAge').value = p2Age;
            this.app.state.inputs['p2_retireAge'] = p2Age;
            this.app.ui.updateSidebarSync('p2_retireAge', p2Age);
        }
        this.app.run();
        document.querySelector('button[data-bs-target="#plan-pane"]')?.click();
        alert("Retirement ages have been updated!");
    }

    runRRSPOptimizer() {
        const modalContainer = document.getElementById('rrspOptimizerResults');
        if (!modalContainer) return;

        let html = `
            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
                <ul class="nav nav-pills mb-2 mb-md-0" id="pills-tab" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#opt-tab-content" type="button" role="tab" onclick="app.optimizers.calcRRSPFor('p1')">Player 1</button>
                    </li>
                    ${this.app.state.mode === 'Couple' ? `<li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#opt-tab-content" type="button" role="tab" onclick="app.optimizers.calcRRSPFor('p2')">Player 2</button></li>` : ''}
                </ul>
            </div>
            <div class="mb-4 bg-black bg-opacity-25 p-3 rounded border border-secondary d-flex flex-wrap gap-3 align-items-center">
                <div>
                    <label class="form-label small text-info fw-bold mb-1">Your Available RRSP Room</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                        <input type="number" class="form-control border-secondary" id="opt_rrsp_room" value="50000" style="max-width: 150px;" oninput="app.optimizers.calcRRSPFor(app.optimizers.currentOptPerson)">
                    </div>
                    <div class="form-text text-muted mb-0" style="font-size:0.7rem;">Enter the limit from your Notice of Assessment</div>
                </div>
            </div>
            <div id="opt-tab-content">
                </div>
        `;
        modalContainer.innerHTML = html;
        this.currentOptPerson = 'p1';
        this.calcRRSPFor('p1');

        let mEl = document.getElementById('rrspOptimizerModal');
        if(mEl) {
            let m = bootstrap.Modal.getInstance(mEl) || new bootstrap.Modal(mEl);
            m.show();
        }
    }

    calcRRSPFor(pfx) {
        this.currentOptPerson = pfx;
        const container = document.getElementById('opt-tab-content');
        if(!container) return;

        const engine = new FinanceEngine(this.app.getEngineData());
        const taxBrackets = engine.getInflatedTaxData(1);
        const prov = this.app.getRaw('tax_province');
        const currentYear = new Date().getFullYear();
        const dependents = this.app.state.dependents || [];
        const hasCCB = dependents.length > 0;

        let maxRoom = parseFloat(document.getElementById('opt_rrsp_room')?.value) || 100000;
        if(maxRoom <= 0) maxRoom = 1000; // Provide a baseline if 0

        // Determine Base Incomes & Pre-Existing RRSP Match Deductions
        const getInc = (person) => {
            let base = this.app.getVal(`${person}_income`);
            let empMatchRate = this.app.getVal(`${person}_rrsp_match`) / 100;
            let empTier = this.app.getVal(`${person}_rrsp_match_tier`) / 100;
            if(empTier <= 0) empTier = 1;
            let empRrspDeduction = (base * empMatchRate) / empTier; 

            let add = 0;
            this.app.state.additionalIncome.forEach(s => {
                if(s.owner === person && s.taxable && s.startMode !== 'ret_relative') {
                    let sY = new Date((s.start || "2026-01") + "-01").getFullYear();
                    if(currentYear >= sY) add += s.amount * (s.freq === 'month' ? 12 : 1);
                }
            });
            return { gross: base + add, rrspDeduct: empRrspDeduction };
        };

        const targetData = getInc(pfx);
        const otherData = this.app.state.mode === 'Couple' ? getInc(pfx === 'p1' ? 'p2' : 'p1') : { gross: 0, rrspDeduct: 0 };

        // The taxable income before we start testing discretionary deposits
        let startingTaxableInc = Math.max(0, targetData.gross - targetData.rrspDeduct);
        let otherTaxableInc = Math.max(0, otherData.gross - otherData.rrspDeduct);
        let startingFamilyNet = startingTaxableInc + otherTaxableInc;

        if (startingTaxableInc <= 0) {
            container.innerHTML = `<div class="p-3 text-muted">No taxable income to optimize.</div>`;
            return;
        }

        // Calculate baseline Tax & CCB
        let baseTax = engine.calculateTaxDetailed(startingTaxableInc, prov, taxBrackets);
        let baseCCB = engine.calculateCCBForYear(currentYear, dependents, startingFamilyNet, 1);

        let exactSweetSpot = 0;
        let prevMarginalReturn = 0;

        // Step backwards dollar by dollar (in $100 chunks for speed) to track the marginal return curve
        for(let c = 100; c <= Math.min(startingTaxableInc, maxRoom); c += 100) {
            let testTax = engine.calculateTaxDetailed(startingTaxableInc - c, prov, taxBrackets);
            let testCCB = engine.calculateCCBForYear(currentYear, dependents, startingFamilyNet - c, 1);
            
            let taxSavedTotal = baseTax.totalTax - testTax.totalTax;
            let ccbGainedTotal = testCCB - baseCCB;
            let totalSaved = taxSavedTotal + ccbGainedTotal;

            // Check the previous block of $100 to find the exact drop-off
            let prevTestTax = engine.calculateTaxDetailed(startingTaxableInc - (c - 100), prov, taxBrackets);
            let prevTestCCB = engine.calculateCCBForYear(currentYear, dependents, startingFamilyNet - (c - 100), 1);
            
            let prevTaxSaved = baseTax.totalTax - prevTestTax.totalTax;
            let prevCcbGained = prevTestCCB - baseCCB;
            let prevTotalSaved = prevTaxSaved + prevCcbGained;

            // Marginal ROI is the savings generated purely by the LAST $100 added
            let marginalSavedOnThis100 = totalSaved - prevTotalSaved;
            let marginalRate = marginalSavedOnThis100 / 100;

            if (c === 100) {
                prevMarginalReturn = marginalRate;
            } else {
                // If the return drops by more than 1%, we hit a tax cliff or a CCB phase-out threshold!
                if (marginalRate < prevMarginalReturn - 0.01) {
                    exactSweetSpot = c - 100;
                    break;
                }
                prevMarginalReturn = marginalRate;
            }
        }

        if(exactSweetSpot === 0) exactSweetSpot = Math.min(startingTaxableInc, maxRoom); // Bottomed out perfectly

        // Build array of display points for the table
        let steps = [1000, 5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000];
        if (maxRoom > 0 && !steps.includes(maxRoom)) steps.push(maxRoom);
        if (exactSweetSpot > 0 && !steps.includes(exactSweetSpot)) steps.push(exactSweetSpot);
        
        steps = steps.filter(x => x <= maxRoom && x <= startingTaxableInc);
        steps.sort((a,b) => a - b);

        let tableHtml = `<div class="table-responsive"><table class="table table-dark table-sm table-striped mt-3">
            <thead><tr>
                <th class="text-secondary text-uppercase small ls-1">Contribution</th>
                <th class="text-secondary text-uppercase small ls-1">Tax Refund</th>
                ${hasCCB ? `<th class="text-secondary text-uppercase small ls-1">CCB Boost</th>` : ''}
                <th class="text-secondary text-uppercase small ls-1">Total ROI ($)</th>
                <th class="text-secondary text-uppercase small ls-1">Effective ROI %</th>
            </tr></thead><tbody>`;
        
        steps.forEach(c => {
            let t = engine.calculateTaxDetailed(startingTaxableInc - c, prov, taxBrackets);
            let ccb = engine.calculateCCBForYear(currentYear, dependents, startingFamilyNet - c, 1);
            
            let taxRefund = baseTax.totalTax - t.totalTax;
            let ccbBoost = ccb - baseCCB;
            let totalRoi = taxRefund + ccbBoost;
            let effRate = totalRoi / c;

            let isSweet = c === exactSweetSpot;
            let rowClass = isSweet ? 'table-success fw-bold text-dark' : '';
            let label = isSweet ? `$${c.toLocaleString()} <span class="badge bg-success ms-2 text-dark shadow-sm">Sweet Spot</span>` : `$${c.toLocaleString()}`;
            let colorClass = isSweet ? 'text-dark' : 'text-white';
            
            tableHtml += `<tr class="${rowClass}">
                <td class="align-middle">${label}</td>
                <td class="align-middle text-info ${isSweet ? 'text-dark' : ''}">$${Math.round(taxRefund).toLocaleString()}</td>
                ${hasCCB ? `<td class="align-middle text-warning ${isSweet ? 'text-dark' : ''}">+$${Math.round(ccbBoost).toLocaleString()}</td>` : ''}
                <td class="align-middle text-success ${isSweet ? 'text-dark' : ''}">$${Math.round(totalRoi).toLocaleString()}</td>
                <td class="align-middle ${colorClass}">${(effRate * 100).toFixed(1)}%</td>
            </tr>`;
        });
        tableHtml += `</tbody></table></div>`;

        let infoText = hasCCB 
            ? `At this amount, you ride your highest tax bracket AND your CCB boost down to the absolute bottom threshold. Contributing more will reduce the efficiency of subsequent dollars.`
            : `At this amount, you ride your highest marginal tax rate down to the bottom bracket cliff. Contributing more drops you into a lower bracket, reducing the tax efficiency of subsequent dollars.`;

        container.innerHTML = `
            <div class="alert mt-3 border-success bg-success bg-opacity-10 text-white shadow-sm">
                <h6 class="fw-bold mb-2 text-success"><i class="bi bi-check-circle-fill me-2"></i>Optimal Deposit: $${exactSweetSpot.toLocaleString()}</h6>
                <p class="small mb-0 text-muted">${infoText}</p>
                ${targetData.rrspDeduct > 0 ? `<p class="small mb-0 mt-2 text-warning"><i class="bi bi-info-circle me-1"></i>Note: This factors in the $${Math.round(targetData.rrspDeduct).toLocaleString()} pre-tax deduction from your Employer Match.</p>` : ''}
            </div>
            ${tableHtml}
        `;
    }

    // ---------------- MONTE CARLO ENGINE START ---------------- //
    runMonteCarlo() {
        const simCountInput = document.getElementById('mc_sim_count');
        const SIMULATIONS = simCountInput ? parseInt(simCountInput.value) : 500;
        
        const methodEl = document.getElementById('mc_sim_method');
        const method = methodEl ? methodEl.value : 'random';
        const volatility = parseFloat(document.getElementById('mc_volatility').value) || 0.12;

        const btn = document.querySelector('button[onclick="app.optimizers.runMonteCarlo()"]');
        if(btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Running...';
            btn.disabled = true;
        }

        const startYear = new Date().getFullYear();

        if (window.Worker) {
            const worker = new Worker('worker.js');
            
            const workerData = this.app.getEngineData();
            workerData.simulations = SIMULATIONS;
            workerData.method = method;
            workerData.volatility = volatility;
            workerData.sp500 = this.app.SP500_HISTORICAL;
            workerData.totalDebt = this.app.data.getTotalDebt();

            worker.postMessage(workerData);
            
            worker.onmessage = (e) => {
                const trajectories = e.data.trajectories;
                this.processMonteCarloChart(trajectories, startYear);
                
                if(btn) {
                    btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i> Run Monte Carlo';
                    btn.disabled = false;
                }
                worker.terminate();
            };
            
            worker.onerror = (error) => {
                console.error('Worker error:', error);
                alert("An error occurred during the simulation. Check the console for details.");
                if(btn) {
                    btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i> Run Monte Carlo';
                    btn.disabled = false;
                }
                worker.terminate();
            };
        } else {
            alert("Your browser doesn't support background processing (Web Workers). The simulation cannot run.");
            if(btn) {
                btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i> Run Monte Carlo';
                btn.disabled = false;
            }
        }
    }

    processMonteCarloChart(trajectories, startYear) {
        trajectories.sort((a, b) => a[a.length - 1] - b[b.length - 1]);

        const runs = trajectories.length;
        const p10Idx = Math.floor(runs * 0.10);
        const p50Idx = Math.floor(runs * 0.50);
        const p90Idx = Math.floor(runs * 0.90);

        const p10Data = trajectories[p10Idx];
        const p50Data = trajectories[p50Idx];
        const p90Data = trajectories[p90Idx];

        const successCount = trajectories.filter(t => t[t.length-1] > 0).length;
        const successRate = ((successCount / runs) * 100).toFixed(1);

        const statsBox = document.getElementById('mc_stats_box');
        const rateEl = document.getElementById('mc_success_rate');
        if(statsBox && rateEl) {
            statsBox.style.display = 'block';
            rateEl.innerText = `${successRate}%`;
            statsBox.className = successRate >= 90 ? 'card p-3 border-success bg-success bg-opacity-10 text-center' : 
                               (successRate >= 75 ? 'card p-3 border-warning bg-warning bg-opacity-10 text-center' : 
                               'card p-3 border-danger bg-danger bg-opacity-10 text-center');
            rateEl.className = successRate >= 90 ? 'display-4 fw-bold text-success' : 
                             (successRate >= 75 ? 'display-4 fw-bold text-warning' : 
                             'display-4 fw-bold text-danger');
        }

        const ctx = document.getElementById('chartMonteCarlo').getContext('2d');
        const labels = p50Data.map((_, i) => startYear + i);

        if(this.app.charts.mc) this.app.charts.mc.destroy(); 

        this.app.charts.mc = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Optimistic (Top 10%)',
                        data: p90Data,
                        borderColor: '#10b981', 
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Median Outcome',
                        data: p50Data,
                        borderColor: '#3b82f6', 
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Pessimistic (Bottom 10%)',
                        data: p10Data,
                        borderColor: '#ef4444', 
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Zero Line',
                        data: Array(labels.length).fill(0),
                        borderColor: '#666', 
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#888' } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { 
                        grid: { color: '#333' }, 
                        ticks: { color: '#888', callback: (val) => '$' + (val/1000000).toFixed(1) + 'M' } 
                    }
                }
            }
        });
    }
    // ---------------- MONTE CARLO ENGINE END ---------------- //
}
