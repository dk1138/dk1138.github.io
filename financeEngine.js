/**
 * financeEngine.js
 * Shared financial logic core for both the main UI thread and Web Workers.
 * Refactored for readability and maintainability.
 */
import { parseFormattedNumber } from './utils.js';

export class FinanceEngine {
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
        return parseFormattedNumber(raw);
    }

    getRaw(id) {
        return this.inputs[id];
    }

    randn_bm() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); 
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    getRrifFactor(age) {
        if (age < 71) {
            return 1 / (90 - age); 
        }
        if (age >= 95) {
            return 0.20;
        }
        const factors = {
            71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582, 76: 0.0598, 77: 0.0617, 
            78: 0.0636, 79: 0.0658, 80: 0.0682, 81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 
            85: 0.0851, 86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192, 91: 0.1306, 
            92: 0.1449, 93: 0.1634, 94: 0.1879
        };
        return factors[age] || 0.0528;
    }

    getLifMaxFactor(age, province) {
        const group1 = ['BC', 'AB', 'SK', 'ON', 'NB', 'NL'];
        const group2 = ['MB', 'QC', 'NS'];
        
        let type = 'fed'; 
        if (group1.includes(province)) type = 'g1';
        else if (group2.includes(province)) type = 'g2';

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

        if (age >= 89) {
            return type === 'g2' ? 0.2000 : 1.0000;
        }
        if (age < 55) {
            return maxRates[type][55]; 
        }
        return maxRates[type][age] || (type === 'g2' ? 0.2000 : 1.0000);
    }

    calcBenefitAmount(maxAmount, startAge, proportion, retireAge, type) { 
        let benefitValue = maxAmount * proportion;
        let monthsDifference = (startAge - 65) * 12; 
        
        if (type === 'cpp') {
            if (monthsDifference < 0) {
                benefitValue *= (1 - (Math.abs(monthsDifference) * 0.006));
            } else {
                benefitValue *= (1 + (monthsDifference * 0.007)); 
            }
            if (retireAge < 60) {
                benefitValue *= Math.max(0, (39 - Math.max(0, (65 - retireAge) - 8)) / 39); 
            }
        } else if (type === 'oas') {
            if (monthsDifference > 0) {
                benefitValue *= (1 + (monthsDifference * 0.006));
            }
        }
        return benefitValue; 
    }

    calculateCCBForYear(currentYear, dependents, familyNetIncome, baseInflation) {
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

        let maxUnder6 = rules.MAX_UNDER_6 * baseInflation;
        let max6to17 = rules.MAX_6_TO_17 * baseInflation;
        let thresh1 = rules.THRESHOLD_1 * baseInflation;
        let thresh2 = rules.THRESHOLD_2 * baseInflation;

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

    getInflatedTaxData(baseInflation) {
        let taxData = JSON.parse(JSON.stringify(this.CONSTANTS.TAX_DATA));
        Object.values(taxData).forEach(data => { 
            if (data.brackets) {
                data.brackets = data.brackets.map(bracket => bracket * baseInflation); 
            }
            if (data.surtax) { 
                if (data.surtax.t1) data.surtax.t1 *= baseInflation; 
                if (data.surtax.t2) data.surtax.t2 *= baseInflation; 
            } 
        });
        return taxData;
    }

    calculateProgressiveTax(income, brackets, rates) {
        let accumulatedTax = 0;
        let previousBracketLimit = 0;

        for (let j = 0; j < brackets.length; j++) { 
            if (income > brackets[j]) { 
                accumulatedTax += (brackets[j] - previousBracketLimit) * rates[j]; 
                previousBracketLimit = brackets[j]; 
            } else { 
                return { 
                    tax: accumulatedTax + (income - previousBracketLimit) * rates[j], 
                    marginalRate: rates[j] 
                }; 
            } 
        }

        return { 
            tax: accumulatedTax + (income - previousBracketLimit) * rates[rates.length - 1], 
            marginalRate: rates[rates.length - 1] 
        };
    }

    /**
     * Calculates a detailed breakdown of federal and provincial taxes, including CPP/EI premiums,
     * dividend tax credits, and OAS clawbacks based on progressive tax brackets.
     * * @param {number} income - The total gross taxable income.
     * @param {string} province - The province abbreviation (e.g., 'ON').
     * @param {object} taxData - The inflated tax brackets and rates.
     * @param {number} oasReceived - Amount of OAS received in the current year.
     * @param {number} oasThreshold - The inflation-adjusted threshold where OAS clawback begins.
     * @param {number} earnedIncome - Employment or self-employment income (used for CPP/EI).
     * @param {number} baseInflation - The cumulative inflation multiplier for the current year.
     * @param {number} dividendIncome - The portion of income that comes from eligible dividends.
     * @returns {object} Detailed tax breakdown including marginal rate.
     */
    calculateTaxDetailed(income, province, taxData, oasReceived = 0, oasThreshold = 0, earnedIncome = 0, baseInflation = 1, dividendIncome = 0) {
        if (income <= 0) {
            return { fed: 0, prov: 0, cpp_ei: 0, oas_clawback: 0, totalTax: 0, margRate: 0 };
        }
        
        let oasClawback = 0;
        let oasMarginalRate = 0;
        
        if (oasReceived > 0 && oasThreshold > 0 && income > oasThreshold) {
            oasClawback = (income - oasThreshold) * 0.15;
            if (oasClawback < oasReceived) {
                oasMarginalRate = 0.15; 
            } else {
                oasClawback = oasReceived; 
            }
        }

        // Apply Dividend Tax Credit Logic (Assuming Eligible Canadian Dividends for Non-Reg yield)
        let actualDividendIncome = Math.min(income, dividendIncome); 
        let grossedUpDividend = actualDividendIncome * 1.38;
        let ordinaryIncome = Math.max(0, income - actualDividendIncome);
        let taxIncomeForFedProv = Math.max(0, ordinaryIncome + grossedUpDividend - oasClawback);
        
        const fedCalc = this.calculateProgressiveTax(taxIncomeForFedProv, taxData.FED.brackets, taxData.FED.rates);
        const provCalc = this.calculateProgressiveTax(
            taxIncomeForFedProv, 
            taxData[province]?.brackets || [999999999], 
            taxData[province]?.rates || [0.10]
        );
        
        let fedTax = fedCalc.tax;
        let provTax = provCalc.tax;
        let fedMarginalRate = fedCalc.marginalRate;
        let provMarginalRate = provCalc.marginalRate;
        
        let fedDividendCredit = grossedUpDividend * 0.150198;
        let provDivCreditRates = { 'ON': 0.1005, 'AB': 0.0812, 'BC': 0.12, 'MB': 0.08, 'NB': 0.14, 'NL': 0.054, 'NS': 0.0885, 'PE': 0.105, 'QC': 0.119, 'SK': 0.11 };
        let provDividendCredit = grossedUpDividend * (provDivCreditRates[province] || 0.10);

        if (province === 'ON') { 
            provTax = Math.max(0, provTax - provDividendCredit);
            let surtax = 0; 
            
            if (taxData.ON.surtax) { 
                if (provTax > taxData.ON.surtax.t1) {
                    surtax += (provTax - taxData.ON.surtax.t1) * taxData.ON.surtax.r1; 
                }
                if (provTax > taxData.ON.surtax.t2) {
                    surtax += (provTax - taxData.ON.surtax.t2) * taxData.ON.surtax.r2; 
                }
            } 
            
            if (surtax > 0) {
                provMarginalRate *= 1.56; 
            }
            
            provTax += surtax;
            
            // Ontario Health Premium calculation
            if (taxIncomeForFedProv > 20000) {
                provTax += Math.min(900, (taxIncomeForFedProv - 20000) * 0.06);
            }
        } else {
            provTax = Math.max(0, provTax - provDividendCredit);
            if (province === 'PE' && taxData.PE.surtax && provTax > taxData.PE.surtax.t1) {
                provTax += (provTax - taxData.PE.surtax.t1) * taxData.PE.surtax.r1;
            }
        }

        fedTax = Math.max(0, fedTax - fedDividendCredit);
        
        if (province === 'QC' && taxData.QC.abatement) {
            fedTax = Math.max(0, fedTax - (fedTax * taxData.QC.abatement));
        }
        
        // Calculate CPP and EI purely on EARNED employment/side-hustle income, scaled by inflation
        let cppPremium = 0; 
        let yearlyMaxPensionableEarnings = 74600 * baseInflation;
        let yearlyAdditionalMaxPensionableEarnings = 85000 * baseInflation;
        let eiMaxInsurableEarnings = 68900 * baseInflation;
        let cppExemption = 3500 * baseInflation;

        if (earnedIncome > cppExemption) {
            cppPremium += (Math.min(earnedIncome, yearlyMaxPensionableEarnings) - cppExemption) * 0.0595; 
        }
        if (earnedIncome > yearlyMaxPensionableEarnings) {
            cppPremium += (Math.min(earnedIncome, yearlyAdditionalMaxPensionableEarnings) - yearlyMaxPensionableEarnings) * 0.04;
        }
        
        const eiPremium = Math.min(earnedIncome, eiMaxInsurableEarnings) * 0.0164;

        let actualMargRate = fedMarginalRate + provMarginalRate;
        if (oasMarginalRate > 0) {
            actualMargRate = 0.15 + 0.85 * (fedMarginalRate + provMarginalRate);
        }
        
        return { 
            fed: fedTax, 
            prov: provTax, 
            cpp_ei: cppPremium + eiPremium, 
            oas_clawback: oasClawback, 
            totalTax: fedTax + provTax + cppPremium + eiPremium + oasClawback, 
            margRate: actualMargRate 
        };
    }

    applyGrowth(person1, person2, isRet1, isRet2, isAdvancedMode, inflationRate, yearIndex, simContext) {
        const isStressTest = this.inputs['stressTestEnabled'] && yearIndex === 0; 
        
        const getRates = (personPrefix, isRetired) => {
            const getRate = id => this.getVal(`${personPrefix}_${id}_ret` + (isAdvancedMode && isRetired ? '_retire' : '')) / 100;
            return { 
                tfsa: getRate('tfsa'), 
                rrsp: getRate('rrsp'), 
                cash: getRate('cash'), 
                nreg: getRate('nonreg'), 
                crypto: getRate('crypto'), 
                lirf: getRate('lirf'), 
                lif: getRate('lif'), 
                rrif_acct: getRate('rrif_acct'), 
                fhsa: getRate('fhsa'), 
                resp: getRate('resp') || 0,
                inc: this.getVal(`${personPrefix}_income_growth`) / 100 
            };
        };
        
        const ratesP1 = getRates('p1', isRet1);
        const ratesP2 = getRates('p2', isRet2);
        
        if (isStressTest) { 
            const accountsToStress = ['tfsa','rrsp','nreg','cash','lirf','lif','rrif_acct','crypto', 'fhsa', 'resp'];
            accountsToStress.forEach(account => { 
                if (ratesP1[account] !== undefined) ratesP1[account] = -0.15; 
                if (ratesP2[account] !== undefined) ratesP2[account] = -0.15; 
            }); 
            ratesP1.crypto = -0.40; 
            ratesP2.crypto = -0.40; 
        }

        if (simContext) {
            let shock = 0;
            if (simContext.method === 'historical' && simContext.histSequence) {
                shock = simContext.histSequence[yearIndex] - 0.10;
            } else if (simContext.volatility) {
                shock = this.randn_bm() * simContext.volatility;
            }
            if (shock !== 0) {
                const accountsToShock = ['tfsa','rrsp','nreg','crypto','lirf','lif','rrif_acct', 'fhsa', 'resp'];
                accountsToShock.forEach(account => { 
                    if (ratesP1[account] !== undefined) ratesP1[account] += shock; 
                    if (ratesP2[account] !== undefined) ratesP2[account] += shock; 
                });
            }
        }

        const applyGrowthToPerson = (person, rates, isRetired) => {
            person.tfsa *= (1 + rates.tfsa);
            if (person.tfsa_successor !== undefined) person.tfsa_successor *= (1 + rates.tfsa); 
            person.rrsp *= (1 + rates.rrsp); 
            person.cash *= (1 + rates.cash); 
            person.crypto *= (1 + rates.crypto);
            person.lirf *= (1 + rates.lirf); 
            person.lif *= (1 + rates.lif); 
            person.rrif_acct *= (1 + rates.rrif_acct);
            person.nreg *= (1 + (rates.nreg - person.nreg_yield));
            
            if (person.fhsa !== undefined) person.fhsa *= (1 + rates.fhsa);
            if (person.resp !== undefined) person.resp *= (1 + rates.resp);
            
            if (!isRetired && yearIndex > 0) {
                person.inc *= (1 + rates.inc); 
            }
        };
        
        applyGrowthToPerson(person1, ratesP1, isRet1); 
        applyGrowthToPerson(person2, ratesP2, isRet2);
    }

    calcInflows(currentYear, yearIndex, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, constants, baseInflation, trackedEvents = null) {
        let result = { 
            p1: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0, ccb:0, eiMat:0, topUp:0 }, 
            p2: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0, ccb:0, eiMat:0, topUp:0 },
            events: []
        };
        
        const calculateInflowsForPerson = (person, age, isRetired, prefix, maxCpp, maxOas) => {
            let inflows = { gross:0, earned:0, cpp:0, oas:0, pension:0, postRet:0, eiMat:0, topUp:0 };
            
            if (!isRetired) { 
                let baseIncome = person.inc;
                let workFraction = 1.0;
                let eiTotal = 0;
                let topUpTotal = 0;

                this.leaves.forEach(leave => {
                    if (leave.owner === prefix) {
                        let [leaveYear, leaveMonth] = (leave.start || "2026-01").split('-');
                        let leaveStartDate = new Date(parseInt(leaveYear), parseInt(leaveMonth) - 1, 1);
                        let leaveEndDate = new Date(leaveStartDate.getTime() + (leave.durationWeeks || 0) * 7 * 24 * 60 * 60 * 1000);
                        let topUpEndDate = new Date(leaveStartDate.getTime() + (leave.topUpWeeks || 0) * 7 * 24 * 60 * 60 * 1000);
                        
                        let yearStartDate = new Date(currentYear, 0, 1);
                        let yearEndDate = new Date(currentYear, 11, 31, 23, 59, 59);

                        let overlapStart = new Date(Math.max(leaveStartDate.getTime(), yearStartDate.getTime()));
                        let overlapEnd = new Date(Math.min(leaveEndDate.getTime(), yearEndDate.getTime()));
                        let leaveWeeksInYear = overlapStart < overlapEnd ? (overlapEnd - overlapStart) / (7 * 24 * 60 * 60 * 1000) : 0;

                        let topUpOverlapStart = new Date(Math.max(leaveStartDate.getTime(), yearStartDate.getTime()));
                        let topUpOverlapEnd = new Date(Math.min(topUpEndDate.getTime(), yearEndDate.getTime()));
                        let topUpWeeksInYear = topUpOverlapStart < topUpOverlapEnd ? (topUpOverlapEnd - topUpOverlapStart) / (7 * 24 * 60 * 60 * 1000) : 0;

                        if (leaveWeeksInYear > 0) {
                            let weeklySalary = baseIncome / 52;
                            let maxEi = (this.CONSTANTS.MAX_EI_WEEKLY_BENEFIT || 720) * baseInflation;
                            let replacementRate = this.CONSTANTS.EI_REPLACEMENT_RATE || 0.55;
                            let weeklyEI = Math.min(maxEi, weeklySalary * replacementRate);
                            
                            let weeklyTopUpTarget = weeklySalary * ((leave.topUpPercent || 0) / 100);
                            let weeklyTopUpAmt = Math.max(0, weeklyTopUpTarget - weeklyEI);

                            workFraction -= (leaveWeeksInYear / 52);
                            eiTotal += (leaveWeeksInYear * weeklyEI);
                            topUpTotal += (topUpWeeksInYear * weeklyTopUpAmt);
                            
                            if (trackedEvents && !trackedEvents.has(`${prefix.toUpperCase()} Leave`)) {
                                trackedEvents.add(`${prefix.toUpperCase()} Leave`);
                                result.events.push(`${prefix.toUpperCase()} Leave`);
                            }
                        }
                    }
                });

                workFraction = Math.max(0, workFraction);
                let proratedIncome = baseIncome * workFraction;
                
                inflows.gross += proratedIncome + eiTotal + topUpTotal;
                inflows.earned += proratedIncome + topUpTotal; 
                inflows.eiMat += eiTotal;
                inflows.topUp += topUpTotal;
            }
            
            if (this.inputs[`${prefix}_db_enabled`]) {
                const lifetimeStart = parseInt(this.getRaw(`${prefix}_db_lifetime_start`) || 60);
                const bridgeStart = parseInt(this.getRaw(`${prefix}_db_bridge_start`) || 60);
                const isIndexed = this.inputs[`${prefix}_db_indexed`] !== undefined ? this.inputs[`${prefix}_db_indexed`] : true;
                const dbMultiplier = isIndexed ? baseInflation : 1.0;
                
                if (age >= lifetimeStart) {
                    inflows.pension += this.getVal(`${prefix}_db_lifetime`) * 12 * dbMultiplier;
                }
                if (age >= bridgeStart && age < 65) {
                    inflows.pension += this.getVal(`${prefix}_db_bridge`) * 12 * dbMultiplier;
                }
            }

            if (this.inputs[`${prefix}_cpp_enabled`] && age >= parseInt(this.getRaw(`${prefix}_cpp_start`))) {
                inflows.cpp = this.calcBenefitAmount(maxCpp, parseInt(this.getRaw(`${prefix}_cpp_start`)), 1, person.retAge, 'cpp');
                if (trackedEvents && age === parseInt(this.getRaw(`${prefix}_cpp_start`))) { 
                    trackedEvents.add(`${prefix.toUpperCase()} CPP`); 
                }
            }
            
            if (this.inputs[`${prefix}_oas_enabled`] && age >= parseInt(this.getRaw(`${prefix}_oas_start`))) {
                let baseOas = this.calcBenefitAmount(maxOas, parseInt(this.getRaw(`${prefix}_oas_start`)), 1, 65, 'oas');
                if (age >= 75) {
                    baseOas *= 1.10; 
                }
                inflows.oas = baseOas;
                if (trackedEvents && age === parseInt(this.getRaw(`${prefix}_oas_start`))) { 
                    trackedEvents.add(`${prefix.toUpperCase()} OAS`); 
                }
            }
            return inflows;
        };

        if (alive1) { 
            let p1Result = calculateInflowsForPerson(person1, age1, isRet1, 'p1', constants.cppMax1, constants.oasMax1); 
            result.p1 = {...result.p1, ...p1Result}; 
        }
        if (alive2) { 
            let p2Result = calculateInflowsForPerson(person2, age2, isRet2, 'p2', constants.cppMax2, constants.oasMax2); 
            result.p2 = {...result.p2, ...p2Result}; 
        }

        if (trackedEvents) {
            if (alive1 && isRet1 && !trackedEvents.has('P1 Retires')) { 
                trackedEvents.add('P1 Retires'); 
                result.events.push('P1 Retires'); 
            }
            if (alive2 && isRet2 && !trackedEvents.has('P2 Retires')) { 
                trackedEvents.add('P2 Retires'); 
                result.events.push('P2 Retires'); 
            }
        }

        this.windfalls.forEach(windfall => {
            let isActive = false;
            let amount = 0;
            let startYear = new Date((windfall.start || "2026-01") + "-01").getFullYear();
            
            if (windfall.freq === 'one') { 
                if (startYear === currentYear) { 
                    isActive = true; 
                    amount = windfall.amount; 
                } 
            } else { 
                let endYear = (windfall.end ? new Date(windfall.end + "-01") : new Date("2100-01-01")).getFullYear(); 
                if (currentYear >= startYear && currentYear <= endYear) { 
                    isActive = true; 
                    let monthsActive = 1;
                    if (windfall.freq === 'month') {
                        if (currentYear === startYear) {
                            monthsActive = 12 - new Date((windfall.start || "2026-01") + "-01").getMonth();
                        } else if (currentYear === endYear) {
                            monthsActive = new Date(windfall.end + "-01").getMonth() + 1;
                        } else {
                            monthsActive = 12;
                        }
                    }
                    amount = windfall.amount * monthsActive; 
                } 
            }
            
            if (isActive && amount > 0) { 
                if (trackedEvents && windfall.freq === 'one') result.events.push('Windfall');
                let targetPerson = (windfall.owner === 'p2' && alive2) ? result.p2 : result.p1;
                
                if (windfall.taxable) {
                    targetPerson.windfallTaxable += amount; 
                } else {
                    targetPerson.windfallNonTax += amount;
                }
            }
        });

        this.additionalIncome.forEach(stream => {
            let startYear, endYear;
            if (stream.startMode === 'ret_relative') {
                const ownerPerson = stream.owner === 'p2' ? person2 : person1;
                const retirementYear = ownerPerson.dob.getFullYear() + ownerPerson.retAge;
                startYear = retirementYear + (stream.startRel || 0);
            } else {
                startYear = new Date((stream.start || "2026-01") + "-01").getFullYear();
            }

            if (stream.endMode === 'duration') {
                endYear = startYear + (stream.duration || 0);
            } else {
                endYear = (stream.end ? new Date(stream.end + "-01") : new Date("2100-01-01")).getFullYear();
            }

            if (currentYear >= startYear && currentYear <= endYear) {
                let baseYear = stream.startMode === 'ret_relative' ? startYear : new Date((stream.start || "2026-01") + "-01").getFullYear();
                let amount = stream.amount * Math.pow(1 + (stream.growth / 100), currentYear - baseYear) * (stream.freq === 'month' ? 12 : 1);
                
                if (stream.startMode === 'date' && currentYear === startYear) {
                    amount *= (12 - new Date((stream.start || "2026-01") + "-01").getMonth()) / 12;
                }
                if (stream.endMode === 'date' && stream.end && currentYear === endYear) {
                    amount *= Math.min(1, (new Date(stream.end + "-01").getMonth() + 1) / 12);
                }

                if (amount > 0) { 
                    let targetPerson = (stream.owner === 'p2' && alive2) ? result.p2 : result.p1;
                    if (targetPerson) {
                        if (stream.taxable) { 
                            targetPerson.gross += amount; 
                            targetPerson.earned += amount;
                            const isPersonRetired = (stream.owner === 'p2' ? isRet2 : isRet1);
                            if (isPersonRetired) {
                                targetPerson.postRet += amount;
                            }
                        } else {
                            targetPerson.windfallNonTax += amount;
                        }
                    }
                }
            }
        });

        return result;
    }

    calcRegMinimums(person1, person2, age1, age2, alive1, alive2, preRrsp1, preRrif1, preRrsp2, preRrif2, preLirf1, preLif1, preLirf2, preLif2) {
        let result = { p1: 0, p2: 0, lifTaken1: 0, lifTaken2: 0, details: { p1: null, p2: null } };
        
        const calculateMinimumForPerson = (person, age, preRrsp, preRrif, preLirf, preLif) => {
            let factor = this.getRrifFactor(age - 1);
            let baseRrifBalance = age >= this.CONSTANTS.RRIF_START_AGE ? (preRrsp + preRrif) : preRrif;
            let baseLifBalance = age >= this.CONSTANTS.RRIF_START_AGE ? (preLirf + preLif) : preLif;
            
            let requiredRrifMin = baseRrifBalance * factor;
            let requiredLifMin = age >= 55 ? (baseLifBalance * factor) : 0;
            
            let actualRrifTaken = 0;
            let actualLifTaken = 0;
            
            if (baseRrifBalance > 0) {
                let minNeeded = requiredRrifMin;
                let takeFromRrif = Math.min(person.rrif_acct, minNeeded);
                person.rrif_acct -= takeFromRrif;
                actualRrifTaken += takeFromRrif;
                minNeeded -= takeFromRrif;
                
                if (minNeeded > 0 && age >= this.CONSTANTS.RRIF_START_AGE) {
                    let takeFromRrsp = Math.min(person.rrsp, minNeeded);
                    person.rrsp -= takeFromRrsp;
                    actualRrifTaken += takeFromRrsp;
                }
            }

            if (baseLifBalance > 0) {
                let minNeeded = requiredLifMin;
                let takeFromLif = Math.min(person.lif, minNeeded);
                person.lif -= takeFromLif;
                actualLifTaken += takeFromLif;
                minNeeded -= takeFromLif;

                if (minNeeded > 0 && age >= this.CONSTANTS.RRIF_START_AGE) {
                    let takeFromLirf = Math.min(person.lirf, minNeeded);
                    person.lirf -= takeFromLirf;
                    actualLifTaken += takeFromLirf;
                }
            }
            
            return { 
                rrifTaken: actualRrifTaken, 
                lifTaken: actualLifTaken, 
                details: { 
                    factor, 
                    bal: baseRrifBalance, 
                    min: requiredRrifMin, 
                    lifBal: baseLifBalance, 
                    lifMin: requiredLifMin 
                } 
            };
        };
        
        if (alive1) { 
            let p1Min = calculateMinimumForPerson(person1, age1, preRrsp1, preRrif1, preLirf1, preLif1); 
            result.p1 = p1Min.rrifTaken; 
            result.lifTaken1 = p1Min.lifTaken;
            result.details.p1 = p1Min.details; 
        }
        if (alive2) { 
            let p2Min = calculateMinimumForPerson(person2, age2, preRrsp2, preRrif2, preLirf2, preLif2); 
            result.p2 = p2Min.rrifTaken; 
            result.lifTaken2 = p2Min.lifTaken;
            result.details.p2 = p2Min.details; 
        }
        
        return result;
    }

    calcOutflows(currentYear, yearIndex, age, baseInflation, isRet1, isRet2, simContext) {
        let expenseTotals = { curr: 0, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0 };
        
        Object.values(this.expensesByCategory).forEach(category => {
            category.items.forEach(item => { 
                const freq = item.freq; 
                expenseTotals.curr += (item.curr || 0) * freq; 
                expenseTotals.ret += (item.ret || 0) * freq; 
                expenseTotals.trans += (item.trans || 0) * freq; 
                expenseTotals.gogo += (item.gogo || 0) * freq; 
                expenseTotals.slow += (item.slow || 0) * freq; 
                expenseTotals.nogo += (item.nogo || 0) * freq; 
            });
        });
        
        let finalExpenses = 0;
        const isFullyRetired = isRet1 && (this.mode === 'Single' || isRet2);
        const gogoLimit = parseInt(this.getRaw('exp_gogo_age')) || 75;
        const slowLimit = parseInt(this.getRaw('exp_slow_age')) || 85;
        const contextMultiplier = simContext?.expenseMultiplier || 1.0;

        if (this.expenseMode === 'Simple') {
            finalExpenses = isFullyRetired ? (expenseTotals.ret * contextMultiplier) : expenseTotals.curr;
        } else {
            if (!isFullyRetired) {
                finalExpenses = expenseTotals.curr;
            } else if (age < gogoLimit) {
                finalExpenses = expenseTotals.gogo * contextMultiplier;
            } else if (age < slowLimit) {
                finalExpenses = expenseTotals.slow * contextMultiplier;
            } else {
                finalExpenses = expenseTotals.nogo * contextMultiplier;
            }
        }
        
        return finalExpenses * baseInflation;
    }

    applyPensionSplitting(taxableIncome1, taxableIncome2, inflows, regMinimums, person1, person2, age1, age2, setTaxesCallback) {
        let eligiblePensionP1 = inflows.p1.pension;
        let eligiblePensionP2 = inflows.p2.pension;
        
        if (age1 >= 65) { 
            eligiblePensionP1 += regMinimums.p1 + regMinimums.lifTaken1; 
        }
        if (age2 >= 65) { 
            eligiblePensionP2 += regMinimums.p2 + regMinimums.lifTaken2; 
        }

        if (taxableIncome1 > taxableIncome2 && eligiblePensionP1 > 0) {
            let maxTransfer = eligiblePensionP1 * 0.5;
            let incomeDifference = taxableIncome1 - taxableIncome2;
            let transferAmount = Math.min(maxTransfer, incomeDifference / 2);
            
            if (transferAmount > 0) {
                setTaxesCallback(taxableIncome1 - transferAmount, taxableIncome2 + transferAmount, transferAmount, 'p1_to_p2');
            }
        } else if (taxableIncome2 > taxableIncome1 && eligiblePensionP2 > 0) {
            let maxTransfer = eligiblePensionP2 * 0.5;
            let incomeDifference = taxableIncome2 - taxableIncome1;
            let transferAmount = Math.min(maxTransfer, incomeDifference / 2);
            
            if (transferAmount > 0) {
                setTaxesCallback(taxableIncome1 + transferAmount, taxableIncome2 - transferAmount, transferAmount, 'p2_to_p1');
            }
        }
    }

    /**
     * Allocates surplus cash flow into saving/investment accounts based on the accumulation strategy.
     * * @param {number} surplusAmount - The surplus cash flow to distribute.
     * @param {object} person1 - Player 1 financial state.
     * @param {object} person2 - Player 2 financial state.
     * @param {boolean} alive1 - Whether Player 1 is alive.
     * @param {boolean} alive2 - Whether Player 2 is alive.
     * @param {object} flowLog - The logging object to track contributions.
     * @param {number} yearIndex - The current simulation year index.
     * @param {number} tfsaLimit - Calculated TFSA limit for the year.
     * @param {number} rrspLimit1 - Remaining RRSP room for Player 1.
     * @param {number} rrspLimit2 - Remaining RRSP room for Player 2.
     * @param {number} cryptoLimit - Configured Crypto allocation cap.
     * @param {number} fhsaLimit1 - Remaining FHSA limit for Player 1.
     * @param {number} fhsaLimit2 - Remaining FHSA limit for Player 2.
     * @param {number} respLimit - Target RESP contribution amount.
     * @param {object} deductionsObj - Out-parameter to log tax deductions generated by these contributions.
     * @param {object} fhsaLifetimeRooms - Tracker for the lifetime 40k FHSA limits.
     */
    handleSurplus(surplusAmount, person1, person2, alive1, alive2, flowLog, yearIndex, tfsaLimit, rrspLimit1, rrspLimit2, cryptoLimit, fhsaLimit1, fhsaLimit2, respLimit, deductionsObj, fhsaLifetimeRooms) {
        let remainingSurplus = surplusAmount;
        
        this.strategies.accum.forEach(accountType => { 
            if (remainingSurplus <= 0) return;
            
            if (accountType === 'tfsa' && tfsaLimit > 0) { 
                if (alive1 && (!this.inputs['skip_first_tfsa_p1'] || yearIndex > 0)) {
                    let takeAmount = Math.min(remainingSurplus, tfsaLimit); 
                    person1.tfsa += takeAmount; 
                    if (flowLog) flowLog.contributions.p1.tfsa += takeAmount; 
                    remainingSurplus -= takeAmount;
                } 
                if (alive2 && remainingSurplus > 0 && (!this.inputs['skip_first_tfsa_p2'] || yearIndex > 0)) {
                    let takeAmount = Math.min(remainingSurplus, tfsaLimit); 
                    person2.tfsa += takeAmount; 
                    if (flowLog) flowLog.contributions.p2.tfsa += takeAmount; 
                    remainingSurplus -= takeAmount;
                } 
            }
            else if (accountType === 'rrsp') { 
                let priorityList = [];
                const p1HasRoom = (!this.inputs['skip_first_rrsp_p1'] || yearIndex > 0) && alive1 && rrspLimit1 > 0;
                const p2HasRoom = (!this.inputs['skip_first_rrsp_p2'] || yearIndex > 0) && alive2 && rrspLimit2 > 0;
                
                if (p1HasRoom && p2HasRoom) {
                    if (person1.rrsp < person2.rrsp) {
                        priorityList = [{ person: person1, room: rrspLimit1, key: 'p1' }, { person: person2, room: rrspLimit2, key: 'p2' }];
                    } else {
                        priorityList = [{ person: person2, room: rrspLimit2, key: 'p2' }, { person: person1, room: rrspLimit1, key: 'p1' }];
                    }
                } else if (p1HasRoom) {
                    priorityList = [{ person: person1, room: rrspLimit1, key: 'p1' }];
                } else if (p2HasRoom) {
                    priorityList = [{ person: person2, room: rrspLimit2, key: 'p2' }];
                }

                priorityList.forEach(obj => {
                    if (remainingSurplus > 0) {
                        let takeAmount = Math.min(remainingSurplus, obj.room);
                        obj.person.rrsp += takeAmount; 
                        
                        if (flowLog) flowLog.contributions[obj.key].rrsp += takeAmount; 
                        if (deductionsObj) deductionsObj[obj.key] += takeAmount;
                        
                        remainingSurplus -= takeAmount;
                    }
                });
            }
            else if (accountType === 'fhsa') {
                if (alive1 && remainingSurplus > 0 && person1.fhsa !== undefined && fhsaLimit1 > 0 && fhsaLifetimeRooms && fhsaLifetimeRooms.p1 > 0) {
                    let takeAmount = Math.min(remainingSurplus, fhsaLimit1, fhsaLifetimeRooms.p1);
                    person1.fhsa += takeAmount;
                    
                    if (flowLog) flowLog.contributions.p1.fhsa += takeAmount;
                    if (deductionsObj) deductionsObj.p1 += takeAmount;
                    
                    remainingSurplus -= takeAmount;
                    fhsaLifetimeRooms.p1 -= takeAmount;
                }
                if (alive2 && remainingSurplus > 0 && person2.fhsa !== undefined && fhsaLimit2 > 0 && fhsaLifetimeRooms && fhsaLifetimeRooms.p2 > 0) {
                    let takeAmount = Math.min(remainingSurplus, fhsaLimit2, fhsaLifetimeRooms.p2);
                    person2.fhsa += takeAmount;
                    
                    if (flowLog) flowLog.contributions.p2.fhsa += takeAmount;
                    if (deductionsObj) deductionsObj.p2 += takeAmount;
                    
                    remainingSurplus -= takeAmount;
                    fhsaLifetimeRooms.p2 -= takeAmount;
                }
            }
            else if (accountType === 'resp' && respLimit > 0) {
                if (alive1 && remainingSurplus > 0 && person1.resp !== undefined) {
                    let takeAmount = Math.min(remainingSurplus, respLimit); 
                    person1.resp += takeAmount;
                    
                    if (flowLog) flowLog.contributions.p1.resp += takeAmount;
                    
                    let cesgMatch = takeAmount * (this.CONSTANTS.RESP_CESG_MATCH_RATE || 0.20);
                    person1.resp += cesgMatch;
                    
                    remainingSurplus -= takeAmount;
                }
            }
            else if (accountType === 'crypto' && cryptoLimit > 0) {
                if (alive1 && remainingSurplus > 0) {
                    let takeAmount = Math.min(remainingSurplus, cryptoLimit);
                    person1.crypto += takeAmount; 
                    person1.crypto_acb += takeAmount;
                    
                    if (flowLog) flowLog.contributions.p1.crypto += takeAmount;
                    remainingSurplus -= takeAmount;
                }
                if (alive2 && remainingSurplus > 0) {
                    let takeAmount = Math.min(remainingSurplus, cryptoLimit);
                    person2.crypto += takeAmount; 
                    person2.crypto_acb += takeAmount;
                    
                    if (flowLog) flowLog.contributions.p2.crypto += takeAmount;
                    remainingSurplus -= takeAmount;
                }
            }
            else if (accountType === 'nreg') {
                if (alive1 && alive2) {
                    let halfAmount = remainingSurplus / 2;
                    person1.nreg += halfAmount; 
                    person1.acb += halfAmount; 
                    if (flowLog) flowLog.contributions.p1.nreg += halfAmount;
                    
                    person2.nreg += halfAmount; 
                    person2.acb += halfAmount; 
                    if (flowLog) flowLog.contributions.p2.nreg += halfAmount;
                    
                    remainingSurplus = 0;
                } else if (alive1) { 
                    person1.nreg += remainingSurplus; 
                    person1.acb += remainingSurplus; 
                    if (flowLog) flowLog.contributions.p1.nreg += remainingSurplus; 
                    remainingSurplus = 0; 
                } else if (alive2) { 
                    person2.nreg += remainingSurplus; 
                    person2.acb += remainingSurplus; 
                    if (flowLog) flowLog.contributions.p2.nreg += remainingSurplus; 
                    remainingSurplus = 0; 
                }
            } 
            else if (accountType === 'cash') {
                if (alive1 && alive2) {
                    let halfAmount = remainingSurplus / 2;
                    person1.cash += halfAmount; 
                    if (flowLog) flowLog.contributions.p1.cash += halfAmount;
                    
                    person2.cash += halfAmount; 
                    if (flowLog) flowLog.contributions.p2.cash += halfAmount;
                    
                    remainingSurplus = 0;
                } else if (alive1) { 
                    person1.cash += remainingSurplus; 
                    if (flowLog) flowLog.contributions.p1.cash += remainingSurplus; 
                    remainingSurplus = 0; 
                } else if (alive2) { 
                    person2.cash += remainingSurplus; 
                    if (flowLog) flowLog.contributions.p2.cash += remainingSurplus; 
                    remainingSurplus = 0; 
                }
            } 
        });
    }

    /**
     * Determines which assets to sell to cover a cashflow deficit, based on the defined withdrawal strategy 
     * and dynamic tax optimization (meltdowns). Accounts for capital gains ratios and full taxation impacts.
     * * @param {number} deficitAmount - The total cash needed to cover expenses.
     * @param {object} person1 - Player 1 financial state.
     * @param {object} person2 - Player 2 financial state.
     * @param {number} currentIncome1 - P1's taxable income prior to withdrawals.
     * @param {number} currentIncome2 - P2's taxable income prior to withdrawals.
     * @param {boolean} alive1 - Is P1 alive.
     * @param {boolean} alive2 - Is P2 alive.
     * @param {object} flowLog - Data logger for UI.
     * @param {object} withdrawalBreakdown - Detailed logging object.
     * @param {object} taxBrackets - Formatted tax bracket data.
     * @param {function} onWithdrawalCallback - Executed when a withdrawal generates tax.
     * @param {number} age1 - Age of P1.
     * @param {number} age2 - Age of P2.
     * @param {number} oasReceived1 - OAS received by P1.
     * @param {number} oasReceived2 - OAS received by P2.
     * @param {number} oasThresholdInflation - Adjusted OAS clawback threshold.
     * @param {object} lifLimits - Maximum withdrawal limits for locked-in funds.
     */
    handleDeficit(deficitAmount, person1, person2, currentIncome1, currentIncome2, alive1, alive2, flowLog, withdrawalBreakdown, taxBrackets, onWithdrawalCallback, age1, age2, oasReceived1 = 0, oasReceived2 = 0, oasThresholdInflation = 0, lifLimits = {lifMax1: Infinity, lifMax2: Infinity}, earnedIncome1 = 0, earnedIncome2 = 0, baseInflation = 1, dividendIncome1 = 0, dividendIncome2 = 0) {
        let remainingDeficit = deficitAmount;
        let runningIncome1 = currentIncome1;
        let runningIncome2 = currentIncome2;
        
        const province = this.getRaw('tax_province');
        const MARGINAL_TOLERANCE = 50; 
        const withdrawalStrategies = this.strategies.decum;

        let hasBalance = (person, accountType, prefix) => {
            if (accountType === 'tfsa') {
                return (person.tfsa + (person.tfsa_successor || 0)) > 0;
            }
            if (person[accountType] === undefined) return false;
            if (person[accountType] <= 0) return false;
            
            if (accountType === 'lif' || accountType === 'lirf') {
                let maxLimit = prefix === 'p1' ? lifLimits.lifMax1 : lifLimits.lifMax2;
                if (maxLimit <= 0.01) return false;
            }
            return true;
        };

        const withdrawFromAccount = (person, accountType, requiredNetCash, prefix, marginalRate) => { 
            if (requiredNetCash <= 0) return { net: 0, tax: 0 };
            
            let accountsToPullFrom;
            if (accountType === 'tfsa') {
                accountsToPullFrom = ['tfsa', 'tfsa_successor'];
            } else {
                accountsToPullFrom = [accountType];
            }

            let totalNetReceived = 0;
            let totalTaxGenerated = 0;
            let remainingNeed = requiredNetCash;

            for (let account of accountsToPullFrom) {
                if (remainingNeed <= 0.01) break;
                if (!person[account] || person[account] <= 0) continue;

                let isFullyTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(account);
                let isCapitalGain = ['nreg', 'crypto'].includes(account);
                let grossWithdrawalNeeded = remainingNeed;
                let effectiveTaxRate = 0;

                let acbKey = account === 'crypto' ? 'crypto_acb' : 'acb';

                if (isFullyTaxable) {
                    effectiveTaxRate = Math.min(marginalRate || 0, 0.54); 
                    grossWithdrawalNeeded = remainingNeed / (1 - effectiveTaxRate);
                } else if (isCapitalGain) {
                    let gainRatio = Math.max(0, 1 - (person[acbKey] / person[account]));
                    effectiveTaxRate = Math.min(marginalRate || 0, 0.54) * 0.5 * gainRatio;
                    grossWithdrawalNeeded = remainingNeed / (1 - effectiveTaxRate);
                }
                
                let currentAge = (prefix === 'p1') ? age1 : age2;
                let availableAccountBalance = person[account];
                
                if (account === 'lif' || account === 'lirf') {
                    let maxLimit = prefix === 'p1' ? lifLimits.lifMax1 : lifLimits.lifMax2;
                    availableAccountBalance = Math.min(availableAccountBalance, maxLimit);
                    if (availableAccountBalance <= 0.01) continue; 
                }
                
                let takenAmount = Math.min(availableAccountBalance, grossWithdrawalNeeded);

                if (account === 'lif' || account === 'lirf') {
                    if (prefix === 'p1') lifLimits.lifMax1 -= takenAmount;
                    else lifLimits.lifMax2 -= takenAmount;
                }
                
                let logKey = account;
                if (account === 'rrsp' && currentAge >= this.CONSTANTS.RRIF_START_AGE) logKey = 'RRIF';
                else if (account === 'rrsp') logKey = 'RRSP';
                else if (account === 'rrif_acct') logKey = 'RRIF';
                else if (account === 'lif') logKey = 'LIF';
                else if (account === 'lirf') logKey = 'LIRF';
                else if (account === 'tfsa') logKey = 'TFSA';
                else if (account === 'tfsa_successor') logKey = 'TFSA (Successor)';
                else if (account === 'fhsa') logKey = 'FHSA';
                else if (account === 'nreg') logKey = 'Non-Reg';
                else if (account === 'cash') logKey = 'Cash';
                else if (account === 'crypto') logKey = 'Crypto';

                person[account] -= takenAmount;
                
                let taxableAmountForCallback = 0;
                let acbSold = 0;
                let capitalGain = 0;
                
                if (isCapitalGain) {
                    let proportionSold = takenAmount / (person[account] + takenAmount); 
                    acbSold = person[acbKey] * proportionSold;
                    person[acbKey] = Math.max(0, person[acbKey] - acbSold);
                    capitalGain = takenAmount - acbSold;
                    taxableAmountForCallback = Math.max(0, capitalGain * 0.5); 
                } else if (isFullyTaxable) {
                    taxableAmountForCallback = takenAmount;
                }

                if (flowLog) {
                    let key = (prefix.toUpperCase()) + " " + logKey;
                    flowLog.withdrawals[key] = (flowLog.withdrawals[key] || 0) + takenAmount;
                    
                    if (withdrawalBreakdown) {
                        withdrawalBreakdown[prefix][logKey] = (withdrawalBreakdown[prefix][logKey] || 0) + takenAmount;
                        
                        if (isCapitalGain) {
                            if (!withdrawalBreakdown[prefix][logKey + '_math']) {
                                withdrawalBreakdown[prefix][logKey + '_math'] = { wd: 0, acb: 0, gain: 0, tax: 0 };
                            }
                            withdrawalBreakdown[prefix][logKey + '_math'].wd += takenAmount;
                            withdrawalBreakdown[prefix][logKey + '_math'].acb += acbSold;
                            withdrawalBreakdown[prefix][logKey + '_math'].gain += capitalGain;
                            withdrawalBreakdown[prefix][logKey + '_math'].tax += taxableAmountForCallback;
                        }
                    }
                }
                
                if (onWithdrawalCallback) {
                     if (isFullyTaxable) {
                         onWithdrawalCallback(prefix, takenAmount, 0); 
                     } else if (isCapitalGain) {
                         onWithdrawalCallback(prefix, taxableAmountForCallback, takenAmount - taxableAmountForCallback);
                     } else {
                         onWithdrawalCallback(prefix, 0, takenAmount); 
                     }
                }

                let netReceived = takenAmount * (1 - effectiveTaxRate);
                totalNetReceived += netReceived;
                totalTaxGenerated += taxableAmountForCallback;
                remainingNeed -= netReceived;
            }

            return { net: totalNetReceived, tax: totalTaxGenerated };
        };

        const executeWithdrawalStrategy = (ceiling1, ceiling2, currentStrategies, onlyTaxableAccounts) => {
            let indexP1 = 0;
            let indexP2 = 0;

            let sanityLimit = 200; 
            while (remainingDeficit > 1 && (indexP1 < currentStrategies.length || indexP2 < currentStrategies.length) && sanityLimit-- > 0) {
                
                while (indexP1 < currentStrategies.length) {
                    let type = currentStrategies[indexP1];
                    if (!alive1 || !hasBalance(person1, type, 'p1')) { 
                        indexP1++; 
                        continue; 
                    }
                    let isTaxableAtAll = ['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(type);
                    if (onlyTaxableAccounts && !isTaxableAtAll) { 
                        indexP1++; 
                        continue; 
                    }
                    if (ceiling1 !== Infinity && isTaxableAtAll) {
                        if (ceiling1 - runningIncome1 <= 1) { 
                            indexP1++; 
                            continue; 
                        }
                    }
                    break;
                }
                
                while (indexP2 < currentStrategies.length) {
                    let type = currentStrategies[indexP2];
                    if (!alive2 || !hasBalance(person2, type, 'p2')) { 
                        indexP2++; 
                        continue; 
                    }
                    let isTaxableAtAll = ['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(type);
                    if (onlyTaxableAccounts && !isTaxableAtAll) { 
                        indexP2++; 
                        continue; 
                    }
                    if (ceiling2 !== Infinity && isTaxableAtAll) {
                        if (ceiling2 - runningIncome2 <= 1) { 
                            indexP2++; 
                            continue; 
                        }
                    }
                    break;
                }

                const typeP1 = indexP1 < currentStrategies.length ? currentStrategies[indexP1] : null;
                const typeP2 = indexP2 < currentStrategies.length ? currentStrategies[indexP2] : null;

                if (!typeP1 && !typeP2) break;

                const marginalRate1 = this.calculateTaxDetailed(runningIncome1, province, taxBrackets, oasReceived1, oasThresholdInflation, earnedIncome1, baseInflation, dividendIncome1).margRate;
                const marginalRate2 = this.calculateTaxDetailed(runningIncome2, province, taxBrackets, oasReceived2, oasThresholdInflation, earnedIncome2, baseInflation, dividendIncome2).margRate;

                let withdrawTarget = null;
                
                if (!typeP1) {
                    withdrawTarget = 'p2';
                } else if (!typeP2) {
                    withdrawTarget = 'p1';
                } else if (indexP1 < indexP2) {
                    withdrawTarget = 'p1'; 
                } else if (indexP2 < indexP1) {
                    withdrawTarget = 'p2'; 
                } else {
                    let isTaxFree = !['rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'crypto'].includes(typeP1);
                    if (isTaxFree) {
                        withdrawTarget = 'split'; 
                    } else if (Math.abs(runningIncome1 - runningIncome2) < MARGINAL_TOLERANCE) {
                        withdrawTarget = 'split';
                    } else if (runningIncome1 < runningIncome2) {
                        withdrawTarget = 'p1';
                    } else {
                        withdrawTarget = 'p2';
                    }
                }

                let getNetRoomAvailable = (accountType, income, marginalRate, personObj, ceiling) => {
                    if (ceiling === Infinity) return Infinity;
                    let isFullyTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(accountType); 
                    let isCapitalGain = ['nreg', 'crypto'].includes(accountType);
                    
                    if (isFullyTaxable) {
                        let grossRoom = Math.max(0, ceiling - income);
                        return grossRoom * (1 - Math.min(marginalRate || 0, 0.54));
                    } else if (isCapitalGain) {
                        let grossRoom = Math.max(0, ceiling - income);
                        let acbKey = accountType === 'crypto' ? 'crypto_acb' : 'acb';
                        let balance = personObj[accountType];
                        let gainRatio = balance > 0 ? Math.max(0, 1 - (personObj[acbKey] / balance)) : 0;
                        
                        if (gainRatio > 0) {
                            let cashRoom = grossRoom / (0.5 * gainRatio);
                            return cashRoom * (1 - (Math.min(marginalRate || 0, 0.54) * 0.5 * gainRatio));
                        } else {
                            return Infinity; 
                        }
                    }
                    return Infinity;
                };

                if (withdrawTarget === 'split') {
                    let netRoom1 = getNetRoomAvailable(typeP1, runningIncome1, marginalRate1, person1, ceiling1);
                    let netRoom2 = getNetRoomAvailable(typeP2, runningIncome2, marginalRate2, person2, ceiling2);
                    
                    let halfDeficit = remainingDeficit / 2;
                    let require1 = Math.min(halfDeficit, netRoom1);
                    let require2 = Math.min(halfDeficit, netRoom2);

                    if (require1 < halfDeficit) require2 = Math.min(remainingDeficit - require1, netRoom2);
                    if (require2 < halfDeficit) require1 = Math.min(remainingDeficit - require2, netRoom1);

                    if (require1 > 0 && require1 < 10) require1 = Math.min(remainingDeficit, netRoom1);
                    if (require2 > 0 && require2 < 10) require2 = Math.min(remainingDeficit, netRoom2);

                    let gotP1 = require1 > 0 ? withdrawFromAccount(person1, typeP1, require1, 'p1', marginalRate1) : { net: 0, tax: 0 };
                    let gotP2 = require2 > 0 ? withdrawFromAccount(person2, typeP2, require2, 'p2', marginalRate2) : { net: 0, tax: 0 };

                    if (gotP1.net <= 0.01 && gotP1.tax <= 0.01 && require1 > 0.01) {
                        if (!['lif', 'lirf'].includes(typeP1)) person1[typeP1] = 0;
                    }
                    if (gotP2.net <= 0.01 && gotP2.tax <= 0.01 && require2 > 0.01) {
                        if (!['lif', 'lirf'].includes(typeP2)) person2[typeP2] = 0;
                    }

                    remainingDeficit -= (gotP1.net + gotP2.net);
                    runningIncome1 += gotP1.tax;
                    runningIncome2 += gotP2.tax;
                } else {
                    let amountToTake = remainingDeficit;
                    let targetPersonObj = withdrawTarget === 'p1' ? person1 : person2;
                    let targetAccountType = withdrawTarget === 'p1' ? typeP1 : typeP2;
                    let targetMarginalRate = withdrawTarget === 'p1' ? marginalRate1 : marginalRate2;
                    let targetIncome = withdrawTarget === 'p1' ? runningIncome1 : runningIncome2;
                    let targetCeiling = withdrawTarget === 'p1' ? ceiling1 : ceiling2;
                    
                    let netRoom = getNetRoomAvailable(targetAccountType, targetIncome, targetMarginalRate, targetPersonObj, targetCeiling);

                    if (typeP1 && typeP2 && indexP1 === indexP2 && !['tfsa','cash','fhsa'].includes(targetAccountType)) {
                        let incomeGap = Math.abs(runningIncome1 - runningIncome2);
                        let effectiveRate = Math.min(targetMarginalRate || 0, 0.54);
                        
                        if (['nreg', 'crypto'].includes(targetAccountType)) {
                            let acbKey = targetAccountType === 'crypto' ? 'crypto_acb' : 'acb';
                            let balance = targetPersonObj[targetAccountType];
                            let gainRatio = balance > 0 ? Math.max(0, 1 - (targetPersonObj[acbKey] / balance)) : 0;
                            effectiveRate = effectiveRate * 0.5 * gainRatio;
                        }
                        
                        let netGap = incomeGap * (1 - effectiveRate);
                        if (netGap > 0) amountToTake = Math.min(amountToTake, netGap);
                    }

                    amountToTake = Math.min(amountToTake, netRoom);
                    
                    if (amountToTake <= 0.01) {
                        if (withdrawTarget === 'p1') runningIncome1 = ceiling1;
                        if (withdrawTarget === 'p2') runningIncome2 = ceiling2;
                        continue;
                    }

                    let gotCash = withdrawFromAccount(targetPersonObj, targetAccountType, amountToTake, withdrawTarget, targetMarginalRate);
                    
                    if (gotCash.net <= 0.01 && gotCash.tax <= 0.01 && amountToTake > 0.01) {
                        if (!['lif', 'lirf'].includes(targetAccountType)) {
                            targetPersonObj[targetAccountType] = 0;
                        }
                    }
                    
                    remainingDeficit -= gotCash.net;
                    
                    if (withdrawTarget === 'p1') {
                        runningIncome1 += gotCash.tax;
                    } else {
                        runningIncome2 += gotCash.tax;
                    }
                }
            }
        };

        const optimizeOasFlag = this.inputs['oas_clawback_optimize'];
        const fullyOptimizeTaxFlag = this.inputs['fully_optimize_tax'];
        
        let p1OasCeiling = (optimizeOasFlag && age1 >= 65) ? oasThresholdInflation : Infinity;
        let p2OasCeiling = (optimizeOasFlag && age2 >= 65) ? oasThresholdInflation : Infinity;
        
        const brackets = taxBrackets.FED.brackets;

        const runPass = (ceil1, ceil2, strategiesArray, onlyTaxableAccounts = false) => {
            if (remainingDeficit > 1) {
                executeWithdrawalStrategy(ceil1, ceil2, strategiesArray, onlyTaxableAccounts);
            }
        };

        if (fullyOptimizeTaxFlag) {
            let taxFreeAccounts = ['tfsa', 'fhsa', 'cash'];
            let capGainsAccounts = ['nreg', 'crypto'];
            let fullyTaxableAccounts = ['rrif_acct', 'lif', 'lirf', 'rrsp'];
            
            runPass(brackets[0], brackets[0], fullyTaxableAccounts, true);
            runPass(brackets[0], brackets[0], capGainsAccounts, true);
            runPass(Infinity, Infinity, taxFreeAccounts, false);
            
            if (brackets.length > 1) {
                runPass(brackets[1], brackets[1], fullyTaxableAccounts, true);
                runPass(brackets[1], brackets[1], capGainsAccounts, true);
            }
            if (brackets.length > 2) {
                runPass(brackets[2], brackets[2], fullyTaxableAccounts, true);
                runPass(brackets[2], brackets[2], capGainsAccounts, true);
            }
            runPass(Infinity, Infinity, fullyTaxableAccounts, false);
            runPass(Infinity, Infinity, capGainsAccounts, false);
        } else {
            if (optimizeOasFlag && (p1OasCeiling < Infinity || p2OasCeiling < Infinity)) {
                runPass(p1OasCeiling, p2OasCeiling, withdrawalStrategies, true); 
                runPass(Infinity, Infinity, ['tfsa', 'fhsa', 'cash'], false);
            }
            runPass(Infinity, Infinity, withdrawalStrategies, false);
        }
    }

    runSimulation(detailed = false, simContext = null) {
        const currentYear = new Date().getFullYear();
        let netWorthArray = [];
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
            tfsa: this.getVal('p2_tfsa'), tfsa_successor: 0, fhsa: this.getVal('p2_fhsa'), resp: this.getVal('p2_resp'),
            rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), 
            crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), 
            rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), 
            dob: new Date(this.getRaw('p2_dob') || "1990-01"), retAge: this.getVal('p2_retireAge'), 
            lifeExp: this.getVal('p2_lifeExp'), nreg_yield: this.getVal('p2_nonreg_yield')/100, 
            acb: this.inputs['p2_nonreg_acb'] !== undefined ? this.getVal('p2_nonreg_acb') : this.getVal('p2_nonreg'), 
            crypto_acb: this.inputs['p2_crypto_acb'] !== undefined ? this.getVal('p2_crypto_acb') : this.getVal('p2_crypto') 
        };

        let simProperties = JSON.parse(JSON.stringify(this.properties));
        
        const p1StartAge = currentYear - person1.dob.getFullYear();
        const p2StartAge = currentYear - person2.dob.getFullYear();
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
        
        let fhsaLifetimeRooms = { 
            p1: Math.max(0, 40000 - (this.getVal('p1_fhsa') || 0)), 
            p2: Math.max(0, 40000 - (this.getVal('p2_fhsa') || 0)) 
        };

        for (let i = 0; i <= yearsToRun; i++) {
            const yr = currentYear + i;
            const age1 = p1StartAge + i;
            const age2 = p2StartAge + i;
            const alive1 = age1 <= person1.lifeExp;
            const alive2 = this.mode === 'Couple' ? age2 <= person2.lifeExp : false;
            
            if (!alive1 && !alive2) break;

            if (detailed) {
                flowLog = { 
                    contributions: { 
                        p1: {tfsa:0, fhsa:0, resp:0, rrsp:0, nreg:0, cash:0, crypto:0}, 
                        p2: {tfsa:0, fhsa:0, rrsp:0, nreg:0, cash:0, crypto:0} 
                    }, 
                    withdrawals: {} 
                };
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
                    if (person1.resp) person2.resp = (person2.resp || 0) + person1.resp;

                    person1.tfsa = 0; person1.tfsa_successor = 0;
                    person1.rrsp = 0; person1.rrif_acct = 0; person1.lif = 0; person1.lirf = 0;
                    person1.nreg = 0; person1.acb = 0; person1.cash = 0; person1.crypto = 0; person1.crypto_acb = 0;
                    person1.fhsa = 0; person1.resp = 0;
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
                    if (person2.resp) person1.resp = (person1.resp || 0) + person2.resp;
                    
                    person2.tfsa = 0; person2.tfsa_successor = 0;
                    person2.rrsp = 0; person2.rrif_acct = 0; person2.lif = 0; person2.lirf = 0;
                    person2.nreg = 0; person2.acb = 0; person2.cash = 0; person2.crypto = 0; person2.crypto_acb = 0;
                    person2.fhsa = 0; person2.resp = 0;
                }
            }

            const baseInflation = Math.pow(1 + consts.inflation, i);
            const oasThresholdInf = this.CONSTANTS.OAS_CLAWBACK_THRESHOLD * baseInflation;
            
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

            const preGrowthNreg1 = person1.nreg;
            const preGrowthNreg2 = person2.nreg;

            this.applyGrowth(person1, person2, isRet1, isRet2, this.inputs['asset_mode_advanced'], consts.inflation, i, simContext);

            const inflows = this.calcInflows(yr, i, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, consts, baseInflation, detailed ? trackedEvents : null);
            if (detailed && deathEvents.length > 0) {
                inflows.events.push(...deathEvents);
            }

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

            let rrspRoom1 = Math.min(inflows.p1.earned * 0.18, consts.rrspMax * baseInflation);
            let rrspRoom2 = Math.min(inflows.p2.earned * 0.18, consts.rrspMax * baseInflation);
            
            let p1_match_rate = this.getVal('p1_rrsp_match') / 100;
            let p2_match_rate = this.getVal('p2_rrsp_match') / 100;
            
            let p1_tier = this.getVal('p1_rrsp_match_tier') / 100;
            if (p1_tier <= 0) p1_tier = 1;
            let p2_tier = this.getVal('p2_rrsp_match_tier') / 100;
            if (p2_tier <= 0) p2_tier = 1;

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
                if (detailed) flowLog.contributions.p1.rrsp += totalMatch1; 
            }

            let totalMatch2 = 0;
            let actEmpPortionP2 = 0;
            if (targetTotalP2 > 0 && alive2) {
                totalMatch2 = Math.min(targetTotalP2, rrspRoom2);
                actEmpPortionP2 = empPortionP2 * (totalMatch2 / targetTotalP2);
                inflows.p2.gross += actEmpPortionP2;
                person2.rrsp += totalMatch2;
                rrspRoom2 -= totalMatch2;
                if (detailed) flowLog.contributions.p2.rrsp += totalMatch2; 
            }

            const regMins = this.calcRegMinimums(person1, person2, age1, age2, alive1, alive2, preGrowthRrsp1, preGrowthRrif1, preGrowthRrsp2, preGrowthRrif2, preGrowthLirf1, preGrowthLif1, preGrowthLirf2, preGrowthLif2);
            
            const taxBrackets = this.getInflatedTaxData(baseInflation);

            let divInc1 = preGrowthNreg1 * person1.nreg_yield;
            let divInc2 = alive2 ? (preGrowthNreg2 * person2.nreg_yield) : 0;

            let grossTaxable1 = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + regMins.p1 + regMins.lifTaken1 + inflows.p1.windfallTaxable + divInc1;
            let grossTaxable2 = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + regMins.p2 + regMins.lifTaken2 + inflows.p2.windfallTaxable + divInc2;

            let taxWithoutMatch1 = alive1 ? this.calculateTaxDetailed(grossTaxable1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1) : {totalTax: 0, margRate: 0};
            let taxWithoutMatch2 = alive2 ? this.calculateTaxDetailed(grossTaxable2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2) : {totalTax: 0, margRate: 0};

            let taxableIncome1 = Math.max(0, grossTaxable1 - totalMatch1);
            let taxableIncome2 = Math.max(0, grossTaxable2 - totalMatch2);

            let taxWithMatchOnly1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1) : {totalTax: 0, margRate: 0};
            let taxWithMatchOnly2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2) : {totalTax: 0, margRate: 0};

            let matchTaxSavings1 = taxWithoutMatch1.totalTax - taxWithMatchOnly1.totalTax;
            let matchTaxSavings2 = taxWithoutMatch2.totalTax - taxWithMatchOnly2.totalTax;

            let ccbPayout = this.calculateCCBForYear(yr, this.dependents, previousAFNI, baseInflation);
            if (ccbPayout > 0 && alive1) {
                inflows.p1.ccb = ccbPayout;
            }

            let lifMax1 = (preGrowthLirf1 + preGrowthLif1) * this.getLifMaxFactor(age1 - 1, this.getRaw('tax_province'));
            let lifMax2 = (preGrowthLirf2 + preGrowthLif2) * this.getLifMaxFactor(age2 - 1, this.getRaw('tax_province'));
            lifMax1 = Math.max(0, lifMax1 - regMins.lifTaken1);
            lifMax2 = Math.max(0, lifMax2 - regMins.lifTaken2);

            const expenses = this.calcOutflows(yr, i, age1, baseInflation, isRet1, isRet2, simContext);

            let mortgagePayment = 0;
            let keptProperties = [];
            
            simProperties.forEach(p => {
                if (p.sellEnabled && p.sellAge === age1) {
                    const proceeds = p.value;
                    const transCosts = proceeds * 0.05;
                    const netCash = proceeds - p.mortgage - transCosts;
                    const newHomeCost = (p.replacementValue || 0) * baseInflation;
                    const surplusCash = netCash - newHomeCost;
                    
                    if (surplusCash > 0) {
                        inflows.p1.windfallNonTax += surplusCash;
                    }
                    
                    if (detailed && !trackedEvents.has('Downsize')) { 
                        trackedEvents.add('Downsize'); 
                        inflows.events.push('Downsize'); 
                    }

                    if (newHomeCost > 0) {
                        keptProperties.push({
                            name: "Replacement: " + p.name, 
                            value: newHomeCost, 
                            mortgage: 0, 
                            growth: p.growth, 
                            rate: 0, 
                            payment: 0, 
                            manual: false, 
                            includeInNW: p.includeInNW, 
                            sellEnabled: false 
                        });
                    }
                } else {
                    if (p.mortgage > 0 && p.payment > 0) { 
                        let annualPayment = p.payment * 12;
                        let interest = p.mortgage * (p.rate / 100);
                        let principal = annualPayment - interest; 
                        
                        if (principal > p.mortgage) { 
                            principal = p.mortgage; 
                            annualPayment = principal + interest; 
                        } 
                        
                        p.mortgage = Math.max(0, p.mortgage - principal); 
                        mortgagePayment += annualPayment; 
                    } 
                    p.value *= (1 + (p.growth / 100));
                    keptProperties.push(p);
                }
            });
            simProperties = keptProperties;

            let futureExpenseAmt = 0;
            this.debt.forEach(d => {
                let startYear = new Date((d.start || new Date().toISOString().slice(0,7)) + "-01").getFullYear();
                if (startYear === yr) {
                    futureExpenseAmt += (Number(d.amount) || 0);
                }
            });
            let debtRepayment = futureExpenseAmt; 
            
            if (detailed && simProperties.reduce((sum, p) => sum + p.mortgage, 0) <= 0 && !trackedEvents.has('Mortgage Paid') && simProperties.some(p => p.mortgage === 0 && p.value > 0)) { 
                trackedEvents.add('Mortgage Paid'); 
                inflows.events.push('Mortgage Paid'); 
            }

            let pensionSplitTransfer = { p1ToP2: 0, p2ToP1: 0 };
            if (this.mode === 'Couple' && this.inputs['pension_split_enabled']) {
                this.applyPensionSplitting(taxableIncome1, taxableIncome2, inflows, regMins, person1, person2, age1, age2, (newInc1, newInc2, transferAmount, direction) => { 
                    taxableIncome1 = newInc1; 
                    taxableIncome2 = newInc2; 
                    if (direction === 'p1_to_p2') pensionSplitTransfer.p1ToP2 = transferAmount;
                    if (direction === 'p2_to_p1') pensionSplitTransfer.p2ToP1 = transferAmount;
                });
            }
            
            let tax1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1) : {totalTax: 0, margRate: 0};
            let tax2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2) : {totalTax: 0, margRate: 0};

            let netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax + (inflows.p1.ccb || 0);
            let netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
            
            let totalNetIncome = netIncome1 + netIncome2;
            const totalOutflows = expenses + mortgagePayment + debtRepayment;
            let netSurplus = totalNetIncome - totalOutflows;

            let wdBreakdown = detailed ? { p1: {}, p2: {} } : null;

            if (detailed) {
                if (regMins.p1 > 0) { 
                    flowLog.withdrawals['P1 RRIF'] = (flowLog.withdrawals['P1 RRIF'] || 0) + regMins.p1; 
                    wdBreakdown.p1.RRIF = regMins.p1; 
                    wdBreakdown.p1.RRIF_math = regMins.details.p1;
                }
                if (regMins.lifTaken1 > 0) { 
                    flowLog.withdrawals['P1 LIF'] = (flowLog.withdrawals['P1 LIF'] || 0) + regMins.lifTaken1; 
                    wdBreakdown.p1.LIF = regMins.lifTaken1; 
                    wdBreakdown.p1.LIF_math = regMins.details.p1;
                }
                if (regMins.p2 > 0) { 
                    flowLog.withdrawals['P2 RRIF'] = (flowLog.withdrawals['P2 RRIF'] || 0) + regMins.p2; 
                    wdBreakdown.p2.RRIF = regMins.p2; 
                    wdBreakdown.p2.RRIF_math = regMins.details.p2;
                }
                if (regMins.lifTaken2 > 0) { 
                    flowLog.withdrawals['P2 LIF'] = (flowLog.withdrawals['P2 LIF'] || 0) + regMins.lifTaken2; 
                    wdBreakdown.p2.LIF = regMins.lifTaken2; 
                    wdBreakdown.p2.LIF_math = regMins.details.p2;
                }
            }

            let actualDeductions = { p1: 0, p2: 0 };
            let actFhsaLim1 = fhsaClosed1 ? 0 : consts.fhsaLimit * baseInflation;
            let actFhsaLim2 = fhsaClosed2 ? 0 : consts.fhsaLimit * baseInflation;

            if (netSurplus > 0) {
                this.handleSurplus(netSurplus, person1, person2, alive1, alive2, flowLog, i, consts.tfsaLimit * baseInflation, rrspRoom1, rrspRoom2, consts.cryptoLimit * baseInflation, actFhsaLim1, actFhsaLim2, consts.respLimit * baseInflation, actualDeductions, fhsaLifetimeRooms);
                
                if (actualDeductions.p1 > 0) {
                    let recalculatedTax1 = this.calculateTaxDetailed(taxableIncome1 - actualDeductions.p1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1);
                    pendingRefund.p1 = tax1.totalTax - recalculatedTax1.totalTax;
                }
                if (actualDeductions.p2 > 0) {
                    let recalculatedTax2 = this.calculateTaxDetailed(taxableIncome2 - actualDeductions.p2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2);
                    pendingRefund.p2 = tax2.totalTax - recalculatedTax2.totalTax;
                }
            } else {
                let cashFromNonTaxableWithdrawals = 0; 
                for (let pass = 0; pass < 10; pass++) {
                    let dynTax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1);
                    let dynTax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2);
                    
                    tax1 = dynTax1; 
                    tax2 = dynTax2;

                    let dynNet1 = taxableIncome1 - dynTax1.totalTax + inflows.p1.windfallNonTax + (inflows.p1.ccb || 0);
                    let dynNet2 = alive2 ? taxableIncome2 - dynTax2.totalTax + inflows.p2.windfallNonTax : 0;
                    let dynTotalNet = dynNet1 + dynNet2;
                    
                    let currentDeficit = totalOutflows - (dynTotalNet + cashFromNonTaxableWithdrawals);
                    
                    if (currentDeficit < 1) break; 
                    
                    this.handleDeficit(currentDeficit, person1, person2, taxableIncome1, taxableIncome2, alive1, alive2, flowLog, wdBreakdown, taxBrackets, (prefix, taxAmt, nonTaxAmt) => {
                        if (prefix === 'p1') taxableIncome1 += taxAmt;
                        if (prefix === 'p2') taxableIncome2 += taxAmt;
                        cashFromNonTaxableWithdrawals += nonTaxAmt;
                    }, age1, age2, inflows.p1.oas, inflows.p2.oas, oasThresholdInf, { lifMax1, lifMax2 }, inflows.p1.earned, inflows.p2.earned, baseInflation, divInc1, divInc2);
                }
                
                tax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets, inflows.p1.oas, oasThresholdInf, inflows.p1.earned, baseInflation, divInc1);
                tax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets, inflows.p2.oas, oasThresholdInf, inflows.p2.earned, baseInflation, divInc2);
                netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax + (inflows.p1.ccb || 0);
                netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
                netSurplus = (netIncome1 + netIncome2) - totalOutflows;
            }

            previousAFNI = Math.max(0, (taxableIncome1 - actualDeductions.p1) + (taxableIncome2 - actualDeductions.p2));

            const liquidAssets1 = person1.tfsa + person1.tfsa_successor + person1.rrsp + person1.crypto + person1.nreg + person1.cash + person1.lirf + person1.lif + person1.rrif_acct + (person1.fhsa || 0);
            const liquidAssets2 = this.mode === 'Couple' ? (person2.tfsa + person2.tfsa_successor + person2.rrsp + person2.crypto + person2.nreg + person2.cash + person2.lirf + person2.lif + person2.rrif_acct + (person2.fhsa || 0)) : 0;
            
            const liquidNetWorth = (liquidAssets1 + liquidAssets2);
            
            let realEstateValue = 0, realEstateDebt = 0;
            let reExcludedValue = 0, reExcludedDebt = 0;
            simProperties.forEach(prop => { 
                if (prop.includeInNW) { 
                    realEstateValue += prop.value; 
                    realEstateDebt += prop.mortgage; 
                } else { 
                    reExcludedValue += prop.value; 
                    reExcludedDebt += prop.mortgage; 
                }
            });
            finalNetWorth = liquidNetWorth + (realEstateValue - realEstateDebt);

            if (!detailed) {
                netWorthArray.push(finalNetWorth);
            } else {
                const totalWithdrawals = Object.values(flowLog.withdrawals).reduce((sum, val) => sum + val, 0);
                const p1GrossTotal = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + inflows.p1.windfallTaxable + inflows.p1.windfallNonTax + (inflows.p1.ccb || 0);
                const p2GrossTotal = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + inflows.p2.windfallTaxable + inflows.p2.windfallNonTax;
                const totalYield = divInc1 + divInc2;
                const grossInflow = p1GrossTotal + p2GrossTotal + totalYield + totalWithdrawals;
                
                const cashSurplus = grossInflow - (totalOutflows + tax1.totalTax + tax2.totalTax + totalMatch1 + totalMatch2);

                projectionData.push({
                    year: yr, 
                    p1Age: age1, 
                    p2Age: this.mode === 'Couple' ? age2 : null, 
                    p1Alive: alive1, 
                    p2Alive: alive2,
                    incomeP1: inflows.p1.gross, 
                    incomeP2: inflows.p2.gross,
                    eiMatP1: inflows.p1.eiMat, 
                    eiMatP2: inflows.p2.eiMat,
                    topUpP1: inflows.p1.topUp, 
                    topUpP2: inflows.p2.topUp,
                    cppP1: inflows.p1.cpp, 
                    cppP2: inflows.p2.cpp,
                    oasP1: inflows.p1.oas, 
                    oasP2: inflows.p2.oas,
                    ccbP1: inflows.p1.ccb || 0,
                    oasClawbackP1: tax1.oas_clawback || 0, 
                    oasClawbackP2: tax2.oas_clawback || 0,
                    taxIncP1: taxableIncome1, 
                    taxIncP2: taxableIncome2,
                    oasThreshold: oasThresholdInf,
                    benefitsP1: inflows.p1.cpp + inflows.p1.oas, 
                    benefitsP2: inflows.p2.cpp + inflows.p2.oas,
                    dbP1: inflows.p1.pension, 
                    dbP2: inflows.p2.pension,
                    taxP1: tax1.totalTax, 
                    taxP2: tax2.totalTax,
                    taxDetailsP1: tax1, 
                    taxDetailsP2: tax2,
                    p1Net: netIncome1, 
                    p2Net: netIncome2,
                    pensionSplit: pensionSplitTransfer,
                    expenses: expenses, 
                    mortgagePay: mortgagePayment, 
                    debtRepayment,
                    debtRemaining: 0, 
                    surplus: (Math.abs(cashSurplus) < 100 && liquidNetWorth > 100) ? 0 : cashSurplus,
                    debugNW: finalNetWorth,
                    liquidNW: liquidNetWorth,
                    assetsP1: {...person1}, 
                    assetsP2: {...person2},
                    wdBreakdown: wdBreakdown,
                    flows: flowLog,
                    events: inflows.events, 
                    householdNet: grossInflow, 
                    grossInflow: grossInflow, 
                    visualExpenses: expenses + mortgagePayment + debtRepayment + tax1.totalTax + tax2.totalTax,
                    mortgage: realEstateDebt + reExcludedDebt, 
                    homeValue: realEstateValue + reExcludedValue,
                    reIncludedEq: realEstateValue - realEstateDebt,
                    reExcludedEq: reExcludedValue - reExcludedDebt,
                    reIncludedValue: realEstateValue,
                    windfall: inflows.p1.windfallTaxable + (inflows.p1.windfallNonTax - appliedRefundP1) + inflows.p2.windfallTaxable + (inflows.p2.windfallNonTax - appliedRefundP2),
                    postRetP1: inflows.p1.postRet, 
                    postRetP2: inflows.p2.postRet,
                    invIncP1: divInc1, 
                    invIncP2: divInc2,
                    invYieldMathP1: { bal: preGrowthNreg1, rate: person1.nreg_yield, amt: divInc1 },
                    invYieldMathP2: { bal: preGrowthNreg2, rate: person2.nreg_yield, amt: divInc2 },
                    debugTotalInflow: grossInflow,
                    rrspRoomP1: rrspRoom1, 
                    rrspRoomP2: rrspRoom2,
                    rrspMatchP1: actEmpPortionP1, 
                    rrspTotalMatch1: totalMatch1,
                    rrspMatchP2: actEmpPortionP2, 
                    rrspTotalMatch2: totalMatch2,
                    rrspRefundP1: appliedRefundP1, 
                    rrspRefundP2: appliedRefundP2,
                    matchTaxSavingsP1: matchTaxSavings1, 
                    matchTaxSavingsP2: matchTaxSavings2,
                    discTaxSavingsP1: pendingRefund.p1, 
                    discTaxSavingsP2: pendingRefund.p2
                });
            }

            // End of Year FHSA Expiry Checks
            if (alive1 && !fhsaClosed1) {
                if (person1.fhsa > 0 || (detailed && flowLog && flowLog.contributions.p1.fhsa > 0)) {
                    if (fhsaYearsP1 === 0) fhsaYearsP1 = 1;
                    else fhsaYearsP1++;
                }
                if (fhsaYearsP1 >= 15 || age1 >= 71) {
                    let transferAmount = person1.fhsa;
                    if (transferAmount > 0) {
                        if (age1 >= this.CONSTANTS.RRIF_START_AGE) {
                            person1.rrif_acct += transferAmount;
                        } else {
                            person1.rrsp += transferAmount;
                        }
                        if (detailed) {
                            if (!trackedEvents.has('FHSA Expired')) trackedEvents.add('FHSA Expired');
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
                    let transferAmount = person2.fhsa;
                    if (transferAmount > 0) {
                        if (age2 >= this.CONSTANTS.RRIF_START_AGE) {
                            person2.rrif_acct += transferAmount;
                        } else {
                            person2.rrsp += transferAmount;
                        }
                        if (detailed) {
                            if (!trackedEvents.has('FHSA Expired')) trackedEvents.add('FHSA Expired');
                            if (!projectionData[projectionData.length - 1].events.includes('FHSA Expired')) {
                                projectionData[projectionData.length - 1].events.push('FHSA Expired');
                            }
                        }
                    }
                    person2.fhsa = 0;
                    fhsaClosed2 = true;
                }
            }

            consts.cppMax1 *= (1 + consts.inflation); 
            consts.oasMax1 *= (1 + consts.inflation);
            consts.cppMax2 *= (1 + consts.inflation); 
            consts.oasMax2 *= (1 + consts.inflation);
        }
        
        return detailed ? projectionData : netWorthArray;
    }
}
