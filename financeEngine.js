/**
 * financeEngine.js
 * Shared financial logic core for both the main UI thread and Web Workers.
 * This eliminates logic duplication and ensures consistency across the app.
 */

class FinanceEngine {
    constructor(data) {
        this.inputs = data.inputs || {};
        this.properties = data.properties || [];
        this.windfalls = data.windfalls || [];
        this.additionalIncome = data.additionalIncome || [];
        this.strategies = data.strategies || { accum: [], decum: [] };
        this.mode = data.mode || 'Couple';
        this.expenseMode = data.expenseMode || 'Simple';
        this.expensesByCategory = data.expensesByCategory || {};
        this.CONSTANTS = data.constants || {};
        this.strategyLabels = data.strategyLabels || {};
    }

    getVal(id) {
        let raw = this.inputs[id] !== undefined ? this.inputs[id] : 0;
        return Number(String(raw).replace(/,/g, '')) || 0;
    }

    getRaw(id) {
        return this.inputs[id];
    }

    randn_bm() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random(); 
        while(v === 0) v = Math.random();
        return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    }

    getRrifFactor(age) {
        if(age < 71) return 1 / (90 - age); 
        if(age >= 95) return 0.20;
        return {71:0.0528, 72:0.0540, 73:0.0553, 74:0.0567, 75:0.0582, 76:0.0598, 77:0.0617, 78:0.0636, 79:0.0658, 80:0.0682, 81:0.0708, 82:0.0738, 83:0.0771, 84:0.0808, 85:0.0851, 86:0.0899, 87:0.0955, 88:0.1021, 89:0.1099, 90:0.1192, 91:0.1306, 92:0.1449, 93:0.1634, 94:0.1879}[age] || 0.0528;
    }

    calcBen(m, sA, p, rA, type) { 
        let v = m * p, d = (sA - 65) * 12; 
        if (type === 'cpp') {
            v *= d < 0 ? (1 - (Math.abs(d) * 0.006)) : (1 + (d * 0.007)); 
            if (rA < 60) v *= Math.max(0, (39 - Math.max(0, (65 - rA) - 8)) / 39); 
        } else if (type === 'oas') {
            if (d > 0) v *= (1 + (d * 0.006));
        }
        return v; 
    }

    getInflatedTaxData(bInf) {
        let tDat = JSON.parse(JSON.stringify(this.CONSTANTS.TAX_DATA));
        Object.values(tDat).forEach(d => { 
            if(d.brackets) d.brackets = d.brackets.map(b => b * bInf); 
            if(d.surtax){ if(d.surtax.t1) d.surtax.t1 *= bInf; if(d.surtax.t2) d.surtax.t2 *= bInf; } 
        });
        return tDat;
    }

    calculateProgressiveTax(i, b, r) {
        let t = 0, p = 0;
        for(let j = 0; j < b.length; j++){ 
            if(i > b[j]){ t += (b[j] - p) * r[j]; p = b[j]; } 
            else { return { tax: t + (i - p) * r[j], marg: r[j] }; } 
        }
        return { tax: t + (i - p) * r[r.length - 1], marg: r[r.length - 1] };
    }

    calculateTaxDetailed(inc, prov, tDat) {
        if(inc <= 0) return { fed: 0, prov: 0, cpp_ei: 0, totalTax: 0, margRate: 0 };
        const D = tDat;
        const fC = this.calculateProgressiveTax(inc, D.FED.brackets, D.FED.rates);
        const pC = this.calculateProgressiveTax(inc, D[prov]?.brackets || [999999999], D[prov]?.rates || [0.10]);
        let fed = fC.tax, provT = pC.tax, mF = fC.marg, mP = pC.marg;
        
        if(prov === 'ON'){ 
            let s = 0; 
            if(D.ON.surtax){ 
                if(provT > D.ON.surtax.t1) s += (provT - D.ON.surtax.t1) * D.ON.surtax.r1; 
                if(provT > D.ON.surtax.t2) s += (provT - D.ON.surtax.t2) * D.ON.surtax.r2; 
            } 
            if(s > 0) mP *= 1.56; 
            provT += s + (inc > 20000 ? Math.min(900, (inc - 20000) * 0.06) : 0); 
        }
        if(prov === 'PE' && D.PE.surtax && provT > D.PE.surtax.t1) provT += (provT - D.PE.surtax.t1) * D.PE.surtax.r1;
        if(prov === 'QC' && D.QC.abatement) fed -= fed * D.QC.abatement;
        
        let cpp = 0; 
        if(inc > 3500) cpp += (Math.min(inc, 74600) - 3500) * 0.0595; 
        if(inc > 74600) cpp += (Math.min(inc, 85000) - 74600) * 0.04;
        const ei = Math.min(inc, 68900) * 0.0164;
        
        return { fed, prov: provT, cpp_ei: cpp + ei, totalTax: fed + provT + cpp + ei, margRate: mF + mP };
    }

    applyGrowth(p1, p2, isRet1, isRet2, isAdv, inf, i, simContext) {
        const stress = this.inputs['stressTestEnabled'] && i === 0; 
        const getRates = (p, ret) => {
            const r = id => this.getVal(`${p}_${id}_ret` + (isAdv && ret ? '_retire' : '')) / 100;
            return { 
                tfsa: r('tfsa'), rrsp: r('rrsp'), cash: r('cash'), nreg: r('nonreg'), 
                cryp: r('crypto'), lirf: r('lirf'), lif: r('lif'), rrif_acct: r('rrif_acct'), 
                inc: this.getVal(`${p}_income_growth`) / 100 
            };
        };
        const g1 = getRates('p1', isRet1), g2 = getRates('p2', isRet2);
        
        if(stress) { 
            ['tfsa','rrsp','nreg','cash','lirf','lif','rrif_acct'].forEach(k => { g1[k] = -0.15; g2[k] = -0.15; }); 
            g1.cryp = -0.40; g2.cryp = -0.40; 
        }

        if (simContext) {
            let shock = 0;
            if (simContext.method === 'historical' && simContext.histSequence) {
                shock = simContext.histSequence[i] - 0.10;
            } else if (simContext.volatility) {
                shock = this.randn_bm() * simContext.volatility;
            }
            if (shock !== 0) {
                ['tfsa','rrsp','nreg','cryp','lirf','lif','rrif_acct'].forEach(k => { g1[k] += shock; g2[k] += shock; });
            }
        }

        const grow = (p, rates) => {
            p.tfsa *= (1 + rates.tfsa); p.rrsp *= (1 + rates.rrsp); p.cash *= (1 + rates.cash); p.crypto *= (1 + rates.cryp);
            p.lirf *= (1 + rates.lirf); p.lif *= (1 + rates.lif); p.rrif_acct *= (1 + rates.rrif_acct);
            p.nreg *= (1 + (rates.nreg - p.nreg_yield));
            if(!isRet1) p.inc *= (1 + rates.inc); 
        };
        grow(p1, g1); grow(p2, g2);
    }

    calcInflows(yr, i, p1, p2, age1, age2, alive1, alive2, isRet1, isRet2, c, bInf, trackedEvents = null) {
        let res = { 
            p1: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0 }, 
            p2: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0 },
            events: []
        };
        
        const calcP = (p, age, isRet, pfx, maxCpp, maxOas) => {
            let inf = { gross:0, earned:0, cpp:0, oas:0, pension:0, postRet:0 };
            if(!isRet) { inf.gross += p.inc; inf.earned += p.inc; }
            
            if(this.inputs[`${pfx}_db_enabled`]) {
                const lStart = parseInt(this.getRaw(`${pfx}_db_lifetime_start`) || 60), bStart = parseInt(this.getRaw(`${pfx}_db_bridge_start`) || 60);
                if(age >= lStart) inf.pension += this.getVal(`${pfx}_db_lifetime`) * 12 * bInf;
                if(age >= bStart && age < 65) inf.pension += this.getVal(`${pfx}_db_bridge`) * 12 * bInf;
            }

            if(this.inputs[`${pfx}_cpp_enabled`] && age >= parseInt(this.getRaw(`${pfx}_cpp_start`))) {
                inf.cpp = this.calcBen(maxCpp, parseInt(this.getRaw(`${pfx}_cpp_start`)), 1, p.retAge, 'cpp');
                if(trackedEvents && age === parseInt(this.getRaw(`${pfx}_cpp_start`))) { trackedEvents.add(`${pfx.toUpperCase()} CPP`); }
            }
            if(this.inputs[`${pfx}_oas_enabled`] && age >= parseInt(this.getRaw(`${pfx}_oas_start`))) {
                inf.oas = this.calcBen(maxOas, parseInt(this.getRaw(`${pfx}_oas_start`)), 1, 65, 'oas');
                if(trackedEvents && age === parseInt(this.getRaw(`${pfx}_oas_start`))) { trackedEvents.add(`${pfx.toUpperCase()} OAS`); }
            }
            return inf;
        };

        if(alive1) { let r = calcP(p1, age1, isRet1, 'p1', c.cppMax1, c.oasMax1); res.p1 = {...res.p1, ...r}; }
        if(alive2) { let r = calcP(p2, age2, isRet2, 'p2', c.cppMax2, c.oasMax2); res.p2 = {...res.p2, ...r}; }

        if (trackedEvents) {
            if(alive1 && isRet1 && !trackedEvents.has('P1 Retires')){ trackedEvents.add('P1 Retires'); res.events.push('P1 Retires'); }
            if(alive2 && isRet2 && !trackedEvents.has('P2 Retires')){ trackedEvents.add('P2 Retires'); res.events.push('P2 Retires'); }
        }

        this.windfalls.forEach(w => {
            let act = false, amt = 0, sY = new Date(w.start + "-01").getFullYear();
            if(w.freq === 'one') { 
                if(sY === yr) { act = true; amt = w.amount; } 
            } else { 
                let eY = (w.end ? new Date(w.end + "-01") : new Date("2100-01-01")).getFullYear(); 
                if(yr >= sY && yr <= eY) { 
                    act = true; 
                    amt = w.amount * (w.freq === 'month' ? (yr === sY ? 12 - new Date(w.start + "-01").getMonth() : (yr === eY ? new Date(w.end + "-01").getMonth() + 1 : 12)) : 1); 
                } 
            }
            if(act && amt > 0) { 
                if (trackedEvents && w.freq === 'one') res.events.push('Windfall');
                let target = (w.owner === 'p2' && alive2) ? res.p2 : res.p1;
                if(w.taxable) target.windfallTaxable += amt; else target.windfallNonTax += amt;
            }
        });

        this.additionalIncome.forEach(s => {
            let sY, eY;
            if (s.startMode === 'ret_relative') {
                const ownerP = s.owner === 'p2' ? p2 : p1;
                const retYear = ownerP.dob.getFullYear() + ownerP.retAge;
                sY = retYear + (s.startRel || 0);
            } else {
                sY = new Date(s.start + "-01").getFullYear();
            }

            if (s.endMode === 'duration') {
                eY = sY + (s.duration || 0);
            } else {
                eY = (s.end ? new Date(s.end + "-01") : new Date("2100-01-01")).getFullYear();
            }

            if(yr >= sY && yr <= eY) {
                let baseYear = s.startMode === 'ret_relative' ? sY : new Date(s.start + "-01").getFullYear();
                let amt = s.amount * Math.pow(1 + (s.growth / 100), yr - baseYear) * (s.freq === 'month' ? 12 : 1);
                
                if (s.startMode === 'date' && yr === sY) amt *= (12 - new Date(s.start + "-01").getMonth()) / 12;
                if (s.endMode === 'date' && s.end && yr === eY) amt *= Math.min(1, (new Date(s.end + "-01").getMonth() + 1) / 12);

                if(amt > 0) { 
                    let target = (s.owner === 'p2' && alive2) ? res.p2 : res.p1;
                    if (target) {
                        if(s.taxable) { 
                            target.gross += amt; 
                            target.earned += amt;
                            const isRet = (s.owner === 'p2' ? isRet2 : isRet1);
                            if(isRet) target.postRet += amt;
                        } 
                        else target.windfallNonTax += amt;
                    }
                }
            }
        });

        return res;
    }

    calcRRIFMin(p1, p2, age1, age2, alive1, alive2) {
        let r = { p1: 0, p2: 0 };
        if(alive1 && p1.rrsp > 0 && age1 >= this.CONSTANTS.RRIF_START_AGE){ r.p1 = p1.rrsp * this.getRrifFactor(age1); p1.rrsp -= r.p1; }
        if(alive2 && p2.rrsp > 0 && age2 >= this.CONSTANTS.RRIF_START_AGE){ r.p2 = p2.rrsp * this.getRrifFactor(age2); p2.rrsp -= r.p2; }
        return r;
    }

    calcOutflows(yr, i, age, bInf, isRet1, isRet2, simContext) {
        let expTotals = { curr:0, ret:0, trans:0, gogo:0, slow:0, nogo:0 };
        Object.values(this.expensesByCategory).forEach(c => c.items.forEach(item => { 
            const f = item.freq; 
            expTotals.curr += (item.curr || 0) * f; 
            expTotals.ret += (item.ret || 0) * f; 
            expTotals.trans += (item.trans || 0) * f; 
            expTotals.gogo += (item.gogo || 0) * f; 
            expTotals.slow += (item.slow || 0) * f; 
            expTotals.nogo += (item.nogo || 0) * f; 
        }));
        
        let exp = 0;
        const fullyRetired = isRet1 && (this.mode === 'Single' || isRet2);
        const gLim = parseInt(this.getRaw('exp_gogo_age')) || 75, sLim = parseInt(this.getRaw('exp_slow_age')) || 85;
        const multiplier = simContext?.expenseMultiplier || 1.0;

        if(this.expenseMode === 'Simple') {
            exp = fullyRetired ? (expTotals.ret * multiplier) : expTotals.curr;
        } else {
            if(!fullyRetired) exp = expTotals.curr;
            else if(age < gLim) exp = expTotals.gogo * multiplier;
            else if(age < sLim) exp = expTotals.slow * multiplier;
            else exp = expTotals.nogo * multiplier;
        }
        return exp * bInf;
    }

    applyPensionSplitting(t1, t2, inf, rrif, p1, p2, age1, age2, setTaxes) {
        let eligibleP1 = inf.p1.pension;
        let eligibleP2 = inf.p2.pension;
        if (age1 >= 65) { eligibleP1 += rrif.p1 + (p1.lif > 0 ? p1.lif * 0.05 : 0); }
        if (age2 >= 65) { eligibleP2 += rrif.p2 + (p2.lif > 0 ? p2.lif * 0.05 : 0); }

        if (t1 > t2 && eligibleP1 > 0) {
            let maxTransfer = eligibleP1 * 0.5;
            let diff = t1 - t2;
            let transfer = Math.min(maxTransfer, diff / 2);
            setTaxes(t1 - transfer, t2 + transfer);
        } else if (t2 > t1 && eligibleP2 > 0) {
            let maxTransfer = eligibleP2 * 0.5;
            let diff = t2 - t1;
            let transfer = Math.min(maxTransfer, diff / 2);
            setTaxes(t1 + transfer, t2 - transfer);
        }
    }

    handleSurplus(amount, p1, p2, alive1, alive2, log, i, tfsaLim, rrspLim1, rrspLim2) {
        let r = amount;
        this.strategies.accum.forEach(t => { 
            if(r <= 0) return;
            if(t === 'tfsa'){ 
                if(alive1 && (!this.inputs['skip_first_tfsa_p1'] || i > 0)){
                    let take = Math.min(r, tfsaLim); p1.tfsa += take; 
                    if(log) log.contributions.p1.tfsa += take; 
                    r -= take;
                } 
                if(alive2 && r > 0 && (!this.inputs['skip_first_tfsa_p2'] || i > 0)){
                    let take = Math.min(r, tfsaLim); p2.tfsa += take; 
                    if(log) log.contributions.p2.tfsa += take; 
                    r -= take;
                } 
            }
            else if(t === 'rrsp'){
                let priority = [];
                const p1HasRoom = (!this.inputs['skip_first_rrsp_p1'] || i > 0) && alive1;
                const p2HasRoom = (!this.inputs['skip_first_rrsp_p2'] || i > 0) && alive2;
                if (p1HasRoom && p2HasRoom) {
                    if (p1.rrsp < p2.rrsp) priority = [{p: p1, room: rrspLim1, k: 'p1'}, {p: p2, room: rrspLim2, k: 'p2'}];
                    else priority = [{p: p2, room: rrspLim2, k: 'p2'}, {p: p1, room: rrspLim1, k: 'p1'}];
                } else if (p1HasRoom) priority = [{p: p1, room: rrspLim1, k: 'p1'}];
                else if (p2HasRoom) priority = [{p: p2, room: rrspLim2, k: 'p2'}];

                priority.forEach(obj => {
                    if (r > 0) {
                        let take = Math.min(r, obj.room);
                        obj.p.rrsp += take; 
                        if(log) log.contributions[obj.k].rrsp += take; 
                        r -= take;
                    }
                });
            }
            else if(t === 'nreg'){
                if(alive1){ p1.nreg += r; p1.acb += r; if(log) log.contributions.p1.nreg += r; r = 0; }
            } 
            else if(t === 'cash'){
                if(alive1){ p1.cash += r; if(log) log.contributions.p1.cash += r; r = 0; }
            } 
            else if(t === 'crypto'){
                if(alive1){ p1.crypto += r; if(log) log.contributions.p1.crypto += r; r = 0; }
            }
        });
    }

    handleDeficit(amount, p1, p2, curInc1, curInc2, alive1, alive2, log, breakdown, taxBrackets, onWithdrawal, age1, age2) {
        let df = amount;
        let runInc1 = curInc1;
        let runInc2 = curInc2;
        const prov = this.getRaw('tax_province');
        const TOLERANCE = 50; 
        
        let p1StratIdx = 0;
        let p2StratIdx = 0;
        const strats = this.strategies.decum;

        const wd = (p, t, a, pfx, mRate) => { 
            if(a <= 0 || p[t] <= 0) return 0;
            
            let isTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(t);
            let grossNeeded = a;

            if (isTaxable) {
                let effRate = Math.min(mRate || 0, 0.54); 
                grossNeeded = a / (1 - effRate);
            }
            
            let tk = Math.min(p[t], grossNeeded);
            
            let currentAge = (pfx === 'p1') ? age1 : age2;
            let logKey = this.strategyLabels[t] || t;
            if (t === 'rrsp' && currentAge >= this.CONSTANTS.RRIF_START_AGE) logKey = 'RRIF';

            p[t] -= tk;
            
            if (log) {
                let k = (pfx.toUpperCase()) + " " + logKey;
                log.withdrawals[k] = (log.withdrawals[k] || 0) + tk;
                if(breakdown) breakdown[pfx][logKey] = (breakdown[pfx][logKey] || 0) + tk;
            }
            
            if (onWithdrawal) {
                 onWithdrawal(pfx, isTaxable, tk);
            }

            if (isTaxable) {
                let effRate = Math.min(mRate || 0, 0.54);
                return tk * (1 - effRate);
            }
            return tk;
        };
        
        while(df > 1 && (p1StratIdx < strats.length || p2StratIdx < strats.length)) {
            while(p1StratIdx < strats.length && (p1[strats[p1StratIdx]] <= 0 || !alive1)) { p1StratIdx++; }
            while(p2StratIdx < strats.length && (p2[strats[p2StratIdx]] <= 0 || !alive2)) { p2StratIdx++; }

            const p1Type = p1StratIdx < strats.length ? strats[p1StratIdx] : null;
            const p2Type = p2StratIdx < strats.length ? strats[p2StratIdx] : null;

            if(!p1Type && !p2Type) break; 

            const mR1 = this.calculateTaxDetailed(runInc1, prov, taxBrackets).margRate;
            const mR2 = this.calculateTaxDetailed(runInc2, prov, taxBrackets).margRate;

            let target = null;
            
            if (!p1Type) target = 'p2';
            else if (!p2Type) target = 'p1';
            else {
                if (Math.abs(runInc1 - runInc2) < TOLERANCE) target = 'split';
                else if (runInc1 < runInc2) target = 'p1';
                else target = 'p2';
            }

            if (target === 'split') {
                let half = df / 2;
                let gotP1 = wd(p1, p1Type, half, 'p1', mR1);
                let gotP2 = wd(p2, p2Type, half, 'p2', mR2);
                
                df = df - (gotP1 + gotP2);
                
                if(['rrsp','rrif_acct','lif','lirf'].includes(p1Type)) runInc1 += (gotP1 / (1 - Math.min(mR1, 0.54)));
                if(['rrsp','rrif_acct','lif','lirf'].includes(p2Type)) runInc2 += (gotP2 / (1 - Math.min(mR2, 0.54)));

            } else {
                let toTake = df;
                if (p1Type && p2Type) {
                    let gap = Math.abs(runInc1 - runInc2);
                    let mR = (target === 'p1' ? mR1 : mR2);
                    let effRate = Math.min(mR || 0, 0.54);
                    let netGap = gap * (1 - effRate);
                    if (netGap > 0) toTake = Math.min(df, netGap);
                }
                
                if (toTake < 10) toTake = Math.min(df, 500);

                if (target === 'p1') {
                    let got = wd(p1, p1Type, toTake, 'p1', mR1);
                    if(['rrsp','rrif_acct','lif','lirf'].includes(p1Type)) runInc1 += (got / (1 - Math.min(mR1, 0.54)));
                    df -= got;
                } else {
                    let got = wd(p2, p2Type, toTake, 'p2', mR2);
                    if(['rrsp','rrif_acct','lif','lirf'].includes(p2Type)) runInc2 += (got / (1 - Math.min(mR2, 0.54)));
                    df -= got;
                }
            }
        }
    }

    /**
     * Main Simulation loop used by both the UI and Worker.
     * @param {boolean} detailed - If true, returns detailed projection rows (UI). If false, returns just Net Worth trajectory (Worker).
     * @param {object} simContext - Historical/Shock contexts for Monte Carlo or overrides for Optimizers (e.g. expenseMultiplier).
     * @param {number} totalDebtInitial - Starting total debt.
     */
    runSimulation(detailed = false, simContext = null, totalDebtInitial = 0) {
        const curY = new Date().getFullYear();
        let nwArray = [];
        let projectionData = [];

        let person1 = { tfsa: this.getVal('p1_tfsa'), rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), crypto: this.getVal('p1_crypto'), lirf: this.getVal('p1_lirf'), lif: this.getVal('p1_lif'), rrif_acct: this.getVal('p1_rrif_acct'), inc: this.getVal('p1_income'), dob: new Date(this.getRaw('p1_dob') || "1990-01"), retAge: this.getVal('p1_retireAge'), lifeExp: this.getVal('p1_lifeExp'), nreg_yield: this.getVal('p1_nonreg_yield')/100, acb: this.getVal('p1_nonreg') };
        let person2 = { tfsa: this.getVal('p2_tfsa'), rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), dob: new Date(this.getRaw('p2_dob') || "1990-01"), retAge: this.getVal('p2_retireAge'), lifeExp: this.getVal('p2_lifeExp'), nreg_yield: this.getVal('p2_nonreg_yield')/100, acb: this.getVal('p2_nonreg') };

        let simProperties = JSON.parse(JSON.stringify(this.properties));
        let totalDebt = totalDebtInitial;
        
        const p1StartAge = curY - person1.dob.getFullYear();
        const p2StartAge = curY - person2.dob.getFullYear();
        const endAge = Math.max(person1.lifeExp, this.mode === 'Couple' ? person2.lifeExp : 0);
        const yearsToRun = endAge - Math.min(p1StartAge, this.mode === 'Couple' ? p2StartAge : p1StartAge);
        let trackedEvents = new Set();
        let finalNetWorth = 0;

        let consts = {
            cppMax1: this.getVal('p1_cpp_est_base'),
            oasMax1: this.CONSTANTS.MAX_OAS * (Math.max(0, Math.min(40, this.getVal('p1_oas_years'))) / 40),
            cppMax2: this.getVal('p2_cpp_est_base'),
            oasMax2: this.CONSTANTS.MAX_OAS * (Math.max(0, Math.min(40, this.getVal('p2_oas_years'))) / 40),
            tfsaLimit: this.getVal('cfg_tfsa_limit') || 7000,
            rrspMax: this.getVal('cfg_rrsp_limit') || 32960,
            inflation: this.getVal('inflation_rate') / 100
        };

        for (let i = 0; i <= yearsToRun; i++) {
            const yr = curY + i;
            const age1 = p1StartAge + i;
            const age2 = p2StartAge + i;
            const alive1 = age1 <= person1.lifeExp;
            const alive2 = this.mode === 'Couple' ? age2 <= person2.lifeExp : false;
            
            if (!alive1 && !alive2) break;

            const bInf = Math.pow(1 + consts.inflation, i);
            const isRet1 = age1 >= person1.retAge;
            const isRet2 = this.mode === 'Couple' ? age2 >= person2.retAge : true;
            
            this.applyGrowth(person1, person2, isRet1, isRet2, this.inputs['asset_mode_advanced'], consts.inflation, i, simContext);

            const inflows = this.calcInflows(yr, i, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, consts, bInf, detailed ? trackedEvents : null);
            const rrifMin = this.calcRRIFMin(person1, person2, age1, age2, alive1, alive2);
            const expenses = this.calcOutflows(yr, i, age1, bInf, isRet1, isRet2, simContext);

            let mortgagePayment = 0;
            
            let keptProperties = [];
            simProperties.forEach(p => {
                if (p.sellEnabled && p.sellAge === age1) {
                    const proceeds = p.value;
                    const transCosts = proceeds * 0.05;
                    const netCash = proceeds - p.mortgage - transCosts;
                    const newHomeCost = (p.replacementValue || 0) * bInf;
                    const surplus = netCash - newHomeCost;
                    
                    if (surplus > 0) inflows.p1.windfallNonTax += surplus;
                    
                    if (detailed && !trackedEvents.has('Downsize')) { 
                        trackedEvents.add('Downsize'); 
                        inflows.events.push('Downsize'); 
                    }

                    if (newHomeCost > 0) {
                        keptProperties.push({
                            name: "Replacement: " + p.name, value: newHomeCost, mortgage: 0, growth: p.growth, rate: 0, payment: 0, manual: false, includeInNW: p.includeInNW, sellEnabled: false 
                        });
                    }
                } else {
                    if(p.mortgage > 0 && p.payment > 0) { 
                        let annPmt = p.payment * 12, interest = p.mortgage * (p.rate / 100), principal = annPmt - interest; 
                        if(principal > p.mortgage) { principal = p.mortgage; annPmt = principal + interest; } 
                        p.mortgage = Math.max(0, p.mortgage - principal); 
                        mortgagePayment += annPmt; 
                    } 
                    p.value *= (1 + (p.growth / 100));
                    keptProperties.push(p);
                }
            });
            simProperties = keptProperties;

            let debtRepayment = totalDebt > 0 ? Math.min(totalDebt, 6000) : 0; 
            totalDebt -= debtRepayment;
            
            if(detailed && simProperties.reduce((s,p) => s + p.mortgage, 0) <= 0 && !trackedEvents.has('Mortgage Paid') && simProperties.some(p => p.mortgage === 0 && p.value > 0)){ 
                trackedEvents.add('Mortgage Paid'); 
                inflows.events.push('Mortgage Paid'); 
            }

            let taxableIncome1 = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + rrifMin.p1 + inflows.p1.windfallTaxable + (person1.nreg * person1.nreg_yield);
            let taxableIncome2 = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + rrifMin.p2 + inflows.p2.windfallTaxable + (alive2 ? (person2.nreg * person2.nreg_yield) : 0);

            if (this.mode === 'Couple' && this.inputs['pension_split_enabled']) {
                this.applyPensionSplitting(taxableIncome1, taxableIncome2, inflows, rrifMin, person1, person2, age1, age2, (n1, n2) => { taxableIncome1 = n1; taxableIncome2 = n2; });
            }

            let rrspDed = { p1: 0, p2: 0 };
            const taxBrackets = this.getInflatedTaxData(bInf);
            if(this.inputs['strat_rrsp_topup']) {
                 const lowBracket = taxBrackets.FED.brackets[0];
                 if(alive1 && person1.rrsp > 0 && taxableIncome1 < lowBracket) {
                     let d = Math.min(lowBracket - taxableIncome1, person1.rrsp);
                     if(d > 0) { person1.rrsp -= d; taxableIncome1 += d; rrspDed.p1 = d; }
                 }
                 if(alive2 && person2.rrsp > 0 && taxableIncome2 < lowBracket) {
                     let d = Math.min(lowBracket - taxableIncome2, person2.rrsp);
                     if(d > 0) { person2.rrsp -= d; taxableIncome2 += d; rrspDed.p2 = d; }
                 }
            }

            let tax1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets) : {totalTax: 0, margRate: 0};
            let tax2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets) : {totalTax: 0, margRate: 0};

            let netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
            let netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
            
            let totalNetIncome = netIncome1 + netIncome2;
            const totalOutflows = expenses + mortgagePayment + debtRepayment;
            let surplus = totalNetIncome - totalOutflows;

            let flowLog = detailed ? { contributions: { p1: {tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0}, p2: {tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0} }, withdrawals: {} } : null;
            let wdBreakdown = detailed ? { p1: {}, p2: {} } : null;

            if(detailed) {
                if(rrifMin.p1 > 0) { flowLog.withdrawals['P1 RRIF'] = (flowLog.withdrawals['P1 RRIF'] || 0) + rrifMin.p1; wdBreakdown.p1.RRIF = rrifMin.p1; }
                if(rrifMin.p2 > 0) { flowLog.withdrawals['P2 RRIF'] = (flowLog.withdrawals['P2 RRIF'] || 0) + rrifMin.p2; wdBreakdown.p2.RRIF = rrifMin.p2; }
                if(rrspDed.p1 > 0) { flowLog.withdrawals['P1 RRSP Top-Up'] = (flowLog.withdrawals['P1 RRSP Top-Up'] || 0) + rrspDed.p1; wdBreakdown.p1.RRSP = rrspDed.p1; }
                if(rrspDed.p2 > 0) { flowLog.withdrawals['P2 RRSP Top-Up'] = (flowLog.withdrawals['P2 RRSP Top-Up'] || 0) + rrspDed.p2; wdBreakdown.p2.RRSP = rrspDed.p2; }
            }

            const rrspRoom1 = Math.min(inflows.p1.earned * 0.18, consts.rrspMax * bInf);
            const rrspRoom2 = Math.min(inflows.p2.earned * 0.18, consts.rrspMax * bInf);

            if (surplus > 0) {
                this.handleSurplus(surplus, person1, person2, alive1, alive2, flowLog, i, consts.tfsaLimit * bInf, rrspRoom1, rrspRoom2);
            } else {
                let cashFromNonTaxableWd = 0; 
                for(let pass = 0; pass < 5; pass++) {
                    let dynTax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets);
                    let dynTax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets);
                    
                    tax1 = dynTax1; 
                    tax2 = dynTax2;

                    let dynNet1 = taxableIncome1 - dynTax1.totalTax + inflows.p1.windfallNonTax;
                    let dynNet2 = alive2 ? taxableIncome2 - dynTax2.totalTax + inflows.p2.windfallNonTax : 0;
                    let dynTotalNet = dynNet1 + dynNet2;
                    
                    let currentDeficit = totalOutflows - (dynTotalNet + cashFromNonTaxableWd);
                    
                    if (currentDeficit < 1) break; 
                    
                    this.handleDeficit(currentDeficit, person1, person2, taxableIncome1, taxableIncome2, alive1, alive2, flowLog, wdBreakdown, taxBrackets, (pfx, isTaxable, grossAmt) => {
                        if (isTaxable) {
                            if (pfx === 'p1') taxableIncome1 += grossAmt;
                            if (pfx === 'p2') taxableIncome2 += grossAmt;
                        } else {
                            cashFromNonTaxableWd += grossAmt;
                        }
                    }, age1, age2);
                }
                
                tax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets);
                tax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets);
                netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
                netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
                surplus = (netIncome1 + netIncome2) - totalOutflows;
            }

            const assets1 = person1.tfsa + person1.rrsp + person1.crypto + person1.nreg + person1.cash + person1.lirf + person1.lif + person1.rrif_acct;
            const assets2 = alive2 ? person2.tfsa + person2.rrsp + person2.crypto + person2.nreg + person2.cash + person2.lirf + person2.lif + person2.rrif_acct : 0;
            const liquidNW = (assets1 + assets2) - totalDebt;
            
            let realEstateValue = 0, realEstateDebt = 0;
            simProperties.forEach(p => { 
                if(p.includeInNW) { realEstateValue += p.value; realEstateDebt += p.mortgage; } 
            });
            finalNetWorth = liquidNW + (realEstateValue - realEstateDebt);

            if(!detailed) {
                nwArray.push(finalNetWorth);
            } else {
                const totalWithdrawals = Object.values(flowLog.withdrawals).reduce((a,b) => a + b, 0);
                const p1GrossTotal = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + inflows.p1.windfallTaxable + inflows.p1.windfallNonTax;
                const p2GrossTotal = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + inflows.p2.windfallTaxable + inflows.p2.windfallNonTax;
                const totalYield = (person1.nreg * person1.nreg_yield) + (alive2 ? (person2.nreg * person2.nreg_yield) : 0);
                const grossInflow = p1GrossTotal + p2GrossTotal + totalYield + totalWithdrawals;
                const cashSurplus = grossInflow - (totalOutflows + tax1.totalTax + tax2.totalTax);

                projectionData.push({
                    year: yr, p1Age: age1, p2Age: alive2 ? age2 : null, p1Alive: alive1, p2Alive: alive2,
                    incomeP1: inflows.p1.gross, incomeP2: inflows.p2.gross,
                    cppP1: inflows.p1.cpp, cppP2: inflows.p2.cpp,
                    oasP1: inflows.p1.oas, oasP2: inflows.p2.oas,
                    benefitsP1: inflows.p1.cpp + inflows.p1.oas, benefitsP2: inflows.p2.cpp + inflows.p2.oas,
                    dbP1: inflows.p1.pension, dbP2: inflows.p2.pension,
                    taxP1: tax1.totalTax, taxP2: tax2.totalTax,
                    p1Net: netIncome1, p2Net: netIncome2,
                    expenses: expenses, mortgagePay: mortgagePayment, debtRepayment,
                    surplus: Math.abs(cashSurplus) < 5 ? 0 : cashSurplus,
                    debugNW: finalNetWorth,
                    liquidNW: liquidNW,
                    assetsP1: {...person1}, assetsP2: {...person2},
                    wdBreakdown: wdBreakdown,
                    flows: flowLog,
                    events: inflows.events,
                    householdNet: grossInflow, 
                    grossInflow: grossInflow, 
                    visualExpenses: expenses + mortgagePayment + debtRepayment + tax1.totalTax + tax2.totalTax,
                    mortgage: simProperties.reduce((s,p) => s + p.mortgage, 0), 
                    homeValue: simProperties.reduce((s,p) => s + p.value, 0),
                    windfall: inflows.p1.windfallTaxable + inflows.p1.windfallNonTax + inflows.p2.windfallTaxable + inflows.p2.windfallNonTax,
                    postRetP1: inflows.p1.postRet, postRetP2: inflows.p2.postRet,
                    invIncP1: (person1.nreg * person1.nreg_yield), invIncP2: (person2.nreg * person2.nreg_yield),
                    debugTotalInflow: grossInflow
                });
            }

            consts.cppMax1 *= (1 + consts.inflation); consts.oasMax1 *= (1 + consts.inflation);
            consts.cppMax2 *= (1 + consts.inflation); consts.oasMax2 *= (1 + consts.inflation);
        }
        
        return detailed ? projectionData : nwArray;
    }
}
