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

    calculateTaxDetailed(inc, prov, tDat, oasReceived = 0, oasThreshold = 0) {
        if(inc <= 0) return { fed: 0, prov: 0, cpp_ei: 0, oas_clawback: 0, totalTax: 0, margRate: 0 };
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

        let oasClawback = 0;
        let oasMarg = 0;
        if (oasReceived > 0 && oasThreshold > 0 && inc > oasThreshold) {
            oasClawback = (inc - oasThreshold) * 0.15;
            if (oasClawback < oasReceived) {
                oasMarg = 0.15; // Within clawback zone, marginal rate increases by 15%
            } else {
                oasClawback = oasReceived; // Fully clawed back
            }
        }
        
        return { fed, prov: provT, cpp_ei: cpp + ei, oas_clawback: oasClawback, totalTax: fed + provT + cpp + ei + oasClawback, margRate: mF + mP + oasMarg };
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

    calcRRIFMin(p1, p2, age1, age2, alive1, alive2, rrspBase1, rrspBase2) {
        let r = { p1: 0, p2: 0, details: { p1: null, p2: null } };
        
        if(alive1 && p1.rrsp > 0 && age1 >= this.CONSTANTS.RRIF_START_AGE){ 
            let factor = this.getRrifFactor(age1);
            r.p1 = rrspBase1 * factor; 
            r.p1 = Math.min(r.p1, p1.rrsp); 
            r.details.p1 = { factor, bal: rrspBase1, min: r.p1 };
            p1.rrsp -= r.p1; 
        }
        
        if(alive2 && p2.rrsp > 0 && age2 >= this.CONSTANTS.RRIF_START_AGE){ 
            let factor = this.getRrifFactor(age2);
            r.p2 = rrspBase2 * factor; 
            r.p2 = Math.min(r.p2, p2.rrsp);
            r.details.p2 = { factor, bal: rrspBase2, min: r.p2 };
            p2.rrsp -= r.p2; 
        }
        
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

    handleSurplus(amount, p1, p2, alive1, alive2, log, i, tfsaLim, rrspLim1, rrspLim2, cryptoLim) {
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
            else if(t === 'crypto'){
                if (alive1 && r > 0) {
                    let take = Math.min(r, cryptoLim);
                    p1.crypto += take; p1.crypto_acb += take;
                    if(log) log.contributions.p1.crypto += take;
                    r -= take;
                }
                if (alive2 && r > 0) {
                    let take = Math.min(r, cryptoLim);
                    p2.crypto += take; p2.crypto_acb += take;
                    if(log) log.contributions.p2.crypto += take;
                    r -= take;
                }
            }
            else if(t === 'nreg'){
                if (alive1 && alive2) {
                    let half = r / 2;
                    p1.nreg += half; p1.acb += half; if(log) log.contributions.p1.nreg += half;
                    p2.nreg += half; p2.acb += half; if(log) log.contributions.p2.nreg += half;
                    r = 0;
                } else if(alive1) { 
                    p1.nreg += r; p1.acb += r; if(log) log.contributions.p1.nreg += r; r = 0; 
                } else if(alive2) { 
                    p2.nreg += r; p2.acb += r; if(log) log.contributions.p2.nreg += r; r = 0; 
                }
            } 
            else if(t === 'cash'){
                if (alive1 && alive2) {
                    let half = r / 2;
                    p1.cash += half; if(log) log.contributions.p1.cash += half;
                    p2.cash += half; if(log) log.contributions.p2.cash += half;
                    r = 0;
                } else if(alive1) { 
                    p1.cash += r; if(log) log.contributions.p1.cash += r; r = 0; 
                } else if(alive2) { 
                    p2.cash += r; if(log) log.contributions.p2.cash += r; r = 0; 
                }
            } 
        });
    }

    handleDeficit(amount, p1, p2, curInc1, curInc2, alive1, alive2, log, breakdown, taxBrackets, onWithdrawal, age1, age2, oasRec1 = 0, oasRec2 = 0, oasThresholdInf = 0) {
        let df = amount;
        let runInc1 = curInc1;
        let runInc2 = curInc2;
        const prov = this.getRaw('tax_province');
        const TOLERANCE = 50; 
        const strats = this.strategies.decum;

        // Helper to check if a specific bucket has funds
        let hasBal = (p, t) => {
            if (t === 'rrsp') return (p.rrif_acct + p.lif + p.lirf + p.rrsp) > 0;
            return p[t] > 0;
        };

        const wd = (p, t, a, pfx, mRate) => { 
            if(a <= 0) return {net: 0, tax: 0};
            
            // Treat 'rrsp' as a smart bucket: Drain RRIF -> LIF -> LIRF -> RRSP sequentially
            let accountsToPull = t === 'rrsp' ? ['rrif_acct', 'lif', 'lirf', 'rrsp'] : [t];
            let totalNetGot = 0;
            let totalTaxGot = 0;
            let remainingNeed = a;

            for (let act of accountsToPull) {
                if (remainingNeed <= 0.01) break;
                if (p[act] <= 0) continue;

                let isFullyTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(act);
                let isCapGain = ['nreg', 'crypto'].includes(act);
                let grossNeeded = remainingNeed;
                let effRate = 0;

                let acbKey = act === 'crypto' ? 'crypto_acb' : 'acb';

                if (isFullyTaxable) {
                    effRate = Math.min(mRate || 0, 0.54); 
                    grossNeeded = remainingNeed / (1 - effRate);
                } else if (isCapGain) {
                    let gainRatio = Math.max(0, 1 - (p[acbKey] / p[act]));
                    effRate = Math.min(mRate || 0, 0.54) * 0.5 * gainRatio;
                    grossNeeded = remainingNeed / (1 - effRate);
                }
                
                let tk = Math.min(p[act], grossNeeded);
                
                let currentAge = (pfx === 'p1') ? age1 : age2;
                
                // Detailed Breakdown Labels
                let logKey = act;
                if (act === 'rrsp' && currentAge >= this.CONSTANTS.RRIF_START_AGE) logKey = 'RRIF';
                else if (act === 'rrsp') logKey = 'RRSP';
                else if (act === 'rrif_acct') logKey = 'Manual RRIF';
                else if (act === 'lif') logKey = 'LIF';
                else if (act === 'lirf') logKey = 'LIRF';
                else if (act === 'tfsa') logKey = 'TFSA';
                else if (act === 'nreg') logKey = 'Non-Reg';
                else if (act === 'cash') logKey = 'Cash';
                else if (act === 'crypto') logKey = 'Crypto';

                p[act] -= tk;
                
                let taxableAmtForOnWithdrawal = 0;
                let acbSold = 0;
                let capGain = 0;
                
                if (isCapGain) {
                    let proportionSold = tk / (p[act] + tk); 
                    acbSold = p[acbKey] * proportionSold;
                    p[acbKey] = Math.max(0, p[acbKey] - acbSold);
                    capGain = tk - acbSold;
                    taxableAmtForOnWithdrawal = Math.max(0, capGain * 0.5); // 50% inclusion
                } else if (isFullyTaxable) {
                    taxableAmtForOnWithdrawal = tk;
                }

                if (log) {
                    let k = (pfx.toUpperCase()) + " " + logKey;
                    log.withdrawals[k] = (log.withdrawals[k] || 0) + tk;
                    if(breakdown) {
                        breakdown[pfx][logKey] = (breakdown[pfx][logKey] || 0) + tk;
                        
                        if (isCapGain) {
                            if (!breakdown[pfx][logKey + '_math']) breakdown[pfx][logKey + '_math'] = { wd: 0, acb: 0, gain: 0, tax: 0 };
                            breakdown[pfx][logKey + '_math'].wd += tk;
                            breakdown[pfx][logKey + '_math'].acb += acbSold;
                            breakdown[pfx][logKey + '_math'].gain += capGain;
                            breakdown[pfx][logKey + '_math'].tax += taxableAmtForOnWithdrawal;
                        }
                    }
                }
                
                if (onWithdrawal) {
                     if (isFullyTaxable) {
                         onWithdrawal(pfx, tk, 0); 
                     } else if (isCapGain) {
                         onWithdrawal(pfx, taxableAmtForOnWithdrawal, tk - taxableAmtForOnWithdrawal);
                     } else {
                         onWithdrawal(pfx, 0, tk); 
                     }
                }

                let netGot = tk * (1 - effRate);
                totalNetGot += netGot;
                totalTaxGot += taxableAmtForOnWithdrawal;
                remainingNeed -= netGot;
            }

            return {net: totalNetGot, tax: totalTaxGot};
        };

        const executeWithdrawalStrategy = (ceiling1, ceiling2) => {
            let p1Idx = 0;
            let p2Idx = 0;

            let sanityLimit = 200; // Hard cap to prevent infinite loops
            while (df > 1 && (p1Idx < strats.length || p2Idx < strats.length) && sanityLimit-- > 0) {
                
                // Find next available account for P1
                while(p1Idx < strats.length) {
                    let type = strats[p1Idx];
                    if (!alive1 || !hasBal(p1, type)) { p1Idx++; continue; }
                    let isTaxableAtAll = ['rrsp', 'nreg', 'crypto'].includes(type);
                    if (ceiling1 !== Infinity && isTaxableAtAll) {
                        if (ceiling1 - runInc1 <= 1) { p1Idx++; continue; }
                    }
                    break;
                }
                
                // Find next available account for P2
                while(p2Idx < strats.length) {
                    let type = strats[p2Idx];
                    if (!alive2 || !hasBal(p2, type)) { p2Idx++; continue; }
                    let isTaxableAtAll = ['rrsp', 'nreg', 'crypto'].includes(type);
                    if (ceiling2 !== Infinity && isTaxableAtAll) {
                        if (ceiling2 - runInc2 <= 1) { p2Idx++; continue; }
                    }
                    break;
                }

                const p1Type = p1Idx < strats.length ? strats[p1Idx] : null;
                const p2Type = p2Idx < strats.length ? strats[p2Idx] : null;

                if (!p1Type && !p2Type) break;

                const mR1 = this.calculateTaxDetailed(runInc1, prov, taxBrackets, oasRec1, oasThresholdInf).margRate;
                const mR2 = this.calculateTaxDetailed(runInc2, prov, taxBrackets, oasRec2, oasThresholdInf).margRate;

                let target = null;
                
                // --- STRICT STRATEGY ORDER ENFORCEMENT ---
                if (!p1Type) target = 'p2';
                else if (!p2Type) target = 'p1';
                else if (p1Idx < p2Idx) target = 'p1'; 
                else if (p2Idx < p1Idx) target = 'p2'; 
                else {
                    let isTaxFree = !['rrsp', 'nreg', 'crypto'].includes(p1Type);
                    if (isTaxFree) target = 'split'; 
                    else if (Math.abs(runInc1 - runInc2) < TOLERANCE) target = 'split';
                    else if (runInc1 < runInc2) target = 'p1';
                    else target = 'p2';
                }

                let getNetRoom = (type, inc, mR, pObj, ceil) => {
                    if (ceil === Infinity) return Infinity;
                    let isFullyTaxable = type === 'rrsp'; // applies to the whole bundle
                    let isCapGain = ['nreg', 'crypto'].includes(type);
                    
                    if (isFullyTaxable) {
                        let grossRoom = Math.max(0, ceil - inc);
                        return grossRoom * (1 - Math.min(mR || 0, 0.54));
                    } else if (isCapGain) {
                        let grossRoom = Math.max(0, ceil - inc);
                        let acbKey = type === 'crypto' ? 'crypto_acb' : 'acb';
                        let bal = pObj[type];
                        let gainRatio = bal > 0 ? Math.max(0, 1 - (pObj[acbKey] / bal)) : 0;
                        
                        if (gainRatio > 0) {
                            let cashRoom = grossRoom / (0.5 * gainRatio);
                            return cashRoom * (1 - (Math.min(mR || 0, 0.54) * 0.5 * gainRatio));
                        } else {
                            return Infinity; 
                        }
                    }
                    return Infinity;
                };

                if (target === 'split') {
                    let netRoom1 = getNetRoom(p1Type, runInc1, mR1, p1, ceiling1);
                    let netRoom2 = getNetRoom(p2Type, runInc2, mR2, p2, ceiling2);
                    
                    let half = df / 2;
                    let req1 = Math.min(half, netRoom1);
                    let req2 = Math.min(half, netRoom2);

                    if (req1 < half) req2 = Math.min(df - req1, netRoom2);
                    if (req2 < half) req1 = Math.min(df - req2, netRoom1);

                    if (req1 > 0 && req1 < 10) req1 = Math.min(df, netRoom1);
                    if (req2 > 0 && req2 < 10) req2 = Math.min(df, netRoom2);

                    let gotP1 = req1 > 0 ? wd(p1, p1Type, req1, 'p1', mR1) : {net: 0, tax: 0};
                    let gotP2 = req2 > 0 ? wd(p2, p2Type, req2, 'p2', mR2) : {net: 0, tax: 0};

                    if (gotP1.net <= 0.01 && gotP1.tax <= 0.01 && req1 > 0) {
                        if (p1Type === 'rrsp') { p1.rrsp = 0; p1.rrif_acct = 0; p1.lif = 0; p1.lirf = 0; } else p1[p1Type] = 0;
                    }
                    if (gotP2.net <= 0.01 && gotP2.tax <= 0.01 && req2 > 0) {
                        if (p2Type === 'rrsp') { p2.rrsp = 0; p2.rrif_acct = 0; p2.lif = 0; p2.lirf = 0; } else p2[p2Type] = 0;
                    }

                    df -= (gotP1.net + gotP2.net);
                    runInc1 += gotP1.tax;
                    runInc2 += gotP2.tax;
                } else {
                    let toTake = df;
                    let pObj = target === 'p1' ? p1 : p2;
                    let tType = target === 'p1' ? p1Type : p2Type;
                    let mR = target === 'p1' ? mR1 : mR2;
                    let inc = target === 'p1' ? runInc1 : runInc2;
                    let ceil = target === 'p1' ? ceiling1 : ceiling2;
                    let netRoom = getNetRoom(tType, inc, mR, pObj, ceil);

                    if (p1Type && p2Type && p1Idx === p2Idx && !['tfsa','cash'].includes(tType)) {
                        let gap = Math.abs(runInc1 - runInc2);
                        let effRate = Math.min(mR || 0, 0.54);
                        
                        if (['nreg', 'crypto'].includes(tType)) {
                            let acbKey = tType === 'crypto' ? 'crypto_acb' : 'acb';
                            let bal = pObj[tType];
                            let gainRatio = bal > 0 ? Math.max(0, 1 - (pObj[acbKey] / bal)) : 0;
                            effRate = effRate * 0.5 * gainRatio;
                        }
                        
                        let netGap = gap * (1 - effRate);
                        if (netGap > 0) toTake = Math.min(toTake, netGap);
                    }

                    toTake = Math.min(toTake, netRoom);
                    if (toTake < 10 && toTake < netRoom) toTake = Math.min(df, netRoom, 500);

                    let got = wd(pObj, tType, toTake, target, mR);
                    
                    if (got.net <= 0.01 && got.tax <= 0.01) {
                        if (tType === 'rrsp') { pObj.rrsp = 0; pObj.rrif_acct = 0; pObj.lif = 0; pObj.lirf = 0; } else pObj[tType] = 0;
                    }
                    
                    df -= got.net;
                    if (target === 'p1') runInc1 += got.tax;
                    else runInc2 += got.tax;
                }
            }
        };

        const lowestBracket = taxBrackets.FED.brackets[0]; 
        const optimizeOAS = this.inputs['oas_clawback_optimize'];

        // Pass 1: Try to withdraw while enforcing the lowest tax bracket ceiling on all taxable accounts
        executeWithdrawalStrategy(lowestBracket, lowestBracket);
        
        // Pass 2: Enforce OAS Clawback Threshold ceiling (if enabled and applicable)
        if (df > 1 && optimizeOAS) {
            let p1Ceil = age1 >= 65 ? oasThresholdInf : Infinity;
            let p2Ceil = age2 >= 65 ? oasThresholdInf : Infinity;
            if (p1Ceil !== Infinity || p2Ceil !== Infinity) {
                executeWithdrawalStrategy(p1Ceil, p2Ceil);
            }
        }
        
        // Pass 3: If we STILL have a deficit, drop the ceiling rules and take what we need to survive
        if (df > 1) {
            executeWithdrawalStrategy(Infinity, Infinity);
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

        let person1 = { tfsa: this.getVal('p1_tfsa'), rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), crypto: this.getVal('p1_crypto'), lirf: this.getVal('p1_lirf'), lif: this.getVal('p1_lif'), rrif_acct: this.getVal('p1_rrif_acct'), inc: this.getVal('p1_income'), dob: new Date(this.getRaw('p1_dob') || "1990-01"), retAge: this.getVal('p1_retireAge'), lifeExp: this.getVal('p1_lifeExp'), nreg_yield: this.getVal('p1_nonreg_yield')/100, acb: this.getVal('p1_nonreg'), crypto_acb: this.getVal('p1_crypto') };
        let person2 = { tfsa: this.getVal('p2_tfsa'), rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), dob: new Date(this.getRaw('p2_dob') || "1990-01"), retAge: this.getVal('p2_retireAge'), lifeExp: this.getVal('p2_lifeExp'), nreg_yield: this.getVal('p2_nonreg_yield')/100, acb: this.getVal('p2_nonreg'), crypto_acb: this.getVal('p2_crypto') };

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
            cryptoLimit: this.inputs['cfg_crypto_limit'] !== undefined ? this.getVal('cfg_crypto_limit') : 5000,
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
            const oasThresholdInf = this.CONSTANTS.OAS_CLAWBACK_THRESHOLD * bInf;
            
            const isRet1 = age1 >= person1.retAge;
            const isRet2 = this.mode === 'Couple' ? age2 >= person2.retAge : true;
            
            // Capture balances BEFORE growth for accurate RRIF math
            const preGrowthRrsp1 = person1.rrsp;
            const preGrowthRrsp2 = person2.rrsp;

            this.applyGrowth(person1, person2, isRet1, isRet2, this.inputs['asset_mode_advanced'], consts.inflation, i, simContext);

            const inflows = this.calcInflows(yr, i, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, consts, bInf, detailed ? trackedEvents : null);
            
            // Pass the pre-growth balances to the RRIF calculator
            const rrifMin = this.calcRRIFMin(person1, person2, age1, age2, alive1, alive2, preGrowthRrsp1, preGrowthRrsp2);
            
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
            
            let tax1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};
            let tax2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};

            let netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
            let netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
            
            let totalNetIncome = netIncome1 + netIncome2;
            const totalOutflows = expenses + mortgagePayment + debtRepayment;
            let surplus = totalNetIncome - totalOutflows;

            let flowLog = detailed ? { contributions: { p1: {tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0}, p2: {tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0} }, withdrawals: {} } : null;
            let wdBreakdown = detailed ? { p1: {}, p2: {} } : null;

            if(detailed) {
                if(rrifMin.p1 > 0) { 
                    flowLog.withdrawals['P1 RRIF'] = (flowLog.withdrawals['P1 RRIF'] || 0) + rrifMin.p1; 
                    wdBreakdown.p1.RRIF = rrifMin.p1; 
                    wdBreakdown.p1.RRIF_math = rrifMin.details.p1;
                }
                if(rrifMin.p2 > 0) { 
                    flowLog.withdrawals['P2 RRIF'] = (flowLog.withdrawals['P2 RRIF'] || 0) + rrifMin.p2; 
                    wdBreakdown.p2.RRIF = rrifMin.p2; 
                    wdBreakdown.p2.RRIF_math = rrifMin.details.p2;
                }
                if(rrspDed.p1 > 0) { flowLog.withdrawals['P1 RRSP Top-Up'] = (flowLog.withdrawals['P1 RRSP Top-Up'] || 0) + rrspDed.p1; wdBreakdown.p1.RRSP = (wdBreakdown.p1.RRSP || 0) + rrspDed.p1; }
                if(rrspDed.p2 > 0) { flowLog.withdrawals['P2 RRSP Top-Up'] = (flowLog.withdrawals['P2 RRSP Top-Up'] || 0) + rrspDed.p2; wdBreakdown.p2.RRSP = (wdBreakdown.p2.RRSP || 0) + rrspDed.p2; }
            }

            const rrspRoom1 = Math.min(inflows.p1.earned * 0.18, consts.rrspMax * bInf);
            const rrspRoom2 = Math.min(inflows.p2.earned * 0.18, consts.rrspMax * bInf);

            if (surplus > 0) {
                this.handleSurplus(surplus, person1, person2, alive1, alive2, flowLog, i, consts.tfsaLimit * bInf, rrspRoom1, rrspRoom2, consts.cryptoLimit * bInf);
            } else {
                let cashFromNonTaxableWd = 0; 
                for(let pass = 0; pass < 5; pass++) {
                    let dynTax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf);
                    let dynTax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf);
                    
                    tax1 = dynTax1; 
                    tax2 = dynTax2;

                    let dynNet1 = taxableIncome1 - dynTax1.totalTax + inflows.p1.windfallNonTax;
                    let dynNet2 = alive2 ? taxableIncome2 - dynTax2.totalTax + inflows.p2.windfallNonTax : 0;
                    let dynTotalNet = dynNet1 + dynNet2;
                    
                    let currentDeficit = totalOutflows - (dynTotalNet + cashFromNonTaxableWd);
                    
                    if (currentDeficit < 1) break; 
                    
                    this.handleDeficit(currentDeficit, person1, person2, taxableIncome1, taxableIncome2, alive1, alive2, flowLog, wdBreakdown, taxBrackets, (pfx, taxAmt, nonTaxAmt) => {
                        if (pfx === 'p1') taxableIncome1 += taxAmt;
                        if (pfx === 'p2') taxableIncome2 += taxAmt;
                        cashFromNonTaxableWd += nonTaxAmt;
                    }, age1, age2, inflows.p1.oas, inflows.p2.oas, oasThresholdInf);
                }
                
                tax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf);
                tax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf);
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
                    oasClawbackP1: tax1.oas_clawback || 0, oasClawbackP2: tax2.oas_clawback || 0,
                    taxIncP1: taxableIncome1, taxIncP2: taxableIncome2,
                    oasThreshold: oasThresholdInf,
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
                    debugTotalInflow: grossInflow,
                    rrspRoomP1: rrspRoom1, rrspRoomP2: rrspRoom2
                });
            }

            consts.cppMax1 *= (1 + consts.inflation); consts.oasMax1 *= (1 + consts.inflation);
            consts.cppMax2 *= (1 + consts.inflation); consts.oasMax2 *= (1 + consts.inflation);
        }
        
        return detailed ? projectionData : nwArray;
    }
}
