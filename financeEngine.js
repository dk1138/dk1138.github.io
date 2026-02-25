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
        this.leaves = data.leaves || []; 
        this.strategies = data.strategies || { accum: [], decum: [] };
        this.dependents = data.dependents || []; 
        this.debt = data.debt || []; 
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

    getLifMaxFactor(age, prov) {
        const group1 = ['BC', 'AB', 'SK', 'ON', 'NB', 'NL'];
        const group2 = ['MB', 'QC', 'NS'];
        
        let type = 'fed'; 
        if (group1.includes(prov)) type = 'g1';
        else if (group2.includes(prov)) type = 'g2';

        const maxRates = {
            'g1': {
                55: 0.0651, 56: 0.0657, 57: 0.0663, 58: 0.0670, 59: 0.0677, 60: 0.0685, 61: 0.0694, 62: 0.0704, 63: 0.0714, 64: 0.0726, 
                65: 0.0738, 66: 0.0752, 67: 0.0767, 68: 0.0783, 69: 0.0802, 70: 0.0822, 71: 0.0845, 72: 0.0871, 73: 0.0900, 74: 0.0934, 
                75: 0.0971, 76: 0.1015, 77: 0.1066, 78: 0.1125, 79: 0.1196, 80: 0.1282, 81: 0.1387, 82: 0.1519, 83: 0.1690, 84: 0.1919, 
                85: 0.2240, 86: 0.2723, 87: 0.3529, 88: 0.5146
            },
            'g2': {
                55: 0.0640, 56: 0.0650, 57: 0.0650, 58: 0.0660, 59: 0.0670, 60: 0.0670, 61: 0.0680, 62: 0.0690, 63: 0.0700, 64: 0.0710, 
                65: 0.0720, 66: 0.0730, 67: 0.0740, 68: 0.0760, 69: 0.0770, 70: 0.0790, 71: 0.0810, 72: 0.0830, 73: 0.0850, 74: 0.0880, 
                75: 0.0910, 76: 0.0940, 77: 0.0980, 78: 0.1030, 79: 0.1080, 80: 0.1150, 81: 0.1210, 82: 0.1290, 83: 0.1380, 84: 0.1480, 
                85: 0.1600, 86: 0.1730, 87: 0.1890, 88: 0.2000
            },
            'fed': {
                55: 0.0516, 56: 0.0522, 57: 0.0527, 58: 0.0534, 59: 0.0541, 60: 0.0548, 61: 0.0556, 62: 0.0565, 63: 0.0575, 64: 0.0586, 
                65: 0.0598, 66: 0.0611, 67: 0.0625, 68: 0.0641, 69: 0.0660, 70: 0.0680, 71: 0.0703, 72: 0.0729, 73: 0.0759, 74: 0.0793, 
                75: 0.0833, 76: 0.0879, 77: 0.0932, 78: 0.0994, 79: 0.1068, 80: 0.1157, 81: 0.1265, 82: 0.1401, 83: 0.1575, 84: 0.1809, 
                85: 0.2136, 86: 0.2626, 87: 0.3445, 88: 0.5083
            }
        };

        if (age >= 89) return type === 'g2' ? 0.2000 : 1.0000;
        if (age < 55) return maxRates[type][55]; 
        return maxRates[type][age] || (type === 'g2' ? 0.2000 : 1.0000);
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

    calculateCCBForYear(currentYear, dependents, familyNetIncome, bInf) {
        if (!dependents || dependents.length === 0) return 0;
        const rules = this.CONSTANTS.CCB_RULES;
        if (!rules) return 0;

        let countUnder6 = 0;
        let count6to17 = 0;
        let activeKids = 0;

        dependents.forEach(dep => {
            let parts = dep.dob.split('-');
            let birthYear = parseInt(parts[0]);
            let birthMonth = parseInt(parts[1]) || 1; 
            
            let turns6Year = birthYear + 6;
            let turns18Year = birthYear + 18;

            if (currentYear < turns18Year) {
                activeKids++;
            } else if (currentYear === turns18Year) {
                activeKids++;
            }

            if (currentYear < turns6Year) {
                countUnder6 += 1;
            } else if (currentYear === turns6Year) {
                let under6Fraction = birthMonth / 12;
                let over6Fraction = (12 - birthMonth) / 12;
                countUnder6 += under6Fraction;
                count6to17 += over6Fraction;
            } else if (currentYear < turns18Year) {
                count6to17 += 1;
            } else if (currentYear === turns18Year) {
                let over6Fraction = birthMonth / 12;
                count6to17 += over6Fraction;
            }
        });

        if (activeKids === 0) return 0;

        let maxUnder6 = rules.MAX_UNDER_6 * bInf;
        let max6to17 = rules.MAX_6_TO_17 * bInf;
        let thresh1 = rules.THRESHOLD_1 * bInf;
        let thresh2 = rules.THRESHOLD_2 * bInf;

        let maxBenefit = (countUnder6 * maxUnder6) + (count6to17 * max6to17);
        
        let rateIndex = Math.max(0, Math.min(activeKids - 1, 3));
        let reduction = 0;

        if (familyNetIncome > thresh2) {
            let bracket1MaxReduction = (thresh2 - thresh1) * rules.RATE_1[rateIndex];
            reduction = bracket1MaxReduction + ((familyNetIncome - thresh2) * rules.RATE_2[rateIndex]);
        } else if (familyNetIncome > thresh1) {
            reduction = (familyNetIncome - thresh1) * rules.RATE_1[rateIndex];
        }

        return Math.max(0, maxBenefit - reduction);
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
        
        let oasClawback = 0;
        let oasMarg = 0;
        if (oasReceived > 0 && oasThreshold > 0 && inc > oasThreshold) {
            oasClawback = (inc - oasThreshold) * 0.15;
            if (oasClawback < oasReceived) {
                oasMarg = 0.15; 
            } else {
                oasClawback = oasReceived; 
            }
        }

        let taxIncForFedProv = Math.max(0, inc - oasClawback);
        
        const D = tDat;
        const fC = this.calculateProgressiveTax(taxIncForFedProv, D.FED.brackets, D.FED.rates);
        const pC = this.calculateProgressiveTax(taxIncForFedProv, D[prov]?.brackets || [999999999], D[prov]?.rates || [0.10]);
        let fed = fC.tax, provT = pC.tax, mF = fC.marg, mP = pC.marg;
        
        if(prov === 'ON'){ 
            let s = 0; 
            if(D.ON.surtax){ 
                if(provT > D.ON.surtax.t1) s += (provT - D.ON.surtax.t1) * D.ON.surtax.r1; 
                if(provT > D.ON.surtax.t2) s += (provT - D.ON.surtax.t2) * D.ON.surtax.r2; 
            } 
            if(s > 0) mP *= 1.56; 
            provT += s + (taxIncForFedProv > 20000 ? Math.min(900, (taxIncForFedProv - 20000) * 0.06) : 0); 
        }
        if(prov === 'PE' && D.PE.surtax && provT > D.PE.surtax.t1) provT += (provT - D.PE.surtax.t1) * D.PE.surtax.r1;
        if(prov === 'QC' && D.QC.abatement) fed -= fed * D.QC.abatement;
        
        let cpp = 0; 
        if(inc > 3500) cpp += (Math.min(inc, 74600) - 3500) * 0.0595; 
        if(inc > 74600) cpp += (Math.min(inc, 85000) - 74600) * 0.04;
        const ei = Math.min(inc, 68900) * 0.0164;

        let actualMargRate = mF + mP;
        if (oasMarg > 0) {
            actualMargRate = 0.15 + 0.85 * (mF + mP);
        }
        
        return { fed, prov: provT, cpp_ei: cpp + ei, oas_clawback: oasClawback, totalTax: fed + provT + cpp + ei + oasClawback, margRate: actualMargRate };
    }

    applyGrowth(p1, p2, isRet1, isRet2, isAdv, inf, i, simContext) {
        const stress = this.inputs['stressTestEnabled'] && i === 0; 
        const getRates = (p, ret) => {
            const r = id => this.getVal(`${p}_${id}_ret` + (isAdv && ret ? '_retire' : '')) / 100;
            return { 
                tfsa: r('tfsa'), rrsp: r('rrsp'), cash: r('cash'), nreg: r('nonreg'), 
                crypto: r('crypto'), lirf: r('lirf'), lif: r('lif'), rrif_acct: r('rrif_acct'), 
                fhsa: r('fhsa'), resp: r('resp') || 0,
                inc: this.getVal(`${p}_income_growth`) / 100 
            };
        };
        const g1 = getRates('p1', isRet1), g2 = getRates('p2', isRet2);
        
        if(stress) { 
            ['tfsa','rrsp','nreg','cash','lirf','lif','rrif_acct','crypto', 'fhsa', 'resp'].forEach(k => { 
                if(g1[k] !== undefined) g1[k] = -0.15; 
                if(g2[k] !== undefined) g2[k] = -0.15; 
            }); 
            g1.crypto = -0.40; g2.crypto = -0.40; 
        }

        if (simContext) {
            let shock = 0;
            if (simContext.method === 'historical' && simContext.histSequence) {
                shock = simContext.histSequence[i] - 0.10;
            } else if (simContext.volatility) {
                shock = this.randn_bm() * simContext.volatility;
            }
            if (shock !== 0) {
                ['tfsa','rrsp','nreg','crypto','lirf','lif','rrif_acct', 'fhsa', 'resp'].forEach(k => { 
                    if(g1[k] !== undefined) g1[k] += shock; 
                    if(g2[k] !== undefined) g2[k] += shock; 
                });
            }
        }

        const grow = (p, rates, isRet) => {
            p.tfsa *= (1 + rates.tfsa);
            if (p.tfsa_successor !== undefined) p.tfsa_successor *= (1 + rates.tfsa); 
            p.rrsp *= (1 + rates.rrsp); p.cash *= (1 + rates.cash); p.crypto *= (1 + rates.crypto);
            p.lirf *= (1 + rates.lirf); p.lif *= (1 + rates.lif); p.rrif_acct *= (1 + rates.rrif_acct);
            p.nreg *= (1 + (rates.nreg - p.nreg_yield));
            if (p.fhsa !== undefined) p.fhsa *= (1 + rates.fhsa);
            if (p.resp !== undefined) p.resp *= (1 + rates.resp);
            
            if(!isRet && i > 0) p.inc *= (1 + rates.inc); 
        };
        
        grow(p1, g1, isRet1); 
        grow(p2, g2, isRet2);
    }

    calcInflows(yr, i, p1, p2, age1, age2, alive1, alive2, isRet1, isRet2, c, bInf, trackedEvents = null) {
        let res = { 
            p1: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0, ccb:0, eiMat:0, topUp:0 }, 
            p2: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0, ccb:0, eiMat:0, topUp:0 },
            events: []
        };
        
        const calcP = (p, age, isRet, pfx, maxCpp, maxOas) => {
            let inf = { gross:0, earned:0, cpp:0, oas:0, pension:0, postRet:0, eiMat:0, topUp:0 };
            
            if(!isRet) { 
                let baseInc = p.inc;
                let workFraction = 1.0;
                let eiTotal = 0;
                let topUpTotal = 0;

                // --- Calculate Leaves of Absence (e.g. Maternity) ---
                this.leaves.forEach(l => {
                    if (l.owner === pfx) {
                        let [ly, lm] = (l.start || "2026-01").split('-');
                        let ls = new Date(parseInt(ly), parseInt(lm) - 1, 1);
                        let le = new Date(ls.getTime() + (l.durationWeeks || 0) * 7 * 24 * 60 * 60 * 1000);
                        let te = new Date(ls.getTime() + (l.topUpWeeks || 0) * 7 * 24 * 60 * 60 * 1000);
                        
                        let ys = new Date(yr, 0, 1);
                        let ye = new Date(yr, 11, 31, 23, 59, 59);

                        let overlapStart = new Date(Math.max(ls.getTime(), ys.getTime()));
                        let overlapEnd = new Date(Math.min(le.getTime(), ye.getTime()));
                        let leaveWeeksInYear = overlapStart < overlapEnd ? (overlapEnd - overlapStart) / (7 * 24 * 60 * 60 * 1000) : 0;

                        let topUpOverlapStart = new Date(Math.max(ls.getTime(), ys.getTime()));
                        let topUpOverlapEnd = new Date(Math.min(te.getTime(), ye.getTime()));
                        let topUpWeeksInYear = topUpOverlapStart < topUpOverlapEnd ? (topUpOverlapEnd - topUpOverlapStart) / (7 * 24 * 60 * 60 * 1000) : 0;

                        if (leaveWeeksInYear > 0) {
                            let weeklySal = baseInc / 52;
                            let maxEi = (this.CONSTANTS.MAX_EI_WEEKLY_BENEFIT || 720) * bInf;
                            let repRate = this.CONSTANTS.EI_REPLACEMENT_RATE || 0.55;
                            let weeklyEI = Math.min(maxEi, weeklySal * repRate);
                            
                            let weeklyTopUpTarget = weeklySal * ((l.topUpPercent || 0) / 100);
                            let weeklyTopUpAmt = Math.max(0, weeklyTopUpTarget - weeklyEI);

                            workFraction -= (leaveWeeksInYear / 52);
                            eiTotal += (leaveWeeksInYear * weeklyEI);
                            topUpTotal += (topUpWeeksInYear * weeklyTopUpAmt);
                            
                            if (trackedEvents && !trackedEvents.has(`${pfx.toUpperCase()} Leave`)) {
                                trackedEvents.add(`${pfx.toUpperCase()} Leave`);
                                res.events.push(`${pfx.toUpperCase()} Leave`);
                            }
                        }
                    }
                });

                workFraction = Math.max(0, workFraction);
                let proratedInc = baseInc * workFraction;
                
                inf.gross += proratedInc + eiTotal + topUpTotal;
                inf.earned += proratedInc + topUpTotal; 
                inf.eiMat += eiTotal;
                inf.topUp += topUpTotal;
            }
            
            if(this.inputs[`${pfx}_db_enabled`]) {
                const lStart = parseInt(this.getRaw(`${pfx}_db_lifetime_start`) || 60);
                const bStart = parseInt(this.getRaw(`${pfx}_db_bridge_start`) || 60);
                const isIndexed = this.inputs[`${pfx}_db_indexed`] !== undefined ? this.inputs[`${pfx}_db_indexed`] : true;
                const dbMultiplier = isIndexed ? bInf : 1.0;
                
                if(age >= lStart) inf.pension += this.getVal(`${pfx}_db_lifetime`) * 12 * dbMultiplier;
                if(age >= bStart && age < 65) inf.pension += this.getVal(`${pfx}_db_bridge`) * 12 * dbMultiplier;
            }

            if(this.inputs[`${pfx}_cpp_enabled`] && age >= parseInt(this.getRaw(`${pfx}_cpp_start`))) {
                inf.cpp = this.calcBen(maxCpp, parseInt(this.getRaw(`${pfx}_cpp_start`)), 1, p.retAge, 'cpp');
                if(trackedEvents && age === parseInt(this.getRaw(`${pfx}_cpp_start`))) { trackedEvents.add(`${pfx.toUpperCase()} CPP`); }
            }
            if(this.inputs[`${pfx}_oas_enabled`] && age >= parseInt(this.getRaw(`${pfx}_oas_start`))) {
                let baseOas = this.calcBen(maxOas, parseInt(this.getRaw(`${pfx}_oas_start`)), 1, 65, 'oas');
                if (age >= 75) {
                    baseOas *= 1.10; 
                }
                inf.oas = baseOas;
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
            let act = false, amt = 0, sY = new Date((w.start || "2026-01") + "-01").getFullYear();
            if(w.freq === 'one') { 
                if(sY === yr) { act = true; amt = w.amount; } 
            } else { 
                let eY = (w.end ? new Date(w.end + "-01") : new Date("2100-01-01")).getFullYear(); 
                if(yr >= sY && yr <= eY) { 
                    act = true; 
                    amt = w.amount * (w.freq === 'month' ? (yr === sY ? 12 - new Date((w.start||"2026-01") + "-01").getMonth() : (yr === eY ? new Date(w.end + "-01").getMonth() + 1 : 12)) : 1); 
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
                sY = new Date((s.start||"2026-01") + "-01").getFullYear();
            }

            if (s.endMode === 'duration') {
                eY = sY + (s.duration || 0);
            } else {
                eY = (s.end ? new Date(s.end + "-01") : new Date("2100-01-01")).getFullYear();
            }

            if(yr >= sY && yr <= eY) {
                let baseYear = s.startMode === 'ret_relative' ? sY : new Date((s.start||"2026-01") + "-01").getFullYear();
                let amt = s.amount * Math.pow(1 + (s.growth / 100), yr - baseYear) * (s.freq === 'month' ? 12 : 1);
                
                if (s.startMode === 'date' && yr === sY) amt *= (12 - new Date((s.start||"2026-01") + "-01").getMonth()) / 12;
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

    calcRegMinimums(p1, p2, age1, age2, alive1, alive2, preRrsp1, preRrif1, preRrsp2, preRrif2, preLirf1, preLif1, preLirf2, preLif2) {
        let r = { p1: 0, p2: 0, lifTaken1: 0, lifTaken2: 0, details: { p1: null, p2: null } };
        
        const calcMin = (p, age, preRrsp, preRrif, preLirf, preLif) => {
            let factor = this.getRrifFactor(age - 1);
            let baseBal = age >= this.CONSTANTS.RRIF_START_AGE ? (preRrsp + preRrif) : preRrif;
            let baseLifBal = age >= this.CONSTANTS.RRIF_START_AGE ? (preLirf + preLif) : preLif;
            
            let reqRrifMin = baseBal * factor;
            let reqLifMin = baseLifBal * factor;
            
            let actualRrifTaken = 0;
            let actualLifTaken = 0;
            
            if (baseBal > 0) {
                let minNeeded = reqRrifMin;
                let tkRrif = Math.min(p.rrif_acct, minNeeded);
                p.rrif_acct -= tkRrif;
                actualRrifTaken += tkRrif;
                minNeeded -= tkRrif;
                
                if (minNeeded > 0 && age >= this.CONSTANTS.RRIF_START_AGE) {
                    let tkRrsp = Math.min(p.rrsp, minNeeded);
                    p.rrsp -= tkRrsp;
                    actualRrifTaken += tkRrsp;
                }
            }

            if (baseLifBal > 0) {
                let minNeeded = reqLifMin;
                let tkLif = Math.min(p.lif, minNeeded);
                p.lif -= tkLif;
                actualLifTaken += tkLif;
                minNeeded -= tkLif;

                if (minNeeded > 0 && age >= this.CONSTANTS.RRIF_START_AGE) {
                    let tkLirf = Math.min(p.lirf, minNeeded);
                    p.lirf -= tkLirf;
                    actualLifTaken += tkLirf;
                }
            }
            
            return { 
                rrifTaken: actualRrifTaken, 
                lifTaken: actualLifTaken, 
                details: { 
                    factor, 
                    bal: baseBal, 
                    min: reqRrifMin, 
                    lifBal: baseLifBal, 
                    lifMin: reqLifMin 
                } 
            };
        };
        
        if (alive1) { 
            let res = calcMin(p1, age1, preRrsp1, preRrif1, preLirf1, preLif1); 
            r.p1 = res.rrifTaken; 
            r.lifTaken1 = res.lifTaken;
            r.details.p1 = res.details; 
        }
        if (alive2) { 
            let res = calcMin(p2, age2, preRrsp2, preRrif2, preLirf2, preLif2); 
            r.p2 = res.rrifTaken; 
            r.lifTaken2 = res.lifTaken;
            r.details.p2 = res.details; 
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

    applyPensionSplitting(t1, t2, inf, regMins, p1, p2, age1, age2, setTaxes) {
        let eligibleP1 = inf.p1.pension;
        let eligibleP2 = inf.p2.pension;
        if (age1 >= 65) { eligibleP1 += regMins.p1 + regMins.lifTaken1; }
        if (age2 >= 65) { eligibleP2 += regMins.p2 + regMins.lifTaken2; }

        if (t1 > t2 && eligibleP1 > 0) {
            let maxTransfer = eligibleP1 * 0.5;
            let diff = t1 - t2;
            let transfer = Math.min(maxTransfer, diff / 2);
            if (transfer > 0) setTaxes(t1 - transfer, t2 + transfer, transfer, 'p1_to_p2');
        } else if (t2 > t1 && eligibleP2 > 0) {
            let maxTransfer = eligibleP2 * 0.5;
            let diff = t2 - t1;
            let transfer = Math.min(maxTransfer, diff / 2);
            if (transfer > 0) setTaxes(t1 + transfer, t2 - transfer, transfer, 'p2_to_p1');
        }
    }

    handleSurplus(amount, p1, p2, alive1, alive2, log, i, tfsaLim, rrspLim1, rrspLim2, cryptoLim, fhsaLim1, fhsaLim2, respLim, deductionsObj) {
        let r = amount;
        this.strategies.accum.forEach(t => { 
            if(r <= 0) return;
            if(t === 'tfsa' && tfsaLim > 0){ 
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
                const p1HasRoom = (!this.inputs['skip_first_rrsp_p1'] || i > 0) && alive1 && rrspLim1 > 0;
                const p2HasRoom = (!this.inputs['skip_first_rrsp_p2'] || i > 0) && alive2 && rrspLim2 > 0;
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
                        if(deductionsObj) deductionsObj[obj.k] += take;
                        r -= take;
                    }
                });
            }
            else if (t === 'fhsa') {
                if(alive1 && r > 0 && p1.fhsa !== undefined && fhsaLim1 > 0) {
                    let take = Math.min(r, fhsaLim1); p1.fhsa += take;
                    if(log) log.contributions.p1.fhsa += take;
                    if(deductionsObj) deductionsObj.p1 += take;
                    r -= take;
                }
                if(alive2 && r > 0 && p2.fhsa !== undefined && fhsaLim2 > 0) {
                    let take = Math.min(r, fhsaLim2); p2.fhsa += take;
                    if(log) log.contributions.p2.fhsa += take;
                    if(deductionsObj) deductionsObj.p2 += take;
                    r -= take;
                }
            }
            else if (t === 'resp' && respLim > 0) {
                if(alive1 && r > 0 && p1.resp !== undefined) {
                    let take = Math.min(r, respLim); 
                    p1.resp += take;
                    if(log) log.contributions.p1.resp += take;
                    let cesgMatch = take * (this.CONSTANTS.RESP_CESG_MATCH_RATE || 0.20);
                    p1.resp += cesgMatch;
                    r -= take;
                }
            }
            else if(t === 'crypto' && cryptoLim > 0){
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

    handleDeficit(amount, p1, p2, curInc1, curInc2, alive1, alive2, log, breakdown, taxBrackets, onWithdrawal, age1, age2, oasRec1 = 0, oasRec2 = 0, oasThresholdInf = 0, lifLimits = {lifMax1: Infinity, lifMax2: Infinity}) {
        let df = amount;
        let runInc1 = curInc1;
        let runInc2 = curInc2;
        const prov = this.getRaw('tax_province');
        const TOLERANCE = 50; 
        const strats = this.strategies.decum;

        let hasBal = (p, t, pfx) => {
            if (t === 'tfsa') return (p.tfsa + (p.tfsa_successor || 0)) > 0;
            if (p[t] === undefined) return false;
            if (p[t] <= 0) return false;
            if (t === 'lif' || t === 'lirf') {
                let maxL = pfx === 'p1' ? lifLimits.lifMax1 : lifLimits.lifMax2;
                if (maxL <= 0.01) return false;
            }
            return true;
        };

        const wd = (p, t, a, pfx, mRate) => { 
            if(a <= 0) return {net: 0, tax: 0};
            
            let accountsToPull;
            if (t === 'tfsa') accountsToPull = ['tfsa', 'tfsa_successor'];
            else accountsToPull = [t];

            let totalNetGot = 0;
            let totalTaxGot = 0;
            let remainingNeed = a;

            for (let act of accountsToPull) {
                if (remainingNeed <= 0.01) break;
                if (!p[act] || p[act] <= 0) continue;

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
                
                let currentAge = (pfx === 'p1') ? age1 : age2;
                let availableActBal = p[act];
                
                if (act === 'lif' || act === 'lirf') {
                    let maxL = pfx === 'p1' ? lifLimits.lifMax1 : lifLimits.lifMax2;
                    availableActBal = Math.min(availableActBal, maxL);
                    if (availableActBal <= 0.01) continue; 
                }
                
                let tk = Math.min(availableActBal, grossNeeded);

                if (act === 'lif' || act === 'lirf') {
                    if (pfx === 'p1') lifLimits.lifMax1 -= tk;
                    else lifLimits.lifMax2 -= tk;
                }
                
                let logKey = act;
                if (act === 'rrsp' && currentAge >= this.CONSTANTS.RRIF_START_AGE) logKey = 'RRIF';
                else if (act === 'rrsp') logKey = 'RRSP';
                else if (act === 'rrif_acct') logKey = 'Manual RRIF';
                else if (act === 'lif') logKey = 'LIF';
                else if (act === 'lirf') logKey = 'LIRF';
                else if (act === 'tfsa') logKey = 'TFSA';
                else if (act === 'tfsa_successor') logKey = 'TFSA (Successor)';
                else if (act === 'fhsa') logKey = 'FHSA';
                else if (act === 'resp') logKey = 'RESP';
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
                    taxableAmtForOnWithdrawal = Math.max(0, capGain * 0.5); 
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

        const executeWithdrawalStrategy = (ceiling1, ceiling2, currentStrats) => {
            let p1Idx = 0;
            let p2Idx = 0;

            let sanityLimit = 200; 
            while (df > 1 && (p1Idx < currentStrats.length || p2Idx < currentStrats.length) && sanityLimit-- > 0) {
                
                while(p1Idx < currentStrats.length) {
                    let type = currentStrats[p1Idx];
                    if (!alive1 || !hasBal(p1, type, 'p1')) { p1Idx++; continue; }
                    let isTaxableAtAll = ['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(type);
                    if (ceiling1 !== Infinity && isTaxableAtAll) {
                        if (ceiling1 - runInc1 <= 1) { p1Idx++; continue; }
                    }
                    break;
                }
                
                while(p2Idx < currentStrats.length) {
                    let type = currentStrats[p2Idx];
                    if (!alive2 || !hasBal(p2, type, 'p2')) { p2Idx++; continue; }
                    let isTaxableAtAll = ['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(type);
                    if (ceiling2 !== Infinity && isTaxableAtAll) {
                        if (ceiling2 - runInc2 <= 1) { p2Idx++; continue; }
                    }
                    break;
                }

                const p1Type = p1Idx < currentStrats.length ? currentStrats[p1Idx] : null;
                const p2Type = p2Idx < currentStrats.length ? currentStrats[p2Idx] : null;

                if (!p1Type && !p2Type) break;

                const mR1 = this.calculateTaxDetailed(runInc1, prov, taxBrackets, oasRec1, oasThresholdInf).margRate;
                const mR2 = this.calculateTaxDetailed(runInc2, prov, taxBrackets, oasRec2, oasThresholdInf).margRate;

                let target = null;
                
                if (!p1Type) target = 'p2';
                else if (!p2Type) target = 'p1';
                else if (p1Idx < p2Idx) target = 'p1'; 
                else if (p2Idx < p1Idx) target = 'p2'; 
                else {
                    let isTaxFree = !['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(p1Type);
                    if (isTaxFree) target = 'split'; 
                    else if (Math.abs(runInc1 - runInc2) < TOLERANCE) target = 'split';
                    else if (runInc1 < runInc2) target = 'p1';
                    else target = 'p2';
                }

                let getNetRoom = (type, inc, mR, pObj, ceil) => {
                    if (ceil === Infinity) return Infinity;
                    let isFullyTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(type); 
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
                        if (!['lif', 'lirf'].includes(p1Type)) p1[p1Type] = 0;
                    }
                    if (gotP2.net <= 0.01 && gotP2.tax <= 0.01 && req2 > 0) {
                        if (!['lif', 'lirf'].includes(p2Type)) p2[p2Type] = 0;
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

                    if (p1Type && p2Type && p1Idx === p2Idx && !['tfsa','cash','fhsa','resp'].includes(tType)) {
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
                        if (!['lif', 'lirf'].includes(tType)) pObj[tType] = 0;
                    }
                    
                    df -= got.net;
                    if (target === 'p1') runInc1 += got.tax;
                    else runInc2 += got.tax;
                }
            }
        };

        const optimizeOAS = this.inputs['oas_clawback_optimize'];
        const fullyOptimizeTax = this.inputs['fully_optimize_tax'];
        
        let p1OasCeil = (optimizeOAS && age1 >= 65) ? oasThresholdInf : Infinity;
        let p2OasCeil = (optimizeOAS && age2 >= 65) ? oasThresholdInf : Infinity;
        
        const b = taxBrackets.FED.brackets;

        const runPass = (c1, c2, strategies) => {
            if (df > 1) executeWithdrawalStrategy(c1, c2, strategies);
        };

        if (fullyOptimizeTax) {
            const optimalStrats = ['nreg', 'crypto', 'cash', 'tfsa', 'fhsa', 'resp', 'rrif_acct', 'lif', 'lirf', 'rrsp'];
            runPass(b[0], b[0], optimalStrats);
            if (optimizeOAS && (p1OasCeil < Infinity || p2OasCeil < Infinity)) {
                runPass(Math.max(b[0], p1OasCeil), Math.max(b[0], p2OasCeil), optimalStrats);
            }
            if (b.length > 1) runPass(b[1], b[1], optimalStrats);
            if (b.length > 2) runPass(b[2], b[2], optimalStrats);
            runPass(Infinity, Infinity, optimalStrats);
        } else {
            runPass(b[0], b[0], strats);
            if (optimizeOAS) runPass(p1OasCeil, p2OasCeil, strats);
            runPass(Infinity, Infinity, strats);
        }
    }

    runSimulation(detailed = false, simContext = null) {
        const curY = new Date().getFullYear();
        let nwArray = [];
        let projectionData = [];

        let person1 = { 
            tfsa: this.getVal('p1_tfsa'), tfsa_successor: 0, fhsa: this.getVal('p1_fhsa'), resp: this.getVal('p1_resp'), 
            rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), 
            crypto: this.getVal('p1_crypto'), lirf: this.getVal('p1_lirf'), lif: this.getVal('p1_lif'), 
            rrif_acct: this.getVal('p1_rrif_acct'), inc: this.getVal('p1_income'), 
            dob: new Date(this.getRaw('p1_dob') || "1990-01"), retAge: this.getVal('p1_retireAge'), 
            lifeExp: this.getVal('p1_lifeExp'), nreg_yield: this.getVal('p1_nonreg_yield')/100, 
            acb: this.inputs['p1_nonreg_acb'] !== undefined ? this.getVal('p1_nonreg_acb') : this.getVal('p1_nonreg'), 
            crypto_acb: this.inputs['p1_crypto_acb'] !== undefined ? this.getVal('p1_crypto_acb') : this.getVal('p1_crypto') 
        };
        
        let person2 = { 
            tfsa: this.getVal('p2_tfsa'), tfsa_successor: 0, fhsa: this.getVal('p2_fhsa'), 
            rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), 
            crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), 
            rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), 
            dob: new Date(this.getRaw('p2_dob') || "1990-01"), retAge: this.getVal('p2_retireAge'), 
            lifeExp: this.getVal('p2_lifeExp'), nreg_yield: this.getVal('p2_nonreg_yield')/100, 
            acb: this.inputs['p2_nonreg_acb'] !== undefined ? this.getVal('p2_nonreg_acb') : this.getVal('p2_nonreg'), 
            crypto_acb: this.inputs['p2_crypto_acb'] !== undefined ? this.getVal('p2_crypto_acb') : this.getVal('p2_crypto') 
        };

        let simProperties = JSON.parse(JSON.stringify(this.properties));
        
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
            tfsaLimit: this.inputs['cfg_tfsa_limit'] !== undefined ? this.getVal('cfg_tfsa_limit') : 7000,
            rrspMax: this.inputs['cfg_rrsp_limit'] !== undefined ? this.getVal('cfg_rrsp_limit') : 32960,
            fhsaLimit: this.inputs['cfg_fhsa_limit'] !== undefined ? this.getVal('cfg_fhsa_limit') : 8000,
            respLimit: this.inputs['cfg_resp_limit'] !== undefined ? this.getVal('cfg_resp_limit') : 2500,
            cryptoLimit: this.inputs['cfg_crypto_limit'] !== undefined ? this.getVal('cfg_crypto_limit') : 5000,
            inflation: this.getVal('inflation_rate') / 100
        };

        let initialDeductionGuess = (this.mode === 'Couple' ? 2 : 1) * 15000;
        let previousAFNI = Math.max(0, (person1.inc + (this.mode === 'Couple' ? person2.inc : 0)) - initialDeductionGuess);

        let flowLog = null;
        let pendingRefund = { p1: 0, p2: 0 };
        
        let fhsaYearsP1 = person1.fhsa > 0 ? 1 : 0;
        let fhsaYearsP2 = person2.fhsa > 0 ? 1 : 0;
        let fhsaClosed1 = false;
        let fhsaClosed2 = false;

        for (let i = 0; i <= yearsToRun; i++) {
            const yr = curY + i;
            const age1 = p1StartAge + i;
            const age2 = p2StartAge + i;
            const alive1 = age1 <= person1.lifeExp;
            const alive2 = this.mode === 'Couple' ? age2 <= person2.lifeExp : false;
            
            if (!alive1 && !alive2) break;

            if(detailed) {
                flowLog = { contributions: { p1: {tfsa:0, fhsa:0, resp:0, rrsp:0, nreg:0, cash:0, crypto:0}, p2: {tfsa:0, fhsa:0, rrsp:0, nreg:0, cash:0, crypto:0} }, withdrawals: {} };
            }

            let deathEvents = [];
            
            if (!alive1 && !trackedEvents.has('P1 Dies')) {
                trackedEvents.add('P1 Dies');
                if (detailed) deathEvents.push('P1 Dies');
                if (alive2 && this.mode === 'Couple') {
                    person2.tfsa_successor += (person1.tfsa + (person1.tfsa_successor || 0));
                    person2.rrsp += person1.rrsp;
                    person2.rrif_acct += person1.rrif_acct;
                    person2.lif += person1.lif;
                    person2.lirf += person1.lirf;
                    person2.nreg += person1.nreg;
                    person2.acb += person1.acb;
                    person2.cash += person1.cash;
                    person2.crypto += person1.crypto;
                    person2.crypto_acb += person1.crypto_acb;
                    
                    if (person1.fhsa) person2.fhsa = (person2.fhsa || 0) + person1.fhsa;

                    person1.tfsa = 0; person1.tfsa_successor = 0;
                    person1.rrsp = 0; person1.rrif_acct = 0; person1.lif = 0; person1.lirf = 0;
                    person1.nreg = 0; person1.acb = 0; person1.cash = 0; person1.crypto = 0; person1.crypto_acb = 0;
                    person1.fhsa = 0;
                }
            }
            if (this.mode === 'Couple' && !alive2 && !trackedEvents.has('P2 Dies')) {
                trackedEvents.add('P2 Dies');
                if (detailed) deathEvents.push('P2 Dies');
                if (alive1) {
                    person1.tfsa_successor += (person2.tfsa + (person2.tfsa_successor || 0));
                    person1.rrsp += person2.rrsp;
                    person1.rrif_acct += person2.rrif_acct;
                    person1.lif += person2.lif;
                    person1.lirf += person2.lirf;
                    person1.nreg += person2.nreg;
                    person1.acb += person2.acb;
                    person1.cash += person2.cash;
                    person1.crypto += person2.crypto;
                    person1.crypto_acb += person2.crypto_acb;
                    
                    if (person2.fhsa) person1.fhsa = (person1.fhsa || 0) + person2.fhsa;
                    
                    person2.tfsa = 0; person2.tfsa_successor = 0;
                    person2.rrsp = 0; person2.rrif_acct = 0; person2.lif = 0; person2.lirf = 0;
                    person2.nreg = 0; person2.acb = 0; person2.cash = 0; person2.crypto = 0; person2.crypto_acb = 0;
                    person2.fhsa = 0;
                }
            }

            const bInf = Math.pow(1 + consts.inflation, i);
            const oasThresholdInf = this.CONSTANTS.OAS_CLAWBACK_THRESHOLD * bInf;
            
            const isRet1 = age1 >= person1.retAge;
            const isRet2 = this.mode === 'Couple' ? age2 >= person2.retAge : true;
            
            const preGrowthRrsp1 = person1.rrsp;
            const preGrowthRrif1 = person1.rrif_acct;
            const preGrowthLirf1 = person1.lirf;
            const preGrowthLif1 = person1.lif;
            
            const preGrowthRrsp2 = person2.rrsp;
            const preGrowthRrif2 = person2.rrif_acct;
            const preGrowthLirf2 = person2.lirf;
            const preGrowthLif2 = person2.lif;

            this.applyGrowth(person1, person2, isRet1, isRet2, this.inputs['asset_mode_advanced'], consts.inflation, i, simContext);

            const inflows = this.calcInflows(yr, i, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, consts, bInf, detailed ? trackedEvents : null);
            if (detailed && deathEvents.length > 0) inflows.events.push(...deathEvents);

            let appliedRefundP1 = 0;
            let appliedRefundP2 = 0;
            if (pendingRefund.p1 > 0 && alive1) {
                appliedRefundP1 = pendingRefund.p1;
                inflows.p1.windfallNonTax += appliedRefundP1;
            }
            if (pendingRefund.p2 > 0 && alive2) {
                appliedRefundP2 = pendingRefund.p2;
                inflows.p2.windfallNonTax += appliedRefundP2;
            }
            pendingRefund = { p1: 0, p2: 0 };

            let rrspRoom1 = Math.min(inflows.p1.earned * 0.18, consts.rrspMax * bInf);
            let rrspRoom2 = Math.min(inflows.p2.earned * 0.18, consts.rrspMax * bInf);
            
            let p1_match_rate = this.getVal('p1_rrsp_match') / 100;
            let p2_match_rate = this.getVal('p2_rrsp_match') / 100;
            
            let p1_tier = this.getVal('p1_rrsp_match_tier') / 100;
            if(p1_tier <= 0) p1_tier = 1;
            let p2_tier = this.getVal('p2_rrsp_match_tier') / 100;
            if(p2_tier <= 0) p2_tier = 1;

            let empPortionP1 = (!isRet1 && alive1) ? (person1.inc * p1_match_rate) : 0;
            let empPortionP2 = (!isRet2 && alive2) ? (person2.inc * p2_match_rate) : 0;

            let targetTotalP1 = empPortionP1 + (empPortionP1 / p1_tier);
            let targetTotalP2 = empPortionP2 + (empPortionP2 / p2_tier);

            let totalMatch1 = 0;
            let actEmpPortionP1 = 0;
            if (targetTotalP1 > 0) {
                totalMatch1 = Math.min(targetTotalP1, rrspRoom1);
                actEmpPortionP1 = empPortionP1 * (totalMatch1 / targetTotalP1);
                inflows.p1.gross += actEmpPortionP1; 
                person1.rrsp += totalMatch1; 
                rrspRoom1 -= totalMatch1; 
                if(detailed) { flowLog.contributions.p1.rrsp += totalMatch1; }
            }

            let totalMatch2 = 0;
            let actEmpPortionP2 = 0;
            if (targetTotalP2 > 0 && alive2) {
                totalMatch2 = Math.min(targetTotalP2, rrspRoom2);
                actEmpPortionP2 = empPortionP2 * (totalMatch2 / targetTotalP2);
                inflows.p2.gross += actEmpPortionP2;
                person2.rrsp += totalMatch2;
                rrspRoom2 -= totalMatch2;
                if(detailed) { flowLog.contributions.p2.rrsp += totalMatch2; }
            }

            const regMins = this.calcRegMinimums(person1, person2, age1, age2, alive1, alive2, preGrowthRrsp1, preGrowthRrif1, preGrowthRrsp2, preGrowthRrif2, preGrowthLirf1, preGrowthLif1, preGrowthLirf2, preGrowthLif2);
            
            const taxBrackets = this.getInflatedTaxData(bInf);

            let grossTaxable1 = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + regMins.p1 + regMins.lifTaken1 + inflows.p1.windfallTaxable + (person1.nreg * person1.nreg_yield);
            let grossTaxable2 = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + regMins.p2 + regMins.lifTaken2 + inflows.p2.windfallTaxable + (alive2 ? (person2.nreg * person2.nreg_yield) : 0);

            let taxWithoutMatch1 = alive1 ? this.calculateTaxDetailed(grossTaxable1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};
            let taxWithoutMatch2 = alive2 ? this.calculateTaxDetailed(grossTaxable2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};

            let taxableIncome1 = Math.max(0, grossTaxable1 - totalMatch1);
            let taxableIncome2 = Math.max(0, grossTaxable2 - totalMatch2);

            let taxWithMatchOnly1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};
            let taxWithMatchOnly2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};

            let matchTaxSavings1 = taxWithoutMatch1.totalTax - taxWithMatchOnly1.totalTax;
            let matchTaxSavings2 = taxWithoutMatch2.totalTax - taxWithMatchOnly2.totalTax;

            let ccbPayout = this.calculateCCBForYear(yr, this.dependents, previousAFNI, bInf);
            if (ccbPayout > 0 && alive1) {
                inflows.p1.windfallNonTax += ccbPayout;
                if(detailed) {
                    inflows.p1.ccb = ccbPayout;
                }
            }

            let lifMax1 = (preGrowthLirf1 + preGrowthLif1) * this.getLifMaxFactor(age1 - 1, this.getRaw('tax_province'));
            let lifMax2 = (preGrowthLirf2 + preGrowthLif2) * this.getLifMaxFactor(age2 - 1, this.getRaw('tax_province'));
            lifMax1 = Math.max(0, lifMax1 - regMins.lifTaken1);
            lifMax2 = Math.max(0, lifMax2 - regMins.lifTaken2);

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

            let futureExpenseAmt = 0;
            this.debt.forEach(d => {
                let sY = new Date((d.start || new Date().toISOString().slice(0,7)) + "-01").getFullYear();
                if (sY === yr) {
                    futureExpenseAmt += (Number(d.amount) || 0);
                }
            });
            let debtRepayment = futureExpenseAmt; 
            
            if(detailed && simProperties.reduce((s,p) => s + p.mortgage, 0) <= 0 && !trackedEvents.has('Mortgage Paid') && simProperties.some(p => p.mortgage === 0 && p.value > 0)){ 
                trackedEvents.add('Mortgage Paid'); 
                inflows.events.push('Mortgage Paid'); 
            }

            let pensionSplitTransfer = { p1ToP2: 0, p2ToP1: 0 };
            if (this.mode === 'Couple' && this.inputs['pension_split_enabled']) {
                this.applyPensionSplitting(taxableIncome1, taxableIncome2, inflows, regMins, person1, person2, age1, age2, (n1, n2, tAmt, dir) => { 
                    taxableIncome1 = n1; taxableIncome2 = n2; 
                    if (dir === 'p1_to_p2') pensionSplitTransfer.p1ToP2 = tAmt;
                    if (dir === 'p2_to_p1') pensionSplitTransfer.p2ToP1 = tAmt;
                });
            }
            
            let tax1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};
            let tax2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf) : {totalTax: 0, margRate: 0};

            let netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
            let netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
            
            let totalNetIncome = netIncome1 + netIncome2;
            const totalOutflows = expenses + mortgagePayment + debtRepayment;
            let surplus = totalNetIncome - totalOutflows;

            let wdBreakdown = detailed ? { p1: {}, p2: {} } : null;

            if(detailed) {
                if(regMins.p1 > 0) { 
                    flowLog.withdrawals['P1 RRIF'] = (flowLog.withdrawals['P1 RRIF'] || 0) + regMins.p1; 
                    wdBreakdown.p1.RRIF = regMins.p1; 
                    wdBreakdown.p1.RRIF_math = regMins.details.p1;
                }
                if(regMins.lifTaken1 > 0) { 
                    flowLog.withdrawals['P1 LIF'] = (flowLog.withdrawals['P1 LIF'] || 0) + regMins.lifTaken1; 
                    wdBreakdown.p1.LIF = regMins.lifTaken1; 
                    wdBreakdown.p1.LIF_math = regMins.details.p1;
                }
                if(regMins.p2 > 0) { 
                    flowLog.withdrawals['P2 RRIF'] = (flowLog.withdrawals['P2 RRIF'] || 0) + regMins.p2; 
                    wdBreakdown.p2.RRIF = regMins.p2; 
                    wdBreakdown.p2.RRIF_math = regMins.details.p2;
                }
                if(regMins.lifTaken2 > 0) { 
                    flowLog.withdrawals['P2 LIF'] = (flowLog.withdrawals['P2 LIF'] || 0) + regMins.lifTaken2; 
                    wdBreakdown.p2.LIF = regMins.lifTaken2; 
                    wdBreakdown.p2.LIF_math = regMins.details.p2;
                }
            }

            let actDeductions = { p1: 0, p2: 0 };
            let actFhsaLim1 = fhsaClosed1 ? 0 : consts.fhsaLimit * bInf;
            let actFhsaLim2 = fhsaClosed2 ? 0 : consts.fhsaLimit * bInf;

            if (surplus > 0) {
                this.handleSurplus(surplus, person1, person2, alive1, alive2, flowLog, i, consts.tfsaLimit * bInf, rrspRoom1, rrspRoom2, consts.cryptoLimit * bInf, actFhsaLim1, actFhsaLim2, consts.respLimit * bInf, actDeductions);
                
                if (actDeductions.p1 > 0) {
                    let recalculatedTax1 = this.calculateTaxDetailed(taxableIncome1 - actDeductions.p1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf);
                    pendingRefund.p1 = tax1.totalTax - recalculatedTax1.totalTax;
                }
                if (actDeductions.p2 > 0) {
                    let recalculatedTax2 = this.calculateTaxDetailed(taxableIncome2 - actDeductions.p2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf);
                    pendingRefund.p2 = tax2.totalTax - recalculatedTax2.totalTax;
                }
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
                    }, age1, age2, inflows.p1.oas, inflows.p2.oas, oasThresholdInf, { lifMax1, lifMax2 });
                }
                
                tax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf);
                tax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf);
                netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
                netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
                surplus = (netIncome1 + netIncome2) - totalOutflows;
            }

            previousAFNI = Math.max(0, (taxableIncome1 - actDeductions.p1) + (taxableIncome2 - actDeductions.p2));

            // RESP is excluded from standard Liquid Net Worth
            const assets1 = person1.tfsa + person1.tfsa_successor + person1.rrsp + person1.crypto + person1.nreg + person1.cash + person1.lirf + person1.lif + person1.rrif_acct + (person1.fhsa || 0);
            const assets2 = this.mode === 'Couple' ? (person2.tfsa + person2.tfsa_successor + person2.rrsp + person2.crypto + person2.nreg + person2.cash + person2.lirf + person2.lif + person2.rrif_acct + (person2.fhsa || 0)) : 0;
            
            const liquidNW = (assets1 + assets2);
            
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
                const totalYield = (person1.nreg * person1.nreg_yield) + (alive2 && this.mode === 'Couple' ? (person2.nreg * person2.nreg_yield) : 0);
                const grossInflow = p1GrossTotal + p2GrossTotal + totalYield + totalWithdrawals;
                
                const cashSurplus = grossInflow - (totalOutflows + tax1.totalTax + tax2.totalTax + totalMatch1 + totalMatch2);

                projectionData.push({
                    year: yr, p1Age: age1, p2Age: this.mode === 'Couple' ? age2 : null, p1Alive: alive1, p2Alive: alive2,
                    incomeP1: inflows.p1.gross, incomeP2: inflows.p2.gross,
                    eiMatP1: inflows.p1.eiMat, eiMatP2: inflows.p2.eiMat,
                    topUpP1: inflows.p1.topUp, topUpP2: inflows.p2.topUp,
                    cppP1: inflows.p1.cpp, cppP2: inflows.p2.cpp,
                    oasP1: inflows.p1.oas, oasP2: inflows.p2.oas,
                    ccbP1: inflows.p1.ccb || 0,
                    oasClawbackP1: tax1.oas_clawback || 0, oasClawbackP2: tax2.oas_clawback || 0,
                    taxIncP1: taxableIncome1, taxIncP2: taxableIncome2,
                    oasThreshold: oasThresholdInf,
                    benefitsP1: inflows.p1.cpp + inflows.p1.oas, benefitsP2: inflows.p2.cpp + inflows.p2.oas,
                    dbP1: inflows.p1.pension, dbP2: inflows.p2.pension,
                    taxP1: tax1.totalTax, taxP2: tax2.totalTax,
                    taxDetailsP1: tax1, taxDetailsP2: tax2,
                    p1Net: netIncome1, p2Net: netIncome2,
                    pensionSplit: pensionSplitTransfer,
                    expenses: expenses, mortgagePay: mortgagePayment, debtRepayment,
                    debtRemaining: 0, 
                    surplus: Math.abs(cashSurplus) < 5 ? 0 : cashSurplus,
                    debugNW: finalNetWorth,
                    liquidNW: liquidNW,
                    assetsP1: {...person1}, assetsP2: {...person2},
                    wdBreakdown: wdBreakdown,
                    flows: flowLog,
                    events: inflows.events, // Will attach to this reference
                    householdNet: grossInflow, 
                    grossInflow: grossInflow, 
                    visualExpenses: expenses + mortgagePayment + debtRepayment + tax1.totalTax + tax2.totalTax,
                    mortgage: simProperties.reduce((s,p) => s + p.mortgage, 0), 
                    homeValue: simProperties.reduce((s,p) => s + p.value, 0),
                    windfall: inflows.p1.windfallTaxable + (inflows.p1.windfallNonTax - appliedRefundP1) + inflows.p2.windfallTaxable + (inflows.p2.windfallNonTax - appliedRefundP2),
                    postRetP1: inflows.p1.postRet, postRetP2: inflows.p2.postRet,
                    invIncP1: (person1.nreg * person1.nreg_yield), invIncP2: (person2.nreg * person2.nreg_yield),
                    debugTotalInflow: grossInflow,
                    rrspRoomP1: rrspRoom1, rrspRoomP2: rrspRoom2,
                    rrspMatchP1: actEmpPortionP1, rrspTotalMatch1: totalMatch1,
                    rrspMatchP2: actEmpPortionP2, rrspTotalMatch2: totalMatch2,
                    rrspRefundP1: appliedRefundP1, rrspRefundP2: appliedRefundP2,
                    matchTaxSavingsP1: matchTaxSavings1, matchTaxSavingsP2: matchTaxSavings2,
                    discTaxSavingsP1: pendingRefund.p1, discTaxSavingsP2: pendingRefund.p2
                });
            }

            // End of Year FHSA Expiry Checks
            if (alive1 && !fhsaClosed1) {
                if (person1.fhsa > 0 || (detailed && flowLog && flowLog.contributions.p1.fhsa > 0)) {
                    if (fhsaYearsP1 === 0) fhsaYearsP1 = 1;
                    else fhsaYearsP1++;
                }
                if (fhsaYearsP1 >= 15 || age1 >= 71) {
                    let transferAmt = person1.fhsa;
                    if (transferAmt > 0) {
                        if (age1 >= this.CONSTANTS.RRIF_START_AGE) person1.rrif_acct += transferAmt;
                        else person1.rrsp += transferAmt;
                        if (detailed) {
                            if(!trackedEvents.has('FHSA Expired')) trackedEvents.add('FHSA Expired');
                            projectionData[projectionData.length - 1].events.push('FHSA Expired');
                        }
                    }
                    person1.fhsa = 0;
                    fhsaClosed1 = true;
                }
            }
            if (alive2 && !fhsaClosed2 && this.mode === 'Couple') {
                if (person2.fhsa > 0 || (detailed && flowLog && flowLog.contributions.p2.fhsa > 0)) {
                    if (fhsaYearsP2 === 0) fhsaYearsP2 = 1;
                    else fhsaYearsP2++;
                }
                if (fhsaYearsP2 >= 15 || age2 >= 71) {
                    let transferAmt = person2.fhsa;
                    if (transferAmt > 0) {
                        if (age2 >= this.CONSTANTS.RRIF_START_AGE) person2.rrif_acct += transferAmt;
                        else person2.rrsp += transferAmt;
                        if (detailed) {
                            if(!trackedEvents.has('FHSA Expired')) trackedEvents.add('FHSA Expired');
                            if(!projectionData[projectionData.length - 1].events.includes('FHSA Expired')) {
                                projectionData[projectionData.length - 1].events.push('FHSA Expired');
                            }
                        }
                    }
                    person2.fhsa = 0;
                    fhsaClosed2 = true;
                }
            }

            consts.cppMax1 *= (1 + consts.inflation); consts.oasMax1 *= (1 + consts.inflation);
            consts.cppMax2 *= (1 + consts.inflation); consts.oasMax2 *= (1 + consts.inflation);
        }
        
        return detailed ? projectionData : nwArray;
    }
}
