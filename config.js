/**
 * config.js
 * Contains all externalized financial constants, tax brackets, and historical data.
 * Update these values annually (e.g., CRA tax bracket adjustments, max CPP/OAS).
 */

const FINANCIAL_CONSTANTS = {
    // 2026 Maximums
    MAX_CPP: 18092, 
    MAX_OAS: 8908, 
    OAS_CLAWBACK_THRESHOLD: 90997, // 2026 Estimated threshold for OAS recovery tax
    
    // Core Rules
    RRIF_START_AGE: 72, 

    // FHSA Rules (First Home Savings Account)
    FHSA_ANNUAL_LIMIT: 8000,
    FHSA_LIFETIME_LIMIT: 40000,
    FHSA_MAX_YEARS: 15,

    // RESP Rules (Registered Education Savings Plan)
    RESP_LIFETIME_LIMIT: 50000,
    RESP_CESG_MATCH_RATE: 0.20, 
    RESP_CESG_ANNUAL_MAX: 500, 
    RESP_CESG_LIFETIME_MAX: 7200,

    // CCB Rules (Canada Child Benefit - Projected Base Numbers)
    CCB_RULES: {
        MAX_UNDER_6: 7787,     // Max annual benefit per child under 6
        MAX_6_TO_17: 6570,     // Max annual benefit per child 6 to 17
        THRESHOLD_1: 36502,    // First phase-out threshold (AFNI)
        THRESHOLD_2: 79087,    // Second phase-out threshold (AFNI)
        
        // Reduction rates based on number of children [1 child, 2 children, 3 children, 4+]
        RATE_1: [0.07, 0.135, 0.19, 0.23], // Rate applied to income between Threshold 1 & 2
        RATE_2: [0.032, 0.057, 0.08, 0.095] // Rate applied to income over Threshold 2
    },
    
    // Federal and Provincial Tax Brackets (2026 Estimates)
    TAX_DATA: {
        FED: { brackets: [55867, 111733, 173205, 246752], rates: [0.15, 0.205, 0.26, 0.29, 0.33] },
        BC: { brackets: [47937, 95875, 110076, 133664, 181232, 252752], rates: [0.0506, 0.077, 0.105, 0.1229, 0.147, 0.168, 0.205] },
        AB: { brackets: [148269, 177922, 237230, 355845], rates: [0.10, 0.12, 0.13, 0.14, 0.15] },
        SK: { brackets: [52057, 148734], rates: [0.105, 0.125, 0.145] },
        MB: { brackets: [47000, 100000], rates: [0.108, 0.1275, 0.174] },
        ON: { brackets: [51446, 102894, 150000, 220000], rates: [0.0505, 0.0915, 0.1116, 0.1216, 0.1316], surtax: { t1: 5315, r1: 0.20, t2: 6802, r2: 0.36 } },
        QC: { brackets: [51780, 103545, 126000], rates: [0.14, 0.19, 0.24, 0.2575], abatement: 0.165 },
        NB: { brackets: [49958, 99916, 185000], rates: [0.094, 0.14, 0.16, 0.195] },
        NS: { brackets: [29590, 59180, 93000, 150000], rates: [0.0879, 0.1495, 0.1667, 0.175, 0.21] },
        PE: { brackets: [32656, 64313, 105000], rates: [0.0965, 0.1363, 0.1667, 0.1875], surtax: { t1: 12500, r1: 0.10 } },
        NL: { brackets: [43198, 86395, 154244, 215943], rates: [0.087, 0.145, 0.158, 0.178, 0.198] },
        YT: { brackets: [55867, 111733, 173205, 500000], rates: [0.064, 0.09, 0.109, 0.128, 0.15] },
        NT: { brackets: [50597, 101198, 164525], rates: [0.059, 0.086, 0.122, 0.1405] },
        NU: { brackets: [50877, 101754, 165429], rates: [0.04, 0.07, 0.09, 0.115] }
    },

    // S&P 500 Annual Returns (1928 - 2023)
    SP500_HISTORICAL: [
        0.4381, -0.0830, -0.2512, -0.4384, -0.0864, 0.4998, -0.0119, 0.4674, 0.3194, -0.3534,
        0.2928, -0.0110, -0.1067, -0.1277, 0.1917, 0.2506, 0.1903, 0.3582, -0.0843, 0.0520,
        0.0570, 0.1830, 0.3081, 0.2368, 0.1815, -0.0121, 0.5230, 0.3260, 0.0630, -0.1046,
        0.4336, 0.1196, 0.0047, 0.2681, -0.0881, 0.2280, 0.1648, 0.1245, -0.1006, 0.2398,
        0.1106, -0.0850, 0.0401, 0.1431, 0.1898, -0.1466, -0.2647, 0.3720, 0.2384, -0.0718,
        0.0656, 0.1844, 0.3250, -0.0491, 0.2155, 0.2256, 0.0627, 0.3173, 0.1867, 0.0525,
        0.1661, 0.3169, -0.0310, 0.3047, 0.0762, 0.1008, 0.0132, 0.3758, 0.2296, 0.3336,
        0.2858, 0.2104, -0.0910, -0.1189, -0.2210, 0.2868, 0.1088, 0.0491, 0.1579, 0.0549,
        -0.3849, 0.2646, 0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183,
        -0.0438, 0.3149, 0.1840, 0.2871, -0.1811, 0.2423
    ]
};
