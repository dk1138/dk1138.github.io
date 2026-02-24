/**
 * Retirement Planner Pro - Optimizers Controller
 * Handles advanced simulations like Monte Carlo, Die With Zero, RRSP Optimization, and The Smith Maneuver.
 */
class Optimizers {
    constructor(app) {
        this.app = app;
        this.currentOptPerson = 'p1';
        this.smChartInstance = null;
    }

    // ---------------- SMART OPTIMIZERS START ---------------- //

    // --- CPP SMART IMPORTER & ANALYZER (Today's Dollars) ---
    
    // Opens the modal and pre-fills user inputs from the active plan
    openCPPModal() {
        document.getElementById('cppTargetPlayer').value = 'p1';
        this.updateCPPModalDefaults('p1');
        const modalEl = document.getElementById('cppAnalyzerModal');
        let m = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        m.show();
    }

    // Updates the inputs if the user switches from P1 to P2
    updateCPPModalDefaults(player) {
        const retAge = this.app.getVal(`${player}_retireAge`) || 65;
        const inc = this.app.getVal(`${player}_income`) || 0;
        
        const ageEl = document.getElementById('cppTargetAge');
        const salEl = document.getElementById('cppFutureSalary');
        
        if (ageEl) ageEl.value = retAge;
        if (salEl) salEl.value = inc.toLocaleString();
        
        const res = document.getElementById('cppResultsArea');
        if (res) res.style.display = 'none';
    }

    runCPPImporter() {
        const rawText = document.getElementById('cppPasteArea').value;
        const targetPlayer = document.getElementById('cppTargetPlayer').value;
        const targetRetAge = parseInt(document.getElementById('cppTargetAge').value) || 65;
        const futureSalaryStr = document.getElementById('cppFutureSalary').value;
        const futureSalary = Number(futureSalaryStr.replace(/,/g, '')) || 0;

        const resultsArea = document.getElementById('cppResultsArea');

        if (!rawText || rawText.trim() === '') {
            alert('Please paste your Service Canada table data.');
            return;
        }

        try {
            const cpp = new CPPEngine();
            const records = cpp.parseServiceCanadaText(rawText);

            if (records.length === 0) {
                alert('Could not detect any valid data. Ensure you copied the full earnings table.');
                return;
            }

            const dobRaw = this.app.getRaw(`${targetPlayer}_dob`);
            if (!dobRaw) {
                alert('Please set a Date of Birth for this player in the Personal Information section first.');
                return;
            }

            const birthYear = parseInt(dobRaw.split('-')[0]);
            const currentYear = new Date().getFullYear();

            let lifetime = [...records];
            let existingYears = new Set(lifetime.map(r => r.year));

            // 1. Fill past gaps with $0
            for (let y = birthYear + 18; y < currentYear; y++) {
                if (!existingYears.has(y)) lifetime.push({ year: y, earnings: 0 });
            }

            // 2. Project future years until age 65
            // Note: We use 0% inflation here because we want the ratio in "Real" terms
            for (let y = currentYear; y < birthYear + 65; y++) {
                let isWorking = y < (birthYear + targetRetAge);
                let appliedSalary = isWorking ? futureSalary : 0;
                if (!existingYears.has(y)) {
                    lifetime.push({ year: y, earnings: appliedSalary, isProjected: true });
                }
                // Maintain YMPE at current level for Today's Dollar baseline
                if (!cpp.YMPE[y]) cpp.YMPE[y] = cpp.YMPE[2026];
                if (!cpp.YAMPE[y]) cpp.YAMPE[y] = cpp.YAMPE[2026];
            }

            lifetime.sort((a, b) => a.year - b.year);

            // 3. Calculate Base AND Enhanced CPP at age 65
            const startPensionYear = birthYear + 65;
            const baseResult = cpp.calculateBaseCPP(lifetime, birthYear, startPensionYear, []);

            // To keep it strictly in Today's Dollars, we force the calculation 
            // to use the 2026 Average YMPE ($69,120) instead of the actual inflated future one
            const todayAvgYMPE = 69120; 
            const baseMonthlyToday = (todayAvgYMPE * 0.25 * baseResult.averageRatio) / 12;

            // Calculate Enhancements using Today's YMPE
            const enhancedResult = cpp.calculateEnhancedCPP(lifetime, startPensionYear, todayAvgYMPE);

            const totalMonthly = baseMonthlyToday + enhancedResult.totalMonthlyEnhancement;
            const totalAnnual = totalMonthly * 12;

            const fmt = n => '$' + Math.round(n).toLocaleString();

            let infoBtn = `<i class="bi bi-info-circle text-muted ms-2 info-btn" style="cursor: help; font-size: 0.9rem;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-title="Today's Dollars" data-bs-content="This estimate is strictly in <b>Today's Dollars</b>, calculated using current Maximum Pensionable Earnings (YMPE) limits.<br><br>This aligns perfectly with your plan's 'Today\\'s $' settings, ensuring your projection engine doesn't double-count inflation."></i>`;
            let contribInfo = `<i class="bi bi-info-circle text-muted ms-1 info-btn" style="cursor: help; font-size: 0.8rem;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-title="Contributory Years" data-bs-content="The total number of years from age 18 to age 65."></i>`;
            let dropInfo = `<i class="bi bi-info-circle text-muted ms-1 info-btn" style="cursor: help; font-size: 0.8rem;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-title="General Drop-out (17%)" data-bs-content="The CRA automatically removes up to 17% of your lowest-earning years (roughly 8 years) from the base calculation to boost your final average."></i>`;
            let ratioInfo = `<i class="bi bi-info-circle text-muted ms-1 info-btn" style="cursor: help; font-size: 0.8rem;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-title="Lifetime Earnings Ratio" data-bs-content="Your lifetime average earnings compared to the maximum limits (YMPE) after all drop-outs are applied. A ratio of 100% means you maxed out your contributions every single year."></i>`;

            let html = `
                <h6 class="text-success fw-bold mb-3"><i class="bi bi-check-circle-fill me-2"></i>Analysis Complete</h6>
                
                <div class="row g-3 mb-3 text-white small">
                    <div class="col-6 d-flex align-items-center"><b>Contributory Years:</b> <span class="ms-2">${Math.round(baseResult.monthsContributoryTotal/12)}</span> ${contribInfo}</div>
                    <div class="col-6 d-flex align-items-center"><b>Years Dropped (17%):</b> <span class="ms-2">${baseResult.droppedGeneralYears}</span> ${dropInfo}</div>
                    <div class="col-12 d-flex align-items-center border-top border-secondary pt-2 mt-2"><b>Earnings Ratio (Base):</b> <span class="ms-2">${(baseResult.averageRatio * 100).toFixed(1)}%</span> ${ratioInfo}</div>
                </div>

                <div class="card bg-black bg-opacity-25 border-secondary p-3 mb-3 small">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Base CPP (Pre-2019 Rules):</span>
                        <span class="text-white">${fmt(baseMonthlyToday * 12)}/yr</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Phase 1 Enhancement (2019-2023):</span>
                        <span class="text-info">+${fmt(enhancedResult.monthlyPhase1 * 12)}/yr</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Phase 2 Enhancement (2024+):</span>
                        <span class="text-info">+${fmt(enhancedResult.monthlyPhase2 * 12)}/yr</span>
                    </div>
                </div>
                
                <div class="card bg-info bg-opacity-10 border-info border-opacity-50 p-3 text-center mb-3">
                    <div class="small fw-bold text-info text-uppercase ls-1 mb-1 d-flex justify-content-center align-items-center">
                        Total Baseline at Age 65 ${infoBtn}
                    </div>
                    <div class="display-6 fw-bold text-white">${fmt(totalAnnual)}<span class="fs-5 text-muted fw-normal">/yr</span></div>
                </div>

                <button class="btn btn-primary w-100 fw-bold py-3 fs-5" onclick="app.optimizers.applyCPPEstimate('${targetPlayer}', ${totalAnnual})">
                    <i class="bi bi-arrow-right-circle-fill me-2"></i>Apply ${fmt(totalAnnual)} to Plan
                </button>
            `;

            resultsArea.innerHTML = html;
            resultsArea.style.display = 'block';
            
            // Re-initialize popovers for the dynamically generated HTML
            setTimeout(() => { try { this.app.ui.initPopovers(); } catch(e){} }, 50);

        } catch (err) {
            console.error(err);
            alert("Error calculating CPP. Check console for details.");
        }
    }

