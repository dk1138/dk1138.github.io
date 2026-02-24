/**
 * cppEngine.js
 * An exact-math Canada Pension Plan calculator engine.
 * Handles historical YMPE, the 17% General Drop-out, and Child Rearing Provision.
 */

export class CPPEngine {
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
        
        // Year's Additional Maximum Pensionable Earnings (YAMPE) - Tier 2 starts 2024
        this.YAMPE = {
            2024: 73200, 2025: 79600, 2026: 83400 // Est
        };
    }

    /**
     * The "Magic Paste" Parser
     * Takes raw text copied directly from the Service Canada "Statement of Contributions" page
     * and extracts the years and earnings.
     */
    parseServiceCanadaText(rawText) {
        let records = [];
        // Match patterns like "2020 $58,700.00 $2,898.00" or "2015 45000 1500"
        const lines = rawText.split('\n');
        
        const yearRegex = /^.*?(\d{4}).*?\$?([\d,]+\.\d{2}|[\d,]+).*$/;

        lines.forEach(line => {
            const match = line.trim().match(yearRegex);
            if (match) {
                const year = parseInt(match[1]);
                if (year >= 1966 && year <= new Date().getFullYear()) {
                    let earnings = parseFloat(match[2].replace(/,/g, ''));
                    // Check if it's a valid earnings number (not just a random year mention)
                    if (!isNaN(earnings)) {
                        records.push({ year: year, earnings: earnings });
                    }
                }
            }
        });

        // Remove duplicates and sort by year
        records = Array.from(new Map(records.map(item => [item.year, item])).values());
        return records.sort((a, b) => a.year - b.year);
    }

    /**
     * Projects future earnings up to retirement age to give an accurate future estimate,
     * not just a snapshot of the past.
     */
    buildLifetimeEarnings(historicalRecords, birthYear, currentYear, retYear, futureSalary, inflation) {
        let lifetime = [...historicalRecords];
        let existingYears = new Set(lifetime.map(r => r.year));

        // Fill in missing past years with 0
        for (let y = birthYear + 18; y <= currentYear - 1; y++) {
            if (!existingYears.has(y)) {
                lifetime.push({ year: y, earnings: 0 });
            }
        }

        // Project future years
        let currentSalary = futureSalary;
        let lastYMPE = this.YMPE[2026];
        
        for (let y = currentYear; y < retYear; y++) {
            if (!existingYears.has(y)) {
                lifetime.push({ year: y, earnings: currentSalary, isProjected: true });
            }
            currentSalary *= (1 + inflation);
            
            // Inflate our internal YMPE table for future years to keep math accurate
            if (!this.YMPE[y]) {
                lastYMPE *= (1 + inflation);
                this.YMPE[y] = lastYMPE;
            }
        }

        return lifetime.sort((a, b) => a.year - b.year);
    }

    /**
     * CORE MATH: Calculates the Base CPP amount using the 17% general drop-out
     */
    calculateBaseCPP(lifetimeRecords, birthYear, startPensionYear, childRearingYears = []) {
        const yearTurn18 = birthYear + 18;
        let monthsContributory = (startPensionYear - yearTurn18) * 12;
        
        // Calculate Unadjusted Pensionable Earnings (UPE) ratios
        let pensionableRatios = lifetimeRecords.map(r => {
            const ympe = this.YMPE[r.year];
            if (!ympe) return null;
            const cappedEarnings = Math.min(r.earnings, ympe);
            return {
                year: r.year,
                ratio: cappedEarnings / ympe,
                ympe: ympe,
                isChildRearing: childRearingYears.includes(r.year)
            };
        }).filter(r => r !== null && r.year >= yearTurn18 && r.year < startPensionYear);

        // 1. Child Rearing Drop-Out (CRDO)
        // Remove low earning years while caring for a child under 7
        let crdoDropped = 0;
        pensionableRatios = pensionableRatios.filter(r => {
            if (r.isChildRearing && r.ratio < 0.5) { // Simplification: Drop if ratio is bad
                crdoDropped++;
                monthsContributory -= 12;
                return false;
            }
            return true;
        });

        // 2. The 17% General Drop-Out
        // We drop the lowest 17% of the REMAINING contributory months
        const generalDropoutMonths = Math.floor(monthsContributory * 0.17);
        const generalDropoutYears = Math.floor(generalDropoutMonths / 12);
        
        // Sort by ratio to drop the lowest
        pensionableRatios.sort((a, b) => a.ratio - b.ratio);
        
        // Remove the lowest X years
        const finalRatios = pensionableRatios.slice(generalDropoutYears);
        
        // 3. Calculate Average Ratio
        const totalRatio = finalRatios.reduce((sum, r) => sum + r.ratio, 0);
        const averageRatio = totalRatio / finalRatios.length;

        // 4. Calculate Maximum Pension based on last 5 years average YMPE
        let last5YMPE = 0;
        for(let i = 1; i <= 5; i++) {
            last5YMPE += this.YMPE[startPensionYear - i] || this.YMPE[2026];
        }
        const avgYMPE = last5YMPE / 5;

        // Base CPP is 25% of the average YMPE adjusted by your personal earnings ratio
        const monthlyBaseCPP = (avgYMPE * 0.25 * averageRatio) / 12;

        return {
            monthlyBase: monthlyBaseCPP,
            monthsContributoryTotal: monthsContributory,
            droppedCRDOYears: crdoDropped,
            droppedGeneralYears: generalDropoutYears,
            averageRatio: averageRatio
        };
    }
}
