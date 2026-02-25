/**
 * cppEngine.js
 * Exact-math Canada Pension Plan calculator engine.
 * Calculates Base CPP (17% Drop-out) + Enhanced Phase 1 (2019+) + Enhanced Phase 2 (2024+).
 */

class CPPEngine {
    constructor() {
        // Historical YMPE (Yearly Maximum Pensionable Earnings)
        this.YMPE = {
            1966: 5000, 1967: 5000, 1968: 5100, 1969: 5200, 1970: 5300,
            1971: 5400, 1972: 5500, 1973: 5600, 1974: 6600, 1975: 7400,
            1976: 8300, 1977: 9300, 1978: 10400, 1979: 11700, 1980: 13100,
            1981: 14700, 1982: 16500, 1983: 18500, 1984: 20800, 1985: 23400,
            1986: 25800, 1987: 25900, 1988: 26500, 1989: 27700, 1990: 28900,
            1991: 30500, 1992: 32200, 1993: 33400, 1994: 34400, 1995: 34900,
            1996: 35400, 1997: 35800, 1998: 36900, 1999: 37400, 2000: 37600,
            2001: 38300, 2002: 39100, 2003: 39900, 2004: 40500, 2005: 41100,
            2006: 42100, 2007: 42500, 2008: 44900, 2009: 46300, 2010: 47200,
            2011: 48300, 2012: 50100, 2013: 51100, 2014: 52500, 2015: 53600,
            2016: 54900, 2017: 55300, 2018: 55900, 2019: 57400, 2020: 58700,
            2021: 61600, 2022: 64900, 2023: 66600, 2024: 68500, 2025: 71100, 
            2026: 73200
        };
        
        // Year's Additional Maximum Pensionable Earnings (YAMPE) - Phase 2 Enhanced CPP
        this.YAMPE = {
            2024: 73200, 2025: 79600, 2026: 83400 
        };
    }

    parseServiceCanadaText(rawText) {
        let records = [];
        
        // Clean the text: unify newlines and spaces to treat as a stream
        const cleanText = rawText.replace(/\r/g, '').replace(/\n/g, ' ').trim();
        
        // Pattern to find years (4 digits) or ranges (e.g., "2006 to 2007")
        // Uses word boundaries (\b) to avoid matching parts of large dollar amounts
        const yearPattern = /\b(\d{4})\b(?:\s+to\s+\b(\d{4})\b)?/g;
        
        let matches = [];
        let match;
        while ((match = yearPattern.exec(cleanText)) !== null) {
            matches.push({
                startYear: parseInt(match[1]),
                endYear: match[2] ? parseInt(match[2]) : parseInt(match[1]),
                index: match.index,
                fullMatch: match[0]
            });
        }
        
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            // The segment for this year(s) starts after the year match and ends at the next year match
            const nextIndex = matches[i + 1] ? matches[i + 1].index : cleanText.length;
            const segment = cleanText.substring(current.index + current.fullMatch.length, nextIndex);
            
            // Extract all dollar amounts from the segment (handling commas and decimals)
            const amountMatches = segment.match(/[\d,]+\.\d{2}/g) || segment.match(/[\d,]+/g) || [];
            const amounts = amountMatches.map(a => parseFloat(a.replace(/,/g, '')));
            
            // If no amounts found, skip (likely header text or empty year)
            if (amounts.length === 0) continue;
            
            // Apply logic to each year in the range
            for (let year = current.startYear; year <= current.endYear; year++) {
                let earnings = 0;
                
                // Rule-based parsing based on CPP enhancement periods
                if (year < 2019) {
                    // Pre-2019: [Base Contribution, Base Contribution Repeat, Base Earnings]
                    // Usually 3 amounts; the last one is the earnings.
                    earnings = amounts[amounts.length - 1];
                } else if (year >= 2019 && year <= 2023) {
                    // Phase 1 Enhanced: [Base Contrib, 1st Addtl Contrib, Total Contrib, Base Earnings, 1st Addtl Earnings]
                    // Base Earnings is index 3.
                    earnings = amounts.length >= 4 ? amounts[3] : amounts[amounts.length - 1];
                } else if (year >= 2024) {
                    // Phase 2 Enhanced: [BaseC, 1stC, 2ndC, TotalC, BaseE, 1stE, 2ndE]
                    // Total Earnings for the engine calculation = Base Earnings (index 4) + 2nd Addtl Earnings (index 6).
                    let baseE = amounts.length >= 5 ? amounts[4] : amounts[amounts.length - 1];
                    let secondE = amounts.length >= 7 ? amounts[6] : 0;
                    earnings = baseE + secondE;
                }
                
                // Heuristic Fallback: Earnings are almost always significantly larger than contributions.
                // If selected earnings < 1000 but larger amounts exist, take the maximum.
                if (earnings < 1000 && Math.max(...amounts) > 1000) {
                    earnings = Math.max(...amounts);
                }

                if (!isNaN(earnings) && year >= 1966 && year <= new Date().getFullYear() + 1) {
                    records.push({ year: year, earnings: earnings });
                }
            }
        }