    applyCPPEstimate(player, amount) {
        const el = document.getElementById(`${player}_cpp_est_base`);
        if (el) {
            // Update the input field
            el.value = Math.round(amount).toLocaleString();
            this.app.state.inputs[`${player}_cpp_est_base`] = Math.round(amount);
            
            // Enable the CPP toggle if it was off
            const toggle = document.getElementById(`${player}_cpp_enabled`);
            if (toggle && !toggle.checked) {
                toggle.checked = true;
                this.app.state.inputs[`${player}_cpp_enabled`] = true;
                this.app.ui.updateBenefitVisibility();
            }

            // Run main engine
            this.app.run();
            
            // Close the modal
            const modalEl = document.getElementById('cppAnalyzerModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            
            // Auto switch to inputs tab and scroll to CPP section
            const planTab = document.querySelector('button[data-bs-target="#plan-pane"]');
            if(planTab) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    bootstrap.Tab.getOrCreateInstance(planTab).show();
                } else {
                    planTab.click();
                }
                setTimeout(() => { 
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                    // Add a visual flash effect to show it updated
                    el.classList.add('bg-success', 'text-white');
                    setTimeout(() => el.classList.remove('bg-success', 'text-white'), 1000);
                }, 300);
            }
        }
    }

    // --- DIE WITH ZERO ---
    runDieWithZero() {
        const btn = document.getElementById('btnRunDwZ');
        if(btn) { btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculating...'; btn.disabled = true; }

        setTimeout(() => {
            const engine = new FinanceEngine(this.app.getEngineData());
            const baseResult = engine.runSimulation(false, null);
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
                let res = testEngine.runSimulation(false, { expenseMultiplier: mid });
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
                let res = testEngine.runSimulation(false, null);
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

    runRRSPGrossUpOptimizer() {
        const modalContainer = document.getElementById('rrspGrossUpResults');
        if (!modalContainer) return;

        let html = `
            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
                <ul class="nav nav-pills mb-2 mb-md-0" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#opt-gross-tab" type="button" role="tab" onclick="app.optimizers.calcRRSPGrossUpFor('p1')">Player 1</button>
                    </li>
                    ${this.app.state.mode === 'Couple' ? `<li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#opt-gross-tab" type="button" role="tab" onclick="app.optimizers.calcRRSPGrossUpFor('p2')">Player 2</button></li>` : ''}
                </ul>
            </div>
            <div class="mb-4 bg-black bg-opacity-25 p-3 rounded border border-secondary d-flex flex-wrap gap-3 align-items-center">
                <div>
                    <label class="form-label small text-info fw-bold mb-1">Available RRSP Room</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                        <input type="number" class="form-control border-secondary" id="opt_gross_room" value="50000" style="max-width: 150px;" oninput="app.optimizers.calcRRSPGrossUpFor(app.optimizers.currentOptPerson)">
                    </div>
                </div>
                <div>
                    <label class="form-label small text-success fw-bold mb-1">Cash Available to Contribute</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                        <input type="number" class="form-control border-secondary" id="opt_gross_cash" value="10000" style="max-width: 150px;" oninput="app.optimizers.calcRRSPGrossUpFor(app.optimizers.currentOptPerson)">
                    </div>
                </div>
            </div>
            <div id="opt-gross-tab-content">
            </div>
        `;
        modalContainer.innerHTML = html;
        this.currentOptPerson = 'p1';
        this.calcRRSPGrossUpFor('p1');

        let mEl = document.getElementById('rrspGrossUpModal');
        if(mEl) {
            let m = bootstrap.Modal.getInstance(mEl) || new bootstrap.Modal(mEl);
            m.show();
        }
    }

    calcRRSPGrossUpFor(pfx) {
        this.currentOptPerson = pfx;
        const container = document.getElementById('opt-gross-tab-content');
        if(!container) return;

        const engine = new FinanceEngine(this.app.getEngineData());
        const taxBrackets = engine.getInflatedTaxData(1);
        const prov = this.app.getRaw('tax_province');
        const currentYear = new Date().getFullYear();

        let maxRoom = parseFloat(document.getElementById('opt_gross_room')?.value) || 0;
        let cash = parseFloat(document.getElementById('opt_gross_cash')?.value) || 0;

        if (cash <= 0) {
            container.innerHTML = `<div class="p-3 text-muted">Please enter the cash amount you have available to contribute.</div>`;
            return;
        }

        // Determine Base Incomes 
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
        let startingTaxableInc = Math.max(0, targetData.gross - targetData.rrspDeduct);

        if (startingTaxableInc <= 0) {
            container.innerHTML = `<div class="p-3 text-muted">No taxable income to optimize.</div>`;
            return;
        }

        let baseTax = engine.calculateTaxDetailed(startingTaxableInc, prov, taxBrackets);
        
        // Calculate Standard scenario (just contributing cash)
        let standardTax = engine.calculateTaxDetailed(Math.max(0, startingTaxableInc - cash), prov, taxBrackets);
        let standardRefund = baseTax.totalTax - standardTax.totalTax;

        // Calculate Gross-Up scenario via binary search
        let maxT = Math.min(startingTaxableInc, maxRoom);
        let bestT = cash;
        let bestLoan = 0;
        let bestRefund = standardRefund;

        let low = cash;
        let high = maxT;
        
        for (let i = 0; i < 50; i++) {
            let mid = (low + high) / 2;
            let testTax = engine.calculateTaxDetailed(startingTaxableInc - mid, prov, taxBrackets);
            let testRefund = baseTax.totalTax - testTax.totalTax;
            let requiredLoan = mid - cash;

            if (testRefund >= requiredLoan) {
                bestT = mid;
                bestLoan = requiredLoan;
                bestRefund = testRefund;
                low = mid;
            } else {
                high = mid;
            }
            if (high - low < 1) break; 
        }
        
        bestT = Math.floor(bestT);
        bestLoan = bestT - cash;
        let finalTax = engine.calculateTaxDetailed(startingTaxableInc - bestT, prov, taxBrackets);
        bestRefund = baseTax.totalTax - finalTax.totalTax;

        if (bestRefund < bestLoan) {
            bestT -= 1;
            bestLoan = bestT - cash;
            let adjTax = engine.calculateTaxDetailed(startingTaxableInc - bestT, prov, taxBrackets);
            bestRefund = baseTax.totalTax - adjTax.totalTax;
        }

        let effRate = bestT > 0 ? (bestRefund / bestT) * 100 : 0;
        let margRate = (baseTax.margRate || 0) * 100;
        let finalMargRate = (finalTax.margRate || 0) * 100;

        let mathBreakdownHtml = `
            <div class="card bg-black bg-opacity-25 border-secondary mt-4 shadow-sm">
                <div class="card-header border-secondary text-info fw-bold small text-uppercase ls-1">
                    <i class="bi bi-calculator me-2"></i>Behind the Math (Tax Bracket Breakdown)
                </div>
                <div class="card-body p-3 small text-muted">
                    <div class="row mb-2">
                        <div class="col-6"><strong>Starting Taxable Income:</strong></div>
                        <div class="col-6 text-end text-white">$${Math.round(startingTaxableInc).toLocaleString()}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-6"><strong>Starting Marginal Tax Rate:</strong></div>
                        <div class="col-6 text-end text-white">${margRate.toFixed(1)}%</div>
                    </div>
                    <div class="row mb-2 pb-2 border-bottom border-secondary">
                        <div class="col-6"><strong>Total Contribution:</strong></div>
                        <div class="col-6 text-end text-info">-$${Math.round(bestT).toLocaleString()}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-6"><strong>New Taxable Income:</strong></div>
                        <div class="col-6 text-end text-white">$${Math.round(startingTaxableInc - bestT).toLocaleString()}</div>
                    </div>
                    <div class="row mb-2 pb-2 border-bottom border-secondary">
                        <div class="col-6"><strong>Ending Marginal Tax Rate:</strong></div>
                        <div class="col-6 text-end text-white">${finalMargRate.toFixed(1)}%</div>
                    </div>
                    <div class="row mb-2 mt-2">
                        <div class="col-8"><strong>Total Tax Refund Generated:</strong></div>
                        <div class="col-4 text-end text-success fw-bold">+$${Math.round(bestRefund).toLocaleString()}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-8"><strong>Effective Refund Rate on Deposit:</strong></div>
                        <div class="col-4 text-end text-success fw-bold">${effRate.toFixed(1)}%</div>
                    </div>
                    <div class="alert alert-secondary bg-transparent border-secondary mt-3 mb-0 p-2" style="font-size: 0.75rem;">
                        <strong>How it works:</strong> The algorithm finds the exact loan amount where:<br>
                        <code class="text-white">Tax Refund Generated &ge; Loan Amount</code><br><br>
                        It calculates your taxes precisely using progressive tax brackets, meaning if your large contribution drops you into a lower tax bracket, the algorithm automatically adjusts the loan downwards so you don't get stuck with leftover debt.
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="row g-4 mt-2">
                <div class="col-md-6">
                    <div class="card bg-black bg-opacity-25 border-secondary h-100">
                        <div class="card-header border-secondary text-muted fw-bold small text-uppercase ls-1">Standard Method</div>
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between mb-2"><span>Cash Contributed</span> <span class="fw-bold text-white">$${Math.round(cash).toLocaleString()}</span></div>
                            <div class="d-flex justify-content-between mb-2"><span>RRSP Loan</span> <span class="fw-bold text-white">$0</span></div>
                            <div class="d-flex justify-content-between mb-2 pt-2 border-top border-secondary"><span>Total RRSP Deposit</span> <span class="fw-bold text-info">$${Math.round(cash).toLocaleString()}</span></div>
                            <div class="d-flex justify-content-between mt-3 text-success"><span>Tax Refund Generated</span> <span class="fw-bold">+$${Math.round(standardRefund).toLocaleString()}</span></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-info bg-opacity-10 border-info h-100">
                        <div class="card-header border-info text-info fw-bold small text-uppercase ls-1"><i class="bi bi-rocket-takeoff me-2"></i>Gross-Up Method</div>
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between mb-2"><span>Cash Contributed</span> <span class="fw-bold text-white">$${Math.round(cash).toLocaleString()}</span></div>
                            <div class="d-flex justify-content-between mb-2"><span class="text-warning">Short-Term Loan</span> <span class="fw-bold text-warning">+$${Math.round(bestLoan).toLocaleString()}</span></div>
                            <div class="d-flex justify-content-between mb-2 pt-2 border-top border-info text-info"><span class="fw-bold">Total RRSP Deposit</span> <span class="fw-bold fs-5">$${Math.round(bestT).toLocaleString()}</span></div>
                            <div class="d-flex justify-content-between mt-3 text-success"><span>Tax Refund (Pays off loan)</span> <span class="fw-bold">+$${Math.round(bestRefund).toLocaleString()}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert mt-4 border-success bg-success bg-opacity-10 text-white shadow-sm">
                <h6 class="fw-bold mb-2 text-success"><i class="bi bi-graph-up-arrow me-2"></i>The Gross-Up Advantage</h6>
                <p class="small mb-0">By taking a short-term RRSP loan of <strong>$${Math.round(bestLoan).toLocaleString()}</strong> in February, your tax refund will entirely pay it off by April/May. This gets <strong>$${Math.round(bestT - cash).toLocaleString()}</strong> more compounding in your RRSP immediately compared to the standard method.</p>
                ${bestT >= maxRoom ? `<p class="small text-warning mt-2 mb-0"><i class="bi bi-exclamation-triangle me-1"></i> You maxed out your available RRSP room. You could potentially gross-up more if you had more room.</p>` : ''}
            </div>

            ${mathBreakdownHtml}
        `;
    }

    runSmithManeuverOptimizer() {
        const modalContainer = document.getElementById('smithManeuverResults');
        if (!modalContainer) return;

        let defaultMortgage = 430000;
        let defaultRate = 3.29; 
        
        let html = `
            <div class="row g-4">
                <div class="col-lg-4 border-end border-secondary pe-lg-4">
                    <h6 class="text-info fw-bold text-uppercase ls-1 mb-3">1. Property & Mortgage</h6>
                    <div class="mb-3">
                        <label class="form-label small text-muted mb-1">Current Home Value</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                            <input type="number" class="form-control border-secondary" id="sm_home_val" value="800000" oninput="app.optimizers.calcSmithManeuver()">
                        </div>
                        <div class="form-text text-muted" style="font-size: 0.65rem;">Used to calculate 65% HELOC limits.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small text-muted mb-1">Mortgage Balance</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                            <input type="number" class="form-control border-secondary" id="sm_mortgage" value="${defaultMortgage}" oninput="app.optimizers.calcSmithManeuver()">
                        </div>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">Mortgage (%)</label>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.01" class="form-control border-secondary" id="sm_mortgage_rate" value="${defaultRate}" oninput="app.optimizers.calcSmithManeuver()">
                                <span class="input-group-text bg-transparent border-secondary text-muted">%</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">Amort. (Yrs)</label>
                            <input type="number" class="form-control form-control-sm border-secondary" id="sm_amortization" value="20" oninput="app.optimizers.calcSmithManeuver()">
                        </div>
                    </div>

                    <h6 class="text-warning fw-bold text-uppercase ls-1 mb-3 pt-3 border-top border-secondary">2. Financial Rates</h6>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">HELOC Rate (%)</label>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.1" class="form-control border-secondary" id="sm_heloc_rate" value="7.2" oninput="app.optimizers.calcSmithManeuver()">
                                <span class="input-group-text bg-transparent border-secondary text-muted">%</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">Invest Return (%)</label>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.1" class="form-control border-secondary" id="sm_invest_return" value="8.0" oninput="app.optimizers.calcSmithManeuver()">
                                <span class="input-group-text bg-transparent border-secondary text-muted">%</span>
                            </div>
                        </div>
                    </div>
                    <div class="row g-2 mb-4">
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">Marginal Tax (%)</label>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.1" class="form-control border-secondary" id="sm_tax_rate" value="43.4" oninput="app.optimizers.calcSmithManeuver()">
                                <span class="input-group-text bg-transparent border-secondary text-muted">%</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="form-label small text-muted mb-1">Prop. Growth (%)</label>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.1" class="form-control border-secondary" id="sm_prop_growth" value="3.0" oninput="app.optimizers.calcSmithManeuver()">
                                <span class="input-group-text bg-transparent border-secondary text-muted">%</span>
                            </div>
                        </div>
                    </div>

                    <h6 class="text-success fw-bold text-uppercase ls-1 mb-3 pt-3 border-top border-secondary">3. Strategy Settings</h6>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input mt-1" type="checkbox" id="sm_use_accelerator" checked onchange="app.optimizers.calcSmithManeuver()">
                        <label class="form-check-label small text-white fw-bold" for="sm_use_accelerator">Use "Accelerator" Method</label>
                        <div class="form-text text-muted" style="font-size: 0.65rem;">Applies tax refunds as a lump sum to the mortgage, freeing up more HELOC room instantly.</div>
                    </div>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input mt-1" type="checkbox" id="sm_use_day1" onchange="app.optimizers.calcSmithManeuver()">
                        <label class="form-check-label small text-white fw-bold" for="sm_use_day1">Deploy Initial Equity Day-1</label>
                        <div class="form-text text-muted" style="font-size: 0.65rem;">Immediately borrows all available 65% LTV HELOC room on Day 1 to invest.</div>
                    </div>
                    
                    <div class="mb-3 pt-3 border-top border-secondary mt-3">
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input mt-1 border-info" type="checkbox" id="sm_use_cash_damming" onchange="document.getElementById('sm_cash_dam_wrap').style.display = this.checked ? 'block' : 'none'; app.optimizers.calcSmithManeuver();">
                            <label class="form-check-label small text-info fw-bold" for="sm_use_cash_damming">Enable Cash Damming</label>
                            <div class="form-text text-muted" style="font-size: 0.65rem;">Redirect gross business/rental income to pay down the mortgage, while borrowing expenses from the HELOC.</div>
                        </div>
                        <div id="sm_cash_dam_wrap" style="display:none;" class="ps-4">
                            <label class="form-label small text-muted mb-1">Annual Expenses to Dam</label>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-transparent border-secondary text-muted">$</span>
                                <input type="number" class="form-control border-secondary" id="sm_cash_dam_amt" value="24000" oninput="app.optimizers.calcSmithManeuver()">
                            </div>
                        </div>
                    </div>

                </div>
                <div class="col-lg-8 ps-lg-4 position-relative">
                    <ul class="nav nav-tabs border-secondary mb-3" id="sm-tabs" role="tablist">
                      <li class="nav-item" role="presentation">
                        <button class="nav-link active bg-transparent text-white border-0 fw-bold border-bottom border-primary" style="border-radius:0;" id="sm-summary-tab" data-bs-toggle="tab" data-bs-target="#sm-summary" type="button" role="tab">Summary & Chart</button>
                      </li>
                      <li class="nav-item" role="presentation">
                        <button class="nav-link bg-transparent text-muted border-0 fw-bold" style="border-radius:0;" id="sm-data-tab" data-bs-toggle="tab" data-bs-target="#sm-data" type="button" role="tab" onclick="this.classList.replace('text-muted','text-white'); this.classList.add('border-bottom','border-primary'); document.getElementById('sm-summary-tab').classList.replace('text-white','text-muted'); document.getElementById('sm-summary-tab').classList.remove('border-bottom','border-primary');">Yearly Data Table</button>
                      </li>
                    </ul>
                    
                    <div class="tab-content" id="sm-tabContent">
                        <div class="tab-pane fade show active" id="sm-summary" role="tabpanel">
                            <div id="sm-results-chart-container"></div>
                        </div>
                        <div class="tab-pane fade" id="sm-data" role="tabpanel">
                            <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                                <table class="table table-dark table-sm table-striped table-hover mt-2" style="font-size: 0.8rem;">
                                    <thead class="sticky-top bg-black">
                                        <tr>
                                            <th class="text-secondary text-uppercase border-secondary">Year</th>
                                            <th class="text-secondary text-uppercase border-secondary">Home Val</th>
                                            <th class="text-secondary text-uppercase border-secondary text-danger" title="Standard Method Mortgage">Std Mort.</th>
                                            <th class="text-secondary text-uppercase border-secondary text-warning" title="Smith Maneuver Mortgage">SM Mort.</th>
                                            <th class="text-secondary text-uppercase border-secondary text-danger">SM HELOC</th>
                                            <th class="text-secondary text-uppercase border-secondary text-info">SM Portfolio</th>
                                            <th class="text-secondary text-uppercase border-secondary text-success">Net Benefit</th>
                                        </tr>
                                    </thead>
                                    <tbody id="sm-table-body">
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modalContainer.innerHTML = html;
        
        const summaryTab = document.getElementById('sm-summary-tab');
        const dataTab = document.getElementById('sm-data-tab');
        
        if (summaryTab && dataTab) {
            summaryTab.addEventListener('click', () => {
                summaryTab.classList.replace('text-muted', 'text-white');
                summaryTab.classList.add('border-bottom', 'border-primary');
                dataTab.classList.replace('text-white', 'text-muted');
                dataTab.classList.remove('border-bottom', 'border-primary');
            });
        }

        this.calcSmithManeuver();

        let mEl = document.getElementById('smithManeuverModal');
        if(mEl) {
            let m = bootstrap.Modal.getInstance(mEl) || new bootstrap.Modal(mEl);
            m.show();
        }
    }

    calcSmithManeuver() {
        const chartContainer = document.getElementById('sm-results-chart-container');
        const tableBody = document.getElementById('sm-table-body');
        if(!chartContainer || !tableBody) return;

        let homeVal = parseFloat(document.getElementById('sm_home_val')?.value) || 0;
        let propGrowth = (parseFloat(document.getElementById('sm_prop_growth')?.value) || 0) / 100;
        let balMortgage = parseFloat(document.getElementById('sm_mortgage')?.value) || 0;
        let amortYears = parseInt(document.getElementById('sm_amortization')?.value) || 0;
        let rateMortgage = (parseFloat(document.getElementById('sm_mortgage_rate')?.value) || 0) / 100;
        let rateHeloc = (parseFloat(document.getElementById('sm_heloc_rate')?.value) || 0) / 100;
        let rateInvest = (parseFloat(document.getElementById('sm_invest_return')?.value) || 0) / 100;
        let taxRate = (parseFloat(document.getElementById('sm_tax_rate')?.value) || 0) / 100;
        
        let useAccelerator = document.getElementById('sm_use_accelerator')?.checked || false;
        let useDay1 = document.getElementById('sm_use_day1')?.checked || false;
        
        let useCashDam = document.getElementById('sm_use_cash_damming')?.checked || false;
        let annualCashDamAmt = parseFloat(document.getElementById('sm_cash_dam_amt')?.value) || 0;
        let monthlyCashDam = useCashDam ? (annualCashDamAmt / 12) : 0;

        if (balMortgage <= 0 || amortYears <= 0 || homeVal <= 0) {
            chartContainer.innerHTML = `<div class="text-muted p-3">Please enter valid property and mortgage details to run the simulation.</div>`;
            return;
        }

        let monthlyMortgageRate = rateMortgage / 12;
        let numPayments = amortYears * 12;
        let payment = 0;
        if (monthlyMortgageRate > 0) {
            payment = balMortgage * (monthlyMortgageRate * Math.pow(1 + monthlyMortgageRate, numPayments)) / (Math.pow(1 + monthlyMortgageRate, numPayments) - 1);
        } else {
            payment = balMortgage / numPayments;
        }

        let stdMortgage = balMortgage;
        let stdPortfolio = 0;

        let smMortgage = balMortgage;
        let smHeloc = 0;
        let smPortfolio = 0;
        let currentPropVal = homeVal;
        
        let totalTaxRefunds = 0;
        let totalInterestPaid = 0;
        let currentYearInterest = 0;

        let chartLabels = ['Start'];
        let chartDataStandard = [0];
        let chartDataSM = [0];
        let tableData = [];

        if (useDay1) {
            let maxTotalDebt = currentPropVal * 0.80;
            let maxHelocLimit = currentPropVal * 0.65;
            let initialAvail = Math.max(0, Math.min(maxTotalDebt - smMortgage, maxHelocLimit));
            smHeloc += initialAvail;
            smPortfolio += initialAvail;
        }

        tableData.push({
            year: 0,
            home: currentPropVal,
            stdMort: stdMortgage,
            smMort: smMortgage,
            smHeloc: smHeloc,
            smPort: smPortfolio,
            netBen: 0
        });

        let smMortgagePaidOffMonth = 0;
        let stdMortgagePaidOffMonth = 0;

        for (let m = 1; m <= numPayments; m++) {
            
            currentPropVal += currentPropVal * (propGrowth / 12);

            if (stdMortgage > 0) {
                let stdInterest = stdMortgage * monthlyMortgageRate;
                let stdPrincipal = payment - stdInterest;
                if (stdPrincipal > stdMortgage) {
                    stdPrincipal = stdMortgage;
                    if(stdMortgagePaidOffMonth === 0) stdMortgagePaidOffMonth = m;
                }
                stdMortgage -= stdPrincipal;
            } else {
                if(stdMortgagePaidOffMonth === 0) stdMortgagePaidOffMonth = m;
                stdPortfolio += payment;
            }
            stdPortfolio += stdPortfolio * (rateInvest / 12);

            let maxTotalDebt = currentPropVal * 0.80;
            let maxHelocLimit = currentPropVal * 0.65;

            if (smMortgage > 0) {
                let smInterest = smMortgage * monthlyMortgageRate;
                let smPrincipal = payment - smInterest;
                if (smPrincipal > smMortgage) {
                    smPrincipal = smMortgage;
                    if(smMortgagePaidOffMonth === 0) smMortgagePaidOffMonth = m;
                }
                smMortgage -= smPrincipal;

                let availHeloc = Math.max(0, Math.min(maxTotalDebt - smMortgage, maxHelocLimit) - smHeloc);
                let borrowInvest = Math.min(smPrincipal, availHeloc);
                smHeloc += borrowInvest;
                smPortfolio += borrowInvest;

                if (useCashDam && monthlyCashDam > 0 && smMortgage > 0) {
                    let damRoom = Math.max(0, Math.min(maxTotalDebt - smMortgage, maxHelocLimit) - smHeloc);
                    let actualDam = Math.min(monthlyCashDam, damRoom, smMortgage);
                    
                    smMortgage -= actualDam;
                    smHeloc += actualDam;
                }

            } else {
                if(smMortgagePaidOffMonth === 0) smMortgagePaidOffMonth = m;
                
                let helocPaydown = Math.min(payment, smHeloc);
                smHeloc -= helocPaydown;
                if (payment > helocPaydown) smPortfolio += (payment - helocPaydown);
            }

            let helocMonthlyInterest = smHeloc * (rateHeloc / 12);
            currentYearInterest += helocMonthlyInterest;
            totalInterestPaid += helocMonthlyInterest;
            
            let roomForInterest = Math.max(0, Math.min(maxTotalDebt - smMortgage, maxHelocLimit) - smHeloc);
            let interestBorrowed = Math.min(helocMonthlyInterest, roomForInterest);
            smHeloc += interestBorrowed;
            
            let interestOutOfPocket = helocMonthlyInterest - interestBorrowed;
            if (interestOutOfPocket > 0) smPortfolio -= interestOutOfPocket;

            smPortfolio += smPortfolio * (rateInvest / 12);

            if (m % 12 === 0 || m === numPayments) {
                let refund = currentYearInterest * taxRate;
                totalTaxRefunds += refund;
                
                if (useAccelerator && smMortgage > 0) {
                    let lumpSum = Math.min(smMortgage, refund);
                    smMortgage -= lumpSum;
                    
                    let newRoom = Math.max(0, Math.min(maxTotalDebt - smMortgage, maxHelocLimit) - smHeloc);
                    let accelBorrow = Math.min(lumpSum, newRoom);
                    smHeloc += accelBorrow;
                    smPortfolio += accelBorrow;

                    if (refund > lumpSum) {
                        smPortfolio += (refund - lumpSum);
                    }
                } else if (useAccelerator && smMortgage <= 0) {
                    smHeloc -= Math.min(smHeloc, refund);
                } else {
                    smPortfolio += refund;
                }
                
                currentYearInterest = 0;

                let year = Math.ceil(m / 12);
                let stdNetEquity = currentPropVal - stdMortgage + stdPortfolio;
                let smNetEquity = currentPropVal - smMortgage - smHeloc + smPortfolio;
                let netBenefit = smNetEquity - stdNetEquity;

                chartLabels.push("Year " + year);
                chartDataStandard.push(0); 
                chartDataSM.push(Math.round(netBenefit));

                tableData.push({
                    year: year,
                    home: currentPropVal,
                    stdMort: stdMortgage,
                    smMort: smMortgage,
                    smHeloc: smHeloc,
                    smPort: smPortfolio,
                    netBen: netBenefit
                });
            }
        }

        let finalNetBenefit = chartDataSM[chartDataSM.length - 1];

        let html = `
            <div class="row mb-4 g-3 mt-1">
                <div class="col-6">
                    <div class="card bg-black bg-opacity-25 border-secondary h-100 p-3 text-center">
                        <div class="small text-muted text-uppercase fw-bold ls-1 mb-1">Standard Method</div>
                        <div class="fs-3 fw-bold text-white">$0</div>
                        <div class="small text-muted">Net Wealth Advantage</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-primary bg-opacity-10 border-primary h-100 p-3 text-center position-relative overflow-hidden">
                        <div class="small text-primary text-uppercase fw-bold ls-1 mb-1"><i class="bi bi-arrow-repeat me-1"></i>Smith Maneuver</div>
                        <div class="fs-3 fw-bold ${finalNetBenefit >= 0 ? 'text-success' : 'text-danger'}">
                            ${finalNetBenefit >= 0 ? '+' : ''}$${Math.round(finalNetBenefit).toLocaleString()}
                        </div>
                        <div class="small text-muted">Net Wealth Advantage</div>
                    </div>
                </div>
            </div>

            <div class="row mb-4 g-3 text-muted small">
                <div class="col-md-3">
                    <div class="p-2 border border-secondary rounded bg-black bg-opacity-25 text-center">
                        <div class="fw-bold mb-1 text-white">Mortgage Gone</div>
                        <div class="text-info fs-6">${smMortgagePaidOffMonth > 0 ? `Year ${(smMortgagePaidOffMonth/12).toFixed(1)}` : 'N/A'}</div>
                        ${useCashDam && smMortgagePaidOffMonth > 0 && stdMortgagePaidOffMonth > 0 ? `<div style="font-size:0.65rem;" class="text-success mt-1">(${((stdMortgagePaidOffMonth - smMortgagePaidOffMonth)/12).toFixed(1)} yrs faster)</div>` : ''}
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-2 border border-secondary rounded bg-black bg-opacity-25 text-center">
                        <div class="fw-bold mb-1 text-white">Final Portfolio</div>
                        <div class="text-info fs-6">$${Math.round(smPortfolio).toLocaleString()}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-2 border border-secondary rounded bg-black bg-opacity-25 text-center">
                        <div class="fw-bold mb-1 text-white">Final HELOC</div>
                        <div class="text-danger fs-6">-$${Math.round(smHeloc).toLocaleString()}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-2 border border-secondary rounded bg-black bg-opacity-25 text-center">
                        <div class="fw-bold mb-1 text-white">Tax Refunds</div>
                        <div class="text-success fs-6">+$${Math.round(totalTaxRefunds).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div style="height: 250px; position: relative; width: 100%;">
                <canvas id="smChart"></canvas>
            </div>
            
            <div class="alert alert-secondary bg-transparent border-secondary mt-4 mb-0 p-3 small text-muted">
                <strong>How the math works:</strong> We compare your Net Equity (Home + Portfolio - All Debts) against a standard mortgage path. It accurately enforces the Canadian 65% HELOC / 80% Total Debt LTV rules. The "Accelerator" and "Cash Damming" methods rapidly convert your non-deductible mortgage into deductible debt, generating the massive wealth spread shown above.
            </div>
        `;

        chartContainer.innerHTML = html;

        let tableRows = '';
        tableData.forEach(row => {
            let mortPaid = row.smMort <= 0 && row.year > 0 && tableData[row.year-1] && tableData[row.year-1].smMort > 0;
            let rowClass = mortPaid ? 'table-primary fw-bold' : '';
            
            tableRows += `<tr class="${rowClass}">
                <td>${row.year === 0 ? 'Start' : row.year}</td>
                <td>$${Math.round(row.home).toLocaleString()}</td>
                <td class="${row.stdMort <= 0 ? 'text-success' : ''}">$${Math.round(row.stdMort).toLocaleString()}</td>
                <td class="${row.smMort <= 0 ? 'text-success' : ''}">$${Math.round(row.smMort).toLocaleString()} ${mortPaid ? '<i class="bi bi-check-circle ms-1"></i>' : ''}</td>
                <td>-$${Math.round(row.smHeloc).toLocaleString()}</td>
                <td>$${Math.round(row.smPort).toLocaleString()}</td>
                <td class="${row.netBen >= 0 ? 'text-success' : 'text-danger'}">${row.netBen >= 0 ? '+' : ''}$${Math.round(row.netBen).toLocaleString()}</td>
            </tr>`;
        });
        tableBody.innerHTML = tableRows;

        const ctx = document.getElementById('smChart').getContext('2d');
        if (this.smChartInstance) this.smChartInstance.destroy();

        this.smChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Net Wealth Advantage vs Standard',
                        data: chartDataSM,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Standard Baseline',
                        data: chartDataStandard,
                        borderColor: '#6c757d',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
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
                        ticks: { color: '#888', callback: (val) => '$' + (val/1000).toFixed(0) + 'k' } 
                    }
                }
            }
        });
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

            worker.postMessage({ type: 'RUN_MONTE_CARLO', payload: workerData });
            
            worker.onmessage = (e) => {
                const { type, payload } = e.data;
                if (type === 'MONTE_CARLO_COMPLETE') {
                    const { successRate, medianTrajectory, p10Trajectory } = payload;
                    
                    this.processMonteCarloChartFromPayload(successRate, medianTrajectory, p10Trajectory, startYear);
                    
                    if(btn) {
                        btn.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i> Run Monte Carlo';
                        btn.disabled = false;
                    }
                    worker.terminate();
                }
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

    processMonteCarloChartFromPayload(successRateStr, medianData, p10Data, startYear) {
        const statsBox = document.getElementById('mc_stats_box');
        const rateEl = document.getElementById('mc_success_rate');
        const successRate = parseFloat(successRateStr);
        
        if(statsBox && rateEl) {
            statsBox.style.display = 'block';
            rateEl.innerText = `${successRate.toFixed(1)}%`;
            statsBox.className = successRate >= 90 ? 'card p-3 border-success bg-success bg-opacity-10 text-center' : 
                               (successRate >= 75 ? 'card p-3 border-warning bg-warning bg-opacity-10 text-center' : 
                               'card p-3 border-danger bg-danger bg-opacity-10 text-center');
            rateEl.className = successRate >= 90 ? 'display-4 fw-bold text-success' : 
                             (successRate >= 75 ? 'display-4 fw-bold text-warning' : 
                             'display-4 fw-bold text-danger');
        }

        const ctx = document.getElementById('chartMonteCarlo').getContext('2d');
        const p1Age = Math.abs(startYear - parseInt(this.app.getRaw('p1_dob').split('-')[0]));
        const labels = medianData.map((_, i) => p1Age + i);

        // Convert to Today's Dollars inside the chart visually for better understanding
        const inflation = this.app.getVal('inflation_rate') / 100;
        const discount = (val, idx) => val / Math.pow(1 + inflation, idx);
        
        const medAdj = medianData.map((v, i) => Math.round(discount(v, i)));
        const p10Adj = p10Data.map((v, i) => Math.round(discount(v, i)));

        if(this.app.charts.mc) this.app.charts.mc.destroy(); 

        const isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        this.app.charts.mc = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Median Scenario (50th Percentile)',
                        data: medAdj,
                        borderColor: '#3b82f6', 
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0
                    },
                    {
                        label: 'Pessimistic Scenario (Bottom 10%)',
                        data: p10Adj,
                        borderColor: '#ef4444', 
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        borderDash: [5, 5],
                        fill: false,
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
                    legend: { position: 'bottom', labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Player 1 Age', color: textColor },
                        grid: { color: gridColor }, 
                        ticks: { color: textColor } 
                    },
                    y: { 
                        grid: { color: gridColor }, 
                        ticks: { color: textColor, callback: (val) => '$' + (val/1000000).toFixed(1) + 'M' } 
                    }
                }
            }
        });
    }

    // Keep this function here for backward compatibility if `runMonteCarlo` uses it instead of payload logic
    processMonteCarloChart(trajectories, startYear) {
        trajectories.sort((a, b) => a[a.length - 1] - b[b.length - 1]);

        const runs = trajectories.length;
        const p10Idx = Math.floor(runs * 0.10);
        const p50Idx = Math.floor(runs * 0.50);

        const p10Data = trajectories[p10Idx];
        const p50Data = trajectories[p50Idx];

        const successCount = trajectories.filter(t => t[t.length-1] > 0).length;
        const successRate = ((successCount / runs) * 100).toFixed(1);

        this.processMonteCarloChartFromPayload(successRate, p50Data, p10Data, startYear);
    }
    // ---------------- MONTE CARLO ENGINE END ---------------- //
}