        // De-duplicate (in case ranges overlap single years) and sort
        records = Array.from(new Map(records.map(item => [item.year, item])).values());
        return records.sort((a, b) => a.year - b.year);
    }

    /**
     * Calculates the Base CPP amount using the 17% general drop-out
     */
    calculateBaseCPP(lifetimeRecords, birthYear, startPensionYear, childRearingYears = []) {
        const yearTurn18 = birthYear + 18;
        let monthsContributory = (startPensionYear - yearTurn18) * 12;
        
        if (monthsContributory <= 0) return { monthlyBase: 0, monthsContributoryTotal: 0, droppedCRDOYears: 0, droppedGeneralYears: 0, averageRatio: 0 };

        let pensionableRatios = lifetimeRecords.map(r => {
            const ympe = this.YMPE[r.year];
            if (!ympe) return null;
            const cappedEarnings = Math.min(r.earnings, ympe);
            return {
                year: r.year,
                ratio: cappedEarnings / ympe,
                ympe: ympe,
                earnings: r.earnings,
                isChildRearing: childRearingYears.includes(r.year)
            };
        }).filter(r => r !== null && r.year >= yearTurn18 && r.year < startPensionYear);

        let crdoDropped = 0;
        pensionableRatios = pensionableRatios.filter(r => {
            if (r.isChildRearing && r.ratio < 0.8) { 
                crdoDropped++;
                monthsContributory -= 12;
                return false;
            }
            return true;
        });

        const minMonths = 120;
        let generalDropoutMonths = Math.floor(monthsContributory * 0.17);
        if (monthsContributory - generalDropoutMonths < minMonths) {
            generalDropoutMonths = Math.max(0, monthsContributory - minMonths);
        }
        
        const generalDropoutYears = Math.floor(generalDropoutMonths / 12);
        
        pensionableRatios.sort((a, b) => a.ratio - b.ratio);
        const finalRatios = pensionableRatios.slice(generalDropoutYears);
        
        const totalRatio = finalRatios.reduce((sum, r) => sum + r.ratio, 0);
        const averageRatio = finalRatios.length > 0 ? (totalRatio / finalRatios.length) : 0;

        let last5YMPE = 0;
        let countedYears = 0;
        for(let i = 1; i <= 5; i++) {
            let y = startPensionYear - i;
            if (this.YMPE[y]) {
                last5YMPE += this.YMPE[y];
                countedYears++;
            }
        }
        const avgYMPE = countedYears > 0 ? (last5YMPE / countedYears) : this.YMPE[2026];

        const monthlyBaseCPP = (avgYMPE * 0.25 * averageRatio) / 12;

        return {
            monthlyBase: monthlyBaseCPP,
            monthsContributoryTotal: monthsContributory,
            droppedCRDOYears: crdoDropped,
            droppedGeneralYears: generalDropoutYears,
            averageRatio: averageRatio,
            avgYMPEUsed: avgYMPE
        };
    }

    /**
     * Calculates the Enhanced CPP (Phase 1 and Phase 2)
     * The enhancement is NOT subject to the 17% general drop-out, and the denominator is strictly 480 months (40 yrs)
     */
    calculateEnhancedCPP(lifetimeRecords, startPensionYear, avgYMPE) {
        let phase1Sum = 0;
        let phase2Sum = 0;

        // The enhancement relies on the Average YMPE of the 5 years prior to taking the pension
        // (We pass it in from the base calculation to ensure consistency)
        const targetYMPE = avgYMPE; 
        const targetYAMPE = targetYMPE * 1.14; // Phase 2 ceiling is ~14% higher than YMPE

        lifetimeRecords.forEach(r => {
            if (r.year >= 2019 && r.year < startPensionYear) {
                let curYMPE = this.YMPE[r.year];
                if (curYMPE) {
                    // Phase 1 (First Additional Pensionable Earnings - FAPE)
                    // Capped at YMPE. Inflated to the Target YMPE.
                    let cappedEarnings = Math.min(r.earnings, curYMPE);
                    let inflatedFAPE = cappedEarnings * (targetYMPE / curYMPE);
                    phase1Sum += inflatedFAPE;
                }
            }

            if (r.year >= 2024 && r.year < startPensionYear) {
                let curYMPE = this.YMPE[r.year];
                let curYAMPE = this.YAMPE[r.year] || (curYMPE * 1.14);
                if (curYMPE && curYAMPE) {
                    // Phase 2 (Second Additional Pensionable Earnings - SAPE)
                    // Earnings *between* YMPE and YAMPE. Inflated to Target YAMPE.
                    let tier2Earnings = Math.max(0, Math.min(r.earnings, curYAMPE) - curYMPE);
                    let inflatedSAPE = tier2Earnings * (targetYAMPE / curYAMPE);
                    phase2Sum += inflatedSAPE;
                }
            }
        });

        // The enhancement formulas divide by 480 months (40 years) regardless of your actual working years
        // Phase 1 adds 8.33% replacement rate. Phase 2 adds 33.33% replacement rate on the higher tier.
        const monthlyPhase1 = (0.08333 * phase1Sum) / 480;
        const monthlyPhase2 = (0.33333 * phase2Sum) / 480;

        return {
            monthlyPhase1: monthlyPhase1,
            monthlyPhase2: monthlyPhase2,
            totalMonthlyEnhancement: monthlyPhase1 + monthlyPhase2
        };
    }
}
