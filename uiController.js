/**
 * Retirement Planner Pro - UI Controller
 * Handles all DOM manipulation, charts, themes, and grid rendering.
 */

const POPOVER_DICTIONARY = {
    compensation: (base, match) => `<b>Base Salary:</b> $${base}<br><b>Employer RRSP Match:</b> $${match}`,
    rrspRefund: () => `Tax refund received this year resulting from your discretionary RRSP and/or FHSA contributions made last year. Automatically added to your available cash.`,
    oasClawback: (netInc, thresh, excess, repaymentText, maxInc) => `<b>Net Income:</b> $${netInc}<br><b>Threshold:</b> $${thresh}<br><b>Excess:</b> $${excess}<hr class='my-1'>${repaymentText}<br><span class='text-warning small' style='font-size:0.7rem;'>*Fully clawed back at $${maxInc}</span><br><span class='text-muted small' style='font-size:0.7rem;'>*Added to total taxes paid</span>`,
    minWithdrawalMath: (bal, factor, min, extraStr) => `<b>Jan 1st Balance:</b> $${bal}<br><b>Min Factor:</b> ${factor}%<br><b>Required Min:</b> $${min}${extraStr}`,
    capGains: (wd, acb, gain, tax) => `<b>Total Withdrawn:</b> $${wd}<br><b>Adjusted Cost Base (ACB):</b> -$${acb}<br><b>Capital Gain:</b> $${gain}<hr class='my-1'><b>Added to Taxable Income (50% Inclusion):</b> $${tax}`,
    taxBreakdown: (fed, prov, cpp, oasCb, taxInc, avg, marg, matchSavStr, discSavStr) => {
        let str = `<b>Federal Tax:</b> $${fed}<br><b>Provincial Tax:</b> $${prov}<br><b>CPP/EI:</b> $${cpp}`;
        if (oasCb) str += `<br><b>OAS Clawback:</b> $${oasCb}`;
        str += `<hr class='my-1'><b>Taxable Income:</b> $${taxInc}<br><b>Average Rate:</b> ${avg}%<br><b>Marginal Rate:</b> ${marg}%`;
        if (matchSavStr || discSavStr) {
            str += `<hr class='my-1'>`;
            if (matchSavStr) str += `<b>Payroll Tax Saved (RRSP Match):</b> <span class='text-success'>$${matchSavStr}</span><br>`;
            if (discSavStr) str += `<b>Est. Refund (Discretionary RRSP/FHSA):</b> <span class='text-success'>$${discSavStr}</span><br><span class='text-muted' style='font-size:0.7rem;'>*Refund will be added to next year's cash.</span>`;
        }
        return str;
    },
    spousalRollover: (p1ToP2) => `<div style='max-width: 250px; white-space: normal; line-height: 1.4;'>Person ${p1ToP2 ? '1' : '2'} passed away this year. Under CRA rules, their registered accounts (RRSP/RRIF, TFSA, FHSA) and non-registered investments are transferred directly to Person ${p1ToP2 ? '2' : '1'} <b>tax-free</b>. No deemed disposition tax is triggered on these assets at this time.</div>`,
    rrspContrib: (room, match, pers, total) => {
         let str = `<b>Max CRA Deposit:</b> $${room}<hr class='my-1'>`;
         if (total !== '0') {
             if (match !== '0') str += `<b>Employer Match:</b> $${match}<br>`;
             str += `<b>Personal Contrib:</b> $${pers}<br><b>Total Deposited:</b> <span class='text-success'>$${total}</span>`;
         } else {
             str += `<i>No deposits this year.</i>`;
         }
         return str;
    }
};

class UIController {
    constructor(app) {
        this.app = app;
        
        this.iconDefs = {
            "P1 Retires": { icon: 'bi-cup-hot-fill', color: 'text-warning', title: "Person 1 Retires" }, 
            "P2 Retires": { icon: 'bi-cup-hot', color: 'text-purple', title: "Person 2 Retires" },
            "Mortgage Paid": { icon: 'bi-house-check-fill', color: 'text-success', title: "Mortgage Paid" }, 
            "Crash": { icon: 'bi-graph-down-arrow', color: 'text-danger', title: "Stress Test: Market Crash (-15%)" },
            "P1 CPP": { icon: 'bi-file-earmark-text-fill', color: 'text-info', title: "Person 1 Starts CPP" }, 
            "P1 OAS": { icon: 'bi-cash-stack', color: 'text-info', title: "Person 1 Starts OAS" },
            "P2 CPP": { icon: 'bi-file-earmark-text', color: 'text-purple', title: "Person 2 Starts CPP" }, 
            "P2 OAS": { icon: 'bi-cash', color: 'text-purple', title: "Person 2 Starts OAS" },
            "P1 Dies": { icon: 'bi-heartbreak-fill', color: 'text-white', title: "Person 1 Deceased" }, 
            "P2 Dies": { icon: 'bi-heartbreak', color: 'text-white', title: "Person 2 Deceased" },
            "Windfall": { icon: 'bi-gift-fill', color: 'text-success', title: "Inheritance/Bonus Received" },
            "Downsize": { icon: 'bi-box-seam-fill', color: 'text-primary', title: "Real Estate Downsizing" },
            "P1 Leave": { icon: 'bi-pause-circle-fill', color: 'text-warning', title: "Person 1 Leave of Absence" },
            "P2 Leave": { icon: 'bi-pause-circle-fill', color: 'text-purple', title: "Person 2 Leave of Absence" },
            "FHSA Expired": { icon: 'bi-hourglass-bottom', color: 'text-secondary', title: "FHSA Expiry Reached (Rolled to RRSP/RRIF)" }
        };
    }

    initPopovers() {
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"], .info-btn');
        [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, { trigger: 'focus', html: true }));
    }

    initTheme() {
        const savedTheme = localStorage.getItem(this.app.THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        this.updateThemeIcon(savedTheme); 
    }

    toggleTheme() {
        const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        localStorage.setItem(this.app.THEME_KEY, next);
        this.updateThemeIcon(next); 
        this.app.data.renderExpenseRows(); 
        this.app.run(); 
    }

    updateThemeIcon(theme) {
        const btn = document.getElementById('btnThemeToggle');
        if (!btn) return;
        btn.innerHTML = theme === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
        btn.className = theme === 'dark' ? 'btn btn-outline-secondary d-flex align-items-center justify-content-center' : 'btn btn-outline-dark d-flex align-items-center justify-content-center text-dark';
    }

    populateAgeSelects() {
        document.querySelectorAll('.cpp-age-select').forEach(s => { let h=''; for(let i=60;i<=70;i++) h+=`<option value="${i}" ${i===65?'selected':''}>${i}</option>`; s.innerHTML=h; });
        document.querySelectorAll('.oas-age-select').forEach(s => { let h=''; for(let i=65;i<=70;i++) h+=`<option value="${i}" ${i===65?'selected':''}>${i}</option>`; s.innerHTML=h; });
    }

    initSidebar() {
        const b = (sId, iId, lId, sfx='') => { 
            const s=document.getElementById(sId); 
            if(s) { 
                s.value = this.app.getRaw(iId) || s.value; 
                if(document.getElementById(lId)) document.getElementById(lId).innerText=s.value+sfx; 
                s.addEventListener('input', e => { 
                    const i=document.getElementById(iId); 
                    if(i){ 
                        i.value=e.target.value; 
                        this.app.state.inputs[iId]=e.target.value; 
                        if(lId) document.getElementById(lId).innerText=e.target.value+sfx; 
                        this.app.debouncedRun(); 
                    } 
                }); 
            } 
        };
        b('qa_p1_retireAge_range', 'p1_retireAge', 'qa_p1_retireAge_val'); 
        b('qa_p2_retireAge_range', 'p2_retireAge', 'qa_p2_retireAge_val'); 
        b('qa_inflation_range', 'inflation_rate', 'qa_inflation_val', '%'); 
        b('qa_return_range', 'p1_tfsa_ret', 'qa_return_val', '%');
    }

    updateSidebarSync(id, val) {
        const syncMap = { 
            'p1_retireAge': ['qa_p1_retireAge_range', 'qa_p1_retireAge_val', ''], 
            'p2_retireAge': ['qa_p2_retireAge_range', 'qa_p2_retireAge_val', ''], 
            'inflation_rate': ['qa_inflation_range', 'qa_inflation_val', '%'], 
            'p1_tfsa_ret': ['qa_return_range', 'qa_return_val', '%'] 
        };
        if (syncMap[id]) {
            const [sliderId, labelId, suffix] = syncMap[id];
            if(document.getElementById(sliderId)) document.getElementById(sliderId).value = val;
            if(document.getElementById(labelId)) document.getElementById(labelId).innerText = val + suffix;
        }
    }

    toggleModeDisplay() {
        const c = this.app.state.mode === 'Couple'; 
        document.body.classList.toggle('is-couple', c);
        document.querySelectorAll('.p2-column').forEach(el => { if(!['TH','TD'].includes(el.tagName)) el.style.display = c ? '' : 'none'; });
        if(this.app.charts.nw) this.app.charts.nw.resize();
        if(this.app.charts.donut) this.app.charts.donut.resize();
        if(this.app.charts.comp) this.app.charts.comp.resize();
    }

    updateScenarioBadge(name) {
        const badge = document.getElementById('currentScenarioBadge');
        const nameEl = document.getElementById('currentScenarioName');
        if(badge && nameEl) {
            if(name) {
                nameEl.innerText = name;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
                nameEl.innerText = '';
            }
        }
    }

    updateBenefitVisibility() {
        const toggles = ['p1_cpp', 'p1_oas', 'p1_db', 'p2_cpp', 'p2_oas', 'p2_db'];
        toggles.forEach(prefix => {
            const chk = document.getElementById(`${prefix}_enabled`);
            const container = document.getElementById(`${prefix}_inputs`);
            if(chk && container) {
                container.style.display = chk.checked ? 'block' : 'none';
            }
        });
    }

    updateAgeDisplay(pfx) {
        const dI = this.app.getRaw(`${pfx}_dob`), el = document.getElementById(`${pfx}_age`);
        if(!dI){ el.innerHTML="--"; return; }
        
        const age = Math.abs(new Date(Date.now() - new Date(dI+"-01").getTime()).getUTCFullYear() - 1970);
        if (isNaN(age)) return;
        el.innerHTML = age + " years old";

        const slider = document.getElementById(`qa_${pfx}_retireAge_range`);
        if (slider) {
            slider.min = age;
            if (parseInt(slider.value) < age) {
                slider.value = age;
                this.app.state.inputs[`${pfx}_retireAge`] = age;
                const label = document.getElementById(`qa_${pfx}_retireAge_val`);
                if(label) label.innerText = age;
                this.app.debouncedRun();
            }
        }
    }

    toggleRow(el) { 
        el.parentElement.classList.toggle('expanded'); 
        el.parentElement.querySelector('.grid-detail-wrapper').classList.toggle('open'); 
    }

    toggleGroup(t) { 
        const b = document.querySelector(`span[data-type="${t}"]`); 
        document.body.classList.toggle(`show-${t}`); 
        b.innerText = document.body.classList.contains(`show-${t}`) ? '[-]' : '[+]'; 
    }

    renderTaxDetails(pfx, g, d, empRrsp = 0) {
        const c = document.getElementById(`${pfx}_tax_details`); 
        if(!c) return;
        
        let h = '';
        if (g > 0) {
            h += `<div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Federal</span> <span>($${Math.round(d.fed).toLocaleString()}) ${((d.fed/g)*100).toFixed(1)}%</span></div>`;
            h += `<div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Provincial</span> <span>($${Math.round(d.prov).toLocaleString()}) ${((d.prov/g)*100).toFixed(1)}%</span></div>`;
            h += `<div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">CPP/EI</span> <span>($${Math.round(d.cpp_ei).toLocaleString()})</span></div>`;
            
            if (empRrsp > 0) {
                h += `<div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-info fw-bold">Employee RRSP Contrib.</span> <span class="text-info fw-bold">($${Math.round(empRrsp).toLocaleString()})</span></div>`;
            }
            
            h += `<div class="d-flex justify-content-between mt-2"><span class="text-warning fw-bold">Total Tax</span> <span class="text-warning fw-bold">($${Math.round(d.totalTax).toLocaleString()})</span></div>`;
            h += `<div class="d-flex justify-content-between"><span class="text-muted">Marginal Rate</span> <span>${(d.margRate*100).toFixed(2)}%</span></div>`;
            h += `<div class="d-flex justify-content-between mt-2 pt-2 border-top border-secondary"><span class="text-success fw-bold">After-Tax Net</span> <span class="text-success fw-bold">$${Math.round(g - d.totalTax - empRrsp).toLocaleString()}</span></div>`;
        } else {
            h = `<span class="text-muted text-center d-block small">No Income Entered</span>`;
        }
        c.innerHTML = h;
    }

    getIconHTML(k, th) {
        const d = this.iconDefs[k]; if(!d) return ''; let c = d.color;
        if(th==='light'){ if(c.includes('text-white')||c.includes('text-warning')) c='text-dark'; if(c.includes('text-info')) c='text-primary'; }
        return `<i class="bi ${d.icon} ${c}" title="${d.title}"></i>`;
    }

    buildPopoverIcon(title, content, colorClass = "text-muted", size = "0.75rem") {
        const safeContent = content.replace(/"/g, '&quot;');
        return ` <i class="bi bi-info-circle ${colorClass} ms-1 info-btn" style="font-size: ${size}; cursor: help;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-html="true" data-bs-custom-class="projection-popover" data-bs-title="${title}" data-bs-content="${safeContent}"></i>`;
    }

    renderProjectionGrid() {
        const th = document.documentElement.getAttribute('data-bs-theme')||'dark';
        const hC = th==='light'?'bg-white text-dark border-bottom border-dark-subtle':'bg-transparent text-white border-secondary';
        const tT = th==='light'?'text-dark':'text-white';
        let html = `<div class="grid-header ${hC}"><div class="col-start col-timeline ${tT}">Timeline</div><div class="col-start">Status</div><div class="text-body ${tT}">Cash Inflow</div><div class="text-danger">Expenses</div><div class="${tT}">Surplus</div><div class="${tT}">Net Worth</div><div class="text-center ${tT}"><i class="bi bi-chevron-bar-down"></i></div></div>`;
        
        this.app.state.projectionData.forEach((d) => {
            const df = this.app.getDiscountFactor(d.year - new Date().getFullYear());
            const fmtK = n => { 
                if(n == null || isNaN(n)) return ''; 
                const v = n / df; 
                const a = Math.abs(v); 
                if(Math.round(a) === 0) return ''; 
                const s = v < 0 ? '-' : ''; 
                return a >= 1000000 ? s + (a/1000000).toFixed(1) + 'M' : (a >= 1000 ? s + Math.round(a/1000) + 'k' : s + Math.round(a)); 
            };
            const fmtStr = n => Math.round(n / df).toLocaleString();

            const fmtFlow = (c, w) => {
                if(c > 0) return ` <span class="text-success small fw-bold">(+${fmtK(c)})</span>`;
                if(w > 0) return ` <span class="text-danger small fw-bold">(-${fmtK(w)})</span>`;
                return '';
            };
            
            const p1A = d.p1Alive ? d.p1Age : '†';
            const p2A = this.app.state.mode === 'Couple' ? (d.p2Alive ? d.p2Age : '†') : '';
            
            const p1R = this.app.getVal('p1_retireAge') <= d.p1Age, p2R = this.app.getVal('p2_retireAge') <= (d.p2Age||0);
            const gLim = parseInt(this.app.getRaw('exp_gogo_age'))||75, sLim = parseInt(this.app.getRaw('exp_slow_age'))||85;
            
            let stat = `<span class="status-pill status-working">Working</span>`;
            if(this.app.state.mode==='Couple') { if(p1R&&p2R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`; else if(p1R||p2R) stat = `<span class="status-pill status-semi">Transition</span>`; }
            else if(p1R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`;
            
            const ln = (l,v,c='') => (!v||Math.round(v)===0)?'':`<div class="detail-item"><span>${l}</span> <span class="${c}">${fmtK(v)}</span></div>`;
            const sL = (l,v,c='') => (!v||Math.round(v)===0)?'':`<div class="detail-item sub"><span>${l}</span> <span class="${c}">${fmtK(v)}</span></div>`;
            
            let groupP1 = '', groupP2 = '', groupOther = '';
            
            // --- P1 Income Builders ---
            if(d.incomeP1 > 0) {
                let baseOnly = d.incomeP1 - (d.eiMatP1 || 0) - (d.topUpP1 || 0);
                let empLabel = "Employment";
                if (d.rrspMatchP1 > 0) {
                    let content = POPOVER_DICTIONARY.compensation(fmtStr(baseOnly - d.rrspMatchP1), fmtStr(d.rrspMatchP1));
                    empLabel += this.buildPopoverIcon("Compensation Breakdown", content);
                }
                if (baseOnly > 0) groupP1 += ln(empLabel, baseOnly);
            }
            if(d.eiMatP1 > 0) groupP1 += sL("EI Leave Benefit", d.eiMatP1, "text-warning");
            if(d.topUpP1 > 0) groupP1 += sL("Employer Top-Up", d.topUpP1, "text-success");

            if(d.rrspRefundP1 > 0) {
                let rfInfo = this.buildPopoverIcon("Tax Refund", POPOVER_DICTIONARY.rrspRefund());
                groupP1 += sL(`Tax Refund (RRSP/FHSA)${rfInfo}`, d.rrspRefundP1, "text-success fw-bold");
            }
            if(d.postRetP1 > 0) groupP1 += sL("Post-Ret Work", d.postRetP1);
            if(d.ccbP1 > 0) groupP1 += sL("Canada Child Benefit (CCB)", d.ccbP1);
            if(d.cppP1 > 0) groupP1 += sL("CPP", d.cppP1);
            
            if(d.oasP1 > 0) {
                let label = "OAS";
                let excess = Math.max(0, (d.taxIncP1 || 0) - (d.oasThreshold || 0));
                let maxIncome = (d.oasThreshold || 0) + (d.oasP1 / 0.15);
                let repaymentText = (d.oasClawbackP1 >= d.oasP1 - 0.01) ? `<b>Repayment (100% Clawed Back):</b> $${fmtStr(d.oasClawbackP1)}` : `<b>Repayment (15% of excess):</b> $${fmtStr(d.oasClawbackP1)}`;
                if (d.oasClawbackP1 === 0) repaymentText = `<b>Repayment:</b> $0 (Under Threshold)`;
                
                let content = POPOVER_DICTIONARY.oasClawback(fmtStr(d.taxIncP1 || 0), fmtStr(d.oasThreshold || 0), fmtStr(excess), repaymentText, fmtStr(maxIncome));
                label += this.buildPopoverIcon("OAS Clawback Math", content);
                
                groupP1 += sL(label, d.oasP1);
            }
            
            if(d.dbP1 > 0) groupP1 += sL("DB Pension", d.dbP1);
            if(d.invIncP1 > 0) groupP1 += ln("Inv. Yield (Taxable)", d.invIncP1, "text-muted");
            
            // P1 Withdrawal Builders
            Object.entries(d.wdBreakdown.p1).forEach(([t,a]) => {
                if(t.endsWith('_math')) return; 
                let label = `${t} Withdrawals`;
                if(t === 'RRIF' && d.wdBreakdown.p1.RRIF_math) {
                    let m = d.wdBreakdown.p1.RRIF_math;
                    let extraWd = Math.max(0, a - m.min);
                    let extraStr = extraWd > 5 ? `<hr class='my-1'><b>Extra (Deficit) Wd:</b> $${fmtStr(extraWd)}` : '';
                    let content = POPOVER_DICTIONARY.minWithdrawalMath(fmtStr(m.bal), (m.factor*100).toFixed(2), fmtStr(m.min), extraStr);
                    label += this.buildPopoverIcon("RRIF Withdrawal Math", content);
                } else if(t === 'LIF' && d.wdBreakdown.p1.LIF_math) {
                    let m = d.wdBreakdown.p1.LIF_math;
                    let extraWd = Math.max(0, a - m.lifMin);
                    let extraStr = extraWd > 5 ? `<hr class='my-1'><b>Extra (Deficit) Wd:</b> $${fmtStr(extraWd)}` : '';
                    let content = POPOVER_DICTIONARY.minWithdrawalMath(fmtStr(m.lifBal), (m.factor*100).toFixed(2), fmtStr(m.lifMin), extraStr);
                    label += this.buildPopoverIcon("LIF Withdrawal Math", content);
                } else if ((t === 'Non-Reg' || t === 'Crypto') && d.wdBreakdown.p1[t + '_math']) {
                    let m = d.wdBreakdown.p1[t + '_math'];
                    let content = POPOVER_DICTIONARY.capGains(fmtStr(m.wd), fmtStr(m.acb), fmtStr(m.gain), fmtStr(m.tax));
                    label += this.buildPopoverIcon("Capital Gains Math", content);
                }
                groupP1 += sL(label, a);
            });

            // --- P2 Income Builders ---
            if(this.app.state.mode==='Couple') {
                if(d.incomeP2 > 0) {
                    let baseOnly = d.incomeP2 - (d.eiMatP2 || 0) - (d.topUpP2 || 0);
                    let empLabel = "Employment";
                    if (d.rrspMatchP2 > 0) {
                        let content = POPOVER_DICTIONARY.compensation(fmtStr(baseOnly - d.rrspMatchP2), fmtStr(d.rrspMatchP2));
                        empLabel += this.buildPopoverIcon("Compensation Breakdown", content);
                    }
                    if (baseOnly > 0) groupP2 += ln(empLabel, baseOnly);
                }
                if(d.eiMatP2 > 0) groupP2 += sL("EI Leave Benefit", d.eiMatP2, "text-warning");
                if(d.topUpP2 > 0) groupP2 += sL("Employer Top-Up", d.topUpP2, "text-success");

                if(d.rrspRefundP2 > 0) {
                    let rfInfo = this.buildPopoverIcon("Tax Refund", POPOVER_DICTIONARY.rrspRefund());
                    groupP2 += sL(`Tax Refund (RRSP/FHSA)${rfInfo}`, d.rrspRefundP2, "text-success fw-bold");
                }
                if(d.postRetP2 > 0) groupP2 += sL("Post-Ret Work", d.postRetP2);
                if(d.cppP2 > 0) groupP2 += sL("CPP", d.cppP2);
                
                if(d.oasP2 > 0) {
                    let label = "OAS";
                    let excess = Math.max(0, (d.taxIncP2 || 0) - (d.oasThreshold || 0));
                    let maxIncome = (d.oasThreshold || 0) + (d.oasP2 / 0.15);
                    let repaymentText = (d.oasClawbackP2 >= d.oasP2 - 0.01) ? `<b>Repayment (100% Clawed Back):</b> $${fmtStr(d.oasClawbackP2)}` : `<b>Repayment (15% of excess):</b> $${fmtStr(d.oasClawbackP2)}`;
                    if (d.oasClawbackP2 === 0) repaymentText = `<b>Repayment:</b> $0 (Under Threshold)`;
                    
                    let content = POPOVER_DICTIONARY.oasClawback(fmtStr(d.taxIncP2 || 0), fmtStr(d.oasThreshold || 0), fmtStr(excess), repaymentText, fmtStr(maxIncome));
                    label += this.buildPopoverIcon("OAS Clawback Math", content);
                    
                    groupP2 += sL(label, d.oasP2);
                }
                
                if(d.dbP2 > 0) groupP2 += sL("DB Pension", d.dbP2);
                if(d.invIncP2 > 0) groupP2 += ln("Inv. Yield (Taxable)", d.invIncP2, "text-muted");
                
                // P2 Withdrawal Builders
                Object.entries(d.wdBreakdown.p2).forEach(([t,a]) => {
                    if(t.endsWith('_math')) return; 
                    let label = `${t} Withdrawals`;
                    if(t === 'RRIF' && d.wdBreakdown.p2.RRIF_math) {
                        let m = d.wdBreakdown.p2.RRIF_math;
                        let extraWd = Math.max(0, a - m.min);
                        let extraStr = extraWd > 5 ? `<hr class='my-1'><b>Extra (Deficit) Wd:</b> $${fmtStr(extraWd)}` : '';
                        let content = POPOVER_DICTIONARY.minWithdrawalMath(fmtStr(m.bal), (m.factor*100).toFixed(2), fmtStr(m.min), extraStr);
                        label += this.buildPopoverIcon("RRIF Withdrawal Math", content);
                    } else if(t === 'LIF' && d.wdBreakdown.p2.LIF_math) {
                        let m = d.wdBreakdown.p2.LIF_math;
                        let extraWd = Math.max(0, a - m.lifMin);
                        let extraStr = extraWd > 5 ? `<hr class='my-1'><b>Extra (Deficit) Wd:</b> $${fmtStr(extraWd)}` : '';
                        let content = POPOVER_DICTIONARY.minWithdrawalMath(fmtStr(m.lifBal), (m.factor*100).toFixed(2), fmtStr(m.lifMin), extraStr);
                        label += this.buildPopoverIcon("LIF Withdrawal Math", content);
                    } else if ((t === 'Non-Reg' || t === 'Crypto') && d.wdBreakdown.p2[t + '_math']) {
                        let m = d.wdBreakdown.p2[t + '_math'];
                        let content = POPOVER_DICTIONARY.capGains(fmtStr(m.wd), fmtStr(m.acb), fmtStr(m.gain), fmtStr(m.tax));
                        label += this.buildPopoverIcon("Capital Gains Math", content);
                    }
                    groupP2 += sL(label, a);
                });
            }

            if(d.windfall > 0) groupOther += ln("Inheritance/Bonus", d.windfall, "text-success fw-bold");

            let iL = '';
            if(groupP1) iL += `<div class="mb-2"><span class="text-info fw-bold small text-uppercase" style="font-size:0.7rem; border-bottom:1px solid #334155; display:block; margin-bottom:4px;">Person 1</span>${groupP1}</div>`;
            if(groupP2) iL += `<div class="mb-2"><span class="text-purple fw-bold small text-uppercase" style="font-size:0.7rem; border-bottom:1px solid #334155; display:block; margin-bottom:4px;">Person 2</span>${groupP2}</div>`;
            if(groupOther) iL += `<div>${groupOther}</div>`;
            
            const buildTaxInfo = (tDetails, pName, taxIncObjStr, matchSav, discSav) => {
                if (!tDetails || tDetails.totalTax <= 0) return `Tax Paid ${pName}`;
                
                let taxInc = d[taxIncObjStr] || 1;
                let avgRate = ((tDetails.totalTax / taxInc) * 100).toFixed(1);
                let margRate = ((tDetails.margRate || 0) * 100).toFixed(1);
                
                let mSavStr = matchSav > 0 ? fmtStr(matchSav) : null;
                let dSavStr = discSav > 0 ? fmtStr(discSav) : null;
                
                let content = POPOVER_DICTIONARY.taxBreakdown(
                    fmtStr(tDetails.fed), fmtStr(tDetails.prov), fmtStr(tDetails.cpp_ei),
                    tDetails.oas_clawback > 0 ? fmtStr(tDetails.oas_clawback) : null,
                    fmtStr(taxInc), avgRate, margRate, mSavStr, dSavStr
                );

                return `Tax Paid ${pName}` + this.buildPopoverIcon(`${pName} Tax Breakdown`, content);
            };

            let p1TaxLabel = buildTaxInfo(d.taxDetailsP1, 'P1', 'taxIncP1', d.matchTaxSavingsP1, d.discTaxSavingsP1);
            let p2TaxLabel = this.app.state.mode === 'Couple' ? buildTaxInfo(d.taxDetailsP2, 'P2', 'taxIncP2', d.matchTaxSavingsP2, d.discTaxSavingsP2) : '';

            let eL = ln("Living Exp",d.expenses) + ln("Mortgage",d.mortgagePay) + ln("Debt Repayment",d.debtRepayment);
            
            eL += ln(p1TaxLabel, d.taxP1, "val-negative");
            if (this.app.state.mode === 'Couple') {
                eL += ln(p2TaxLabel, d.taxP2, "val-negative");
            }
            
            let aL = '';
            let assetTitle = 'Assets (End of Year)';
            
            if (this.app.state.mode === 'Couple') {
                if (d.events.includes('P1 Dies') && d.p2Alive) {
                    assetTitle += this.buildPopoverIcon("Spousal Rollover (P1 &rarr; P2)", POPOVER_DICTIONARY.spousalRollover(true), "text-warning", "0.85rem");
                }
                if (d.events.includes('P2 Dies') && d.p1Alive) {
                    assetTitle += this.buildPopoverIcon("Spousal Rollover (P2 &rarr; P1)", POPOVER_DICTIONARY.spousalRollover(false), "text-purple", "0.85rem");
                }
            }
            
            aL += ln(`TFSA P1${fmtFlow(d.flows.contributions.p1.tfsa, d.wdBreakdown.p1['TFSA'])}`, d.assetsP1.tfsa) + (this.app.state.mode==='Couple'?ln(`TFSA P2${fmtFlow(d.flows.contributions.p2.tfsa, d.wdBreakdown.p2['TFSA'])}`, d.assetsP2.tfsa):'');
            aL += ln(`TFSA (Successor) P1${fmtFlow(0, d.wdBreakdown.p1['TFSA (Successor)'])}`, d.assetsP1.tfsa_successor) + (this.app.state.mode==='Couple'?ln(`TFSA (Successor) P2${fmtFlow(0, d.wdBreakdown.p2['TFSA (Successor)'])}`, d.assetsP2.tfsa_successor):'');
            
            aL += ln(`FHSA P1${fmtFlow(d.flows.contributions.p1.fhsa, d.wdBreakdown.p1['FHSA'])}`, d.assetsP1.fhsa) + (this.app.state.mode==='Couple'?ln(`FHSA P2${fmtFlow(d.flows.contributions.p2.fhsa, d.wdBreakdown.p2['FHSA'])}`, d.assetsP2.fhsa):'');

            let r1Label = d.p1Age >= 72 ? 'RRIF' : 'RRSP';
            let r1Wd = (d.wdBreakdown.p1['RRSP']||0) + (d.wdBreakdown.p1['RRIF']||0);
            let r1Info = '';
            if (d.p1Age < 72) {
                let totalDep1 = d.flows.contributions.p1.rrsp || 0;
                let empMatch1 = d.rrspMatchP1 || 0;
                let persDep1 = Math.max(0, totalDep1 - empMatch1);
                let content = POPOVER_DICTIONARY.rrspContrib(fmtStr(d.rrspRoomP1 || 0), fmtStr(empMatch1), fmtStr(persDep1), fmtStr(totalDep1));
                r1Info = this.buildPopoverIcon("Contribution Breakdown", content);
            }
            aL += ln(`${r1Label} P1${r1Info}${fmtFlow(d.flows.contributions.p1.rrsp, r1Wd)}`, d.assetsP1.rrsp);
            
            if(this.app.state.mode === 'Couple') {
                let r2Label = d.p2Age >= 72 ? 'RRIF' : 'RRSP';
                let r2Wd = (d.wdBreakdown.p2['RRSP']||0) + (d.wdBreakdown.p2['RRIF']||0);
                let r2Info = '';
                if (d.p2Age < 72) {
                    let totalDep2 = d.flows.contributions.p2.rrsp || 0;
                    let empMatch2 = d.rrspMatchP2 || 0;
                    let persDep2 = Math.max(0, totalDep2 - empMatch2);
                    let content = POPOVER_DICTIONARY.rrspContrib(fmtStr(d.rrspRoomP2 || 0), fmtStr(empMatch2), fmtStr(persDep2), fmtStr(totalDep2));
                    r2Info = this.buildPopoverIcon("Contribution Breakdown", content);
                }
                aL += ln(`${r2Label} P2${r2Info}${fmtFlow(d.flows.contributions.p2.rrsp, r2Wd)}`, d.assetsP2.rrsp);
            }

            aL += ln("LIRF P1",d.assetsP1.lirf) + (this.app.state.mode==='Couple'?ln("LIRF P2",d.assetsP2.lirf):'');
            aL += ln(`LIF P1${fmtFlow(0, d.wdBreakdown.p1['LIF'])}`,d.assetsP1.lif) + (this.app.state.mode==='Couple'?ln(`LIF P2${fmtFlow(0, d.wdBreakdown.p2['LIF'])}`,d.assetsP2.lif):'');
            aL += ln("Manual RRIF P1",d.assetsP1.rrif_acct) + (this.app.state.mode==='Couple'?ln("Manual RRIF P2",d.assetsP2.rrif_acct):'');
            aL += ln(`Non-Reg P1${fmtFlow(d.flows.contributions.p1.nreg, d.wdBreakdown.p1['Non-Reg'])}`, d.assetsP1.nreg) + (this.app.state.mode==='Couple'?ln(`Non-Reg P2${fmtFlow(d.flows.contributions.p2.nreg, d.wdBreakdown.p2['Non-Reg'])}`, d.assetsP2.nreg):'');
            aL += ln(`Cash P1${fmtFlow(d.flows.contributions.p1.cash, d.wdBreakdown.p1['Cash'])}`, d.assetsP1.cash) + (this.app.state.mode==='Couple'?ln(`Cash P2${fmtFlow(d.flows.contributions.p2.cash, d.wdBreakdown.p2['Cash'])}`, d.assetsP2.cash):'');
            aL += ln(`Crypto P1${fmtFlow(d.flows.contributions.p1.crypto, d.wdBreakdown.p1['Crypto'])}`, d.assetsP1.crypto) + (this.app.state.mode==='Couple'?ln(`Crypto P2${fmtFlow(d.flows.contributions.p2.crypto, d.wdBreakdown.p2['Crypto'])}`, d.assetsP2.crypto):'');
            
            if (d.debtRemaining > 0) {
                aL += ln("Other Liabilities", -d.debtRemaining, "text-danger");
            }
            
            aL += ln("Liquid Net Worth",d.liquidNW,"text-info fw-bold")+ln("Total Real Estate Eq.",d.homeValue-d.mortgage);
            
            aL += `<div style="border-top: 1px dashed #555; margin: 6px 0 4px 0;"></div>`;
            aL += ln(`RESP (Excluded from NW)${fmtFlow(d.flows.contributions.p1.resp, d.wdBreakdown.p1['RESP'])}`, d.assetsP1.resp, "text-muted");

            const rB = th==='light'?'bg-white border-bottom border-dark-subtle':'', rT = th==='light'?'text-dark':'text-white';
            html += `<div class="grid-row-group" style="${th==='light'?'border-bottom:1px solid #ddd;':''}"><div class="grid-summary-row ${rB}" onclick="app.ui.toggleRow(this)"><div class="col-start col-timeline"><div class="d-flex align-items-center"><span class="fw-bold fs-6 me-1 ${rT}">${d.year}</span><span class="event-icons-inline">${d.events.map(k=>this.getIconHTML(k,th)).join('')}</span></div><span class="age-text ${rT}">${p1A} ${this.app.state.mode==='Couple'?'/ '+p2A:''}</span></div><div class="col-start">${stat}</div><div class="val-positive">${fmtK(d.grossInflow)}</div><div class="val-neutral text-danger">${fmtK(d.visualExpenses)}</div><div class="${d.surplus<0?'val-negative':'val-positive'}">${d.surplus>0?'+':''}${fmtK(d.surplus)}</div><div class="fw-bold ${rT}">${fmtK(d.debugNW)}</div><div class="text-center toggle-icon ${rT}"><i class="bi bi-chevron-down"></i></div></div><div class="grid-detail-wrapper"><div class="detail-container"><div class="detail-box surface-card"><div class="detail-title">Income Sources</div>${iL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Gross Inflow</span> <span class="text-success fw-bold">${fmtK(d.grossInflow)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">Outflows & Taxes</div>${eL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Out</span> <span class="text-danger fw-bold">${fmtK(d.visualExpenses)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">${assetTitle}</div>${aL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total NW</span> <span class="text-info fw-bold">${fmtK(d.debugNW)}</span></div></div></div></div></div>`;
        });
        const grid = document.getElementById('projectionGrid'); if(grid) grid.innerHTML = html;
        
        this.renderDashboard();
        try { this.initPopovers(); } catch(e) {}
    }

    renderDashboard() {
        if (!this.app.state.projectionData || !this.app.state.projectionData.length) return;
        
        let totalTax = 0, totalInflow = 0, totalExp = 0, totalDebt = 0;
        let peakNW = -Infinity, peakAge = 0;
        let debtFreeYear = "--";
        let isBankrupt = false;
        let bankruptAge = null;
        let hasDebtAtStart = false;

        let totalBenefits = 0;
        let totalExternalInflow = 0;
        let retExpSum = 0;
        let retYears = 0;
        let retDayNW = 0;
        let retDayAge = 0;
        let foundRetDay = false;

        let getLiquidAssets = (d) => {
            let a1 = d.assetsP1, a2 = d.assetsP2 || {};
            return (a1.tfsa||0) + (a1.tfsa_successor||0) + (a1.fhsa||0) + (a1.rrsp||0) + (a1.rrif_acct||0) + (a1.lif||0) + (a1.lirf||0) + (a1.nreg||0) + (a1.cash||0) + (a1.crypto||0) +
                   (a2.tfsa||0) + (a2.tfsa_successor||0) + (a2.fhsa||0) + (a2.rrsp||0) + (a2.rrif_acct||0) + (a2.lif||0) + (a2.lirf||0) + (a2.nreg||0) + (a2.cash||0) + (a2.crypto||0);
        };

        const initialDf = this.app.getDiscountFactor(0);
        const initialLiquid = getLiquidAssets(this.app.state.projectionData[0]) / initialDf;
        const initialHome = this.app.state.projectionData[0].homeValue / initialDf;

        let compLabels = [];
        let compTaxFree = [];
        let compReg = [];
        let compTaxable = [];
        let compCrypto = [];
        let compRE = [];

        this.app.state.projectionData.forEach((d, i) => {
            const df = this.app.getDiscountFactor(d.year - new Date().getFullYear());
            const tax = d.taxP1 + (d.taxP2 || 0);
            const debt = d.mortgagePay + d.debtRepayment;
            
            totalTax += tax / df;
            totalInflow += d.grossInflow / df;
            totalExp += d.expenses / df; 
            totalDebt += debt / df;

            const benefits = d.benefitsP1 + (d.benefitsP2 || 0) + (d.ccbP1 || 0);
            totalBenefits += benefits / df;

            const externalInflow = d.incomeP1 + (d.incomeP2 || 0) + (d.postRetP1 || 0) + (d.postRetP2 || 0) + benefits + d.dbP1 + (d.dbP2 || 0) + d.windfall;
            totalExternalInflow += externalInflow / df;

            const isP1Ret = d.p1Age >= this.app.getVal('p1_retireAge');
            const isP2Ret = this.app.state.mode === 'Couple' ? (d.p2Age >= this.app.getVal('p2_retireAge')) : true;
            
            if (isP1Ret && !foundRetDay) {
                retDayNW = d.debugNW / df;
                retDayAge = d.p1Age;
                foundRetDay = true;
            }

            if (isP1Ret && isP2Ret) {
                retExpSum += d.expenses / df;
                retYears++;
            }

            const adjNW = d.debugNW / df;
            if (adjNW > peakNW) {
                peakNW = adjNW;
                peakAge = d.p1Age;
            }
            
            if (i === 0 && (d.mortgage > 0 || d.debtRemaining > 0)) hasDebtAtStart = true;
            if (hasDebtAtStart && debtFreeYear === "--" && d.mortgage <= 0 && d.debtRemaining <= 0) {
                debtFreeYear = d.year;
            }

            if (d.surplus < -10 && d.liquidNW <= 10 && !isBankrupt) {
                isBankrupt = true;
                bankruptAge = d.p1Age;
            }

            compLabels.push(d.p1Age);
            let a1 = d.assetsP1, a2 = d.assetsP2 || {};
            
            let tfsa = (a1.tfsa||0) + (a1.tfsa_successor||0) + (a1.fhsa||0) + (a2.tfsa||0) + (a2.tfsa_successor||0) + (a2.fhsa||0);
            let reg = (a1.rrsp||0) + (a1.rrif_acct||0) + (a1.lif||0) + (a1.lirf||0) + 
                      (a2.rrsp||0) + (a2.rrif_acct||0) + (a2.lif||0) + (a2.lirf||0);
            let taxable = (a1.nreg||0) + (a1.cash||0) + (a2.nreg||0) + (a2.cash||0);
            let crypt = (a1.crypto||0) + (a2.crypto||0);
            let re = (d.homeValue || 0) - (d.mortgage || 0);

            compTaxFree.push(Math.round(tfsa / df));
            compReg.push(Math.round(reg / df));
            compTaxable.push(Math.round(taxable / df));
            compCrypto.push(Math.round(crypt / df));
            compRE.push(Math.max(0, Math.round(re / df)));
        });

        if (!hasDebtAtStart) debtFreeYear = "Already Debt-Free";

        const finalYear = this.app.state.projectionData[this.app.state.projectionData.length - 1];
        const finalDf = this.app.getDiscountFactor(finalYear.year - new Date().getFullYear());
        const finalEstate = finalYear.debugNW / finalDf;
        const finalLiquid = getLiquidAssets(finalYear) / finalDf;
        const finalHome = finalYear.homeValue / finalDf;

        const totalLiquidGrowth = finalLiquid - initialLiquid + totalExp + totalTax + totalDebt - totalExternalInflow;
        const totalHomeGrowth = finalHome - initialHome;
        const totalGrowth = totalLiquidGrowth + totalHomeGrowth;

        const effRate = totalInflow > 0 ? ((totalTax / totalInflow) * 100).toFixed(1) : 0;
        const fmtK = n => n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M' : '$' + Math.round(n).toLocaleString();

        if (document.getElementById('dash_tax_paid')) document.getElementById('dash_tax_paid').innerText = fmtK(totalTax);
        if (document.getElementById('dash_eff_tax_rate')) document.getElementById('dash_eff_tax_rate').innerText = `Effective Rate: ${effRate}%`;
        if (document.getElementById('dash_total_inflow')) document.getElementById('dash_total_inflow').innerText = fmtK(totalInflow);
        if (document.getElementById('dash_total_expenses')) document.getElementById('dash_total_expenses').innerText = fmtK(totalExp);
        if (document.getElementById('dash_final_estate')) document.getElementById('dash_final_estate').innerText = fmtK(finalEstate);
        if (document.getElementById('dash_peak_nw')) document.getElementById('dash_peak_nw').innerText = `${fmtK(peakNW)} (Age ${peakAge})`;
        if (document.getElementById('dash_debt_free')) document.getElementById('dash_debt_free').innerText = debtFreeYear;
        
        if (document.getElementById('dash_total_growth')) document.getElementById('dash_total_growth').innerText = fmtK(totalGrowth);
        if (document.getElementById('dash_total_benefits')) document.getElementById('dash_total_benefits').innerText = fmtK(totalBenefits);
        
        let avgRetSpend = retYears > 0 ? (retExpSum / retYears) : 0;
        if (document.getElementById('dash_avg_ret_spend')) document.getElementById('dash_avg_ret_spend').innerText = fmtK(avgRetSpend) + '/yr';
        
        if (document.getElementById('dash_ret_age')) document.getElementById('dash_ret_age').innerText = retDayAge || '--';
        if (document.getElementById('dash_ret_day_nw')) document.getElementById('dash_ret_day_nw').innerText = fmtK(retDayNW);

        const healthEl = document.getElementById('dash_plan_health');
        if (healthEl) {
            if (isBankrupt) {
                healthEl.innerText = `Bankrupt at Age ${bankruptAge}`;
                healthEl.className = "fw-bold text-danger";
            } else {
                healthEl.innerText = "SUCCESS (Fully Funded)";
                healthEl.className = "fw-bold text-success";
            }
        }

        const isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        if (document.getElementById('chartLifetimeDonut') && typeof Chart !== 'undefined') {
            if (this.app.charts.donut) this.app.charts.donut.destroy();
            const ctxD = document.getElementById('chartLifetimeDonut').getContext('2d');
            this.app.charts.donut = new Chart(ctxD, {
                type: 'doughnut',
                data: {
                    labels: ['Taxes Paid', 'Living Expenses', 'Debt & Mortgages', 'Final Estate Value'],
                    datasets: [{
                        data: [Math.round(totalTax), Math.round(totalExp), Math.round(totalDebt), Math.max(0, Math.round(finalEstate))],
                        backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6', '#10b981'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'right', labels: { color: textColor, font: { family: 'Inter', size: 12 }, padding: 15 } },
                        tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) label += ': '; if (context.parsed !== null) label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed); return label; } } }
                    }
                }
            });
        }

        if (document.getElementById('chartComposition') && typeof Chart !== 'undefined') {
            if (this.app.charts.comp) this.app.charts.comp.destroy();
            const ctxC = document.getElementById('chartComposition').getContext('2d');
            this.app.charts.comp = new Chart(ctxC, {
                type: 'line',
                data: {
                    labels: compLabels,
                    datasets: [
                        { label: 'Real Estate Equity', data: compRE, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', fill: true, tension: 0.4, pointRadius: 0 },
                        { label: 'Tax-Free (TFSA/FHSA)', data: compTaxFree, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6', fill: true, tension: 0.4, pointRadius: 0 },
                        { label: 'Registered (RRSP/RRIF/LIF)', data: compReg, backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6', fill: true, tension: 0.4, pointRadius: 0 },
                        { label: 'Taxable (Cash/Non-Reg)', data: compTaxable, backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', fill: true, tension: 0.4, pointRadius: 0 },
                        { label: 'Crypto', data: compCrypto, backgroundColor: 'rgba(236, 72, 153, 0.2)', borderColor: '#ec4899', fill: true, tension: 0.4, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: true, title: { display: true, text: 'P1 Age', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                        y: { stacked: true, ticks: { color: textColor, callback: function(value) { if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k'; return '$' + value; } }, grid: { color: gridColor } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: textColor, font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
                        tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y); return label; } } }
                    }
                }
            });
        }
    }

    drawSankey(idx) {
        if (!this.app.state.projectionData[idx] || !google?.visualization || !google.visualization.Sankey) return;
        const d = this.app.state.projectionData[idx], rows = [];
        const df = this.app.getDiscountFactor(d.year - new Date().getFullYear());
        const fmt = n => n>=1000000 ? '$'+(n/1000000).toFixed(1)+'M' : (n>=1000 ? '$'+Math.round(n/1000)+'k' : '$'+Math.round(n));
        const v = n => n / df;
        
        let totalIn = 0;
        const addRow = (from, to, valNum) => {
            const adj = v(valNum);
            if(Math.round(adj) > 0) {
                rows.push([from, to, Math.round(adj)]);
                if(to.includes('Available Cash')) totalIn += adj;
            }
        };

        const potName = `Available Cash\n${fmt(v(d.householdNet))}`; 
        
        let baseP1 = d.incomeP1 - (d.eiMatP1 || 0) - (d.topUpP1 || 0);
        if(baseP1>0) addRow(`Employment P1\n${fmt(v(baseP1))}`, potName, baseP1);
        if(d.eiMatP1>0) addRow(`EI Leave P1\n${fmt(v(d.eiMatP1))}`, potName, d.eiMatP1);
        if(d.topUpP1>0) addRow(`Top-Up P1\n${fmt(v(d.topUpP1))}`, potName, d.topUpP1);

        if(d.postRetP1>0) addRow(`Post-Ret Work P1\n${fmt(v(d.postRetP1))}`, potName, d.postRetP1);
        if(d.ccbP1>0) addRow(`CCB P1\n${fmt(v(d.ccbP1))}`, potName, d.ccbP1);
        if(d.cppP1>0) addRow(`CPP P1\n${fmt(v(d.cppP1))}`, potName, d.cppP1);
        if(d.oasP1>0) addRow(`OAS P1\n${fmt(v(d.oasP1))}`, potName, d.oasP1);
        if(d.dbP1>0) addRow(`DB Pension P1\n${fmt(v(d.dbP1))}`, potName, d.dbP1);
        if(d.invIncP1>0) addRow(`Inv. Yield P1\n${fmt(v(d.invIncP1))}`, potName, d.invIncP1);
        if(d.rrspRefundP1>0) addRow(`Tax Refund P1\n${fmt(v(d.rrspRefundP1))}`, potName, d.rrspRefundP1);

        let baseP2 = (d.incomeP2 || 0) - (d.eiMatP2 || 0) - (d.topUpP2 || 0);
        if(baseP2>0) addRow(`Employment P2\n${fmt(v(baseP2))}`, potName, baseP2);
        if(d.eiMatP2>0) addRow(`EI Leave P2\n${fmt(v(d.eiMatP2))}`, potName, d.eiMatP2);
        if(d.topUpP2>0) addRow(`Top-Up P2\n${fmt(v(d.topUpP2))}`, potName, d.topUpP2);

        if(d.postRetP2>0) addRow(`Post-Ret Work P2\n${fmt(v(d.postRetP2))}`, potName, d.postRetP2);
        if(d.cppP2>0) addRow(`CPP P2\n${fmt(v(d.cppP2))}`, potName, d.cppP2);
        if(d.oasP2>0) addRow(`OAS P2\n${fmt(v(d.oasP2))}`, potName, d.oasP2);
        if(d.dbP2>0) addRow(`DB Pension P2\n${fmt(v(d.dbP2))}`, potName, d.dbP2);
        if(d.invIncP2>0) addRow(`Inv. Yield P2\n${fmt(v(d.invIncP2))}`, potName, d.invIncP2);
        if(d.rrspRefundP2>0) addRow(`Tax Refund P2\n${fmt(v(d.rrspRefundP2))}`, potName, d.rrspRefundP2);

        if(d.windfall>0) addRow(`Inheritance/Bonus\n${fmt(v(d.windfall))}`, potName, d.windfall);

        if(d.flows?.withdrawals) Object.entries(d.flows.withdrawals).forEach(([s,a]) => addRow(`${s}\n${fmt(v(a))}`, potName, a));
        
        const tTax = d.taxP1 + d.taxP2, tDebt = d.mortgagePay + d.debtRepayment;
        
        if(tTax>0) addRow(potName, `Taxes\n${fmt(v(tTax))}`, tTax);
        if(d.expenses>0) addRow(potName, `Living Exp.\n${fmt(v(d.expenses))}`, d.expenses);
        if(tDebt>0) addRow(potName, `Mortgage/Debt\n${fmt(v(tDebt))}`, tDebt);
        
        if(d.flows?.contributions) {
             Object.entries(d.flows.contributions.p1).forEach(([t,a]) => addRow(potName, `To P1 ${this.app.strategyLabels[t]||t}\n${fmt(v(a))}`, a));
             Object.entries(d.flows.contributions.p2).forEach(([t,a]) => addRow(potName, `To P2 ${this.app.strategyLabels[t]||t}\n${fmt(v(a))}`, a));
        }

        if(rows.length === 0) return;

        const unq = new Set(); rows.forEach(r => { unq.add(r[0]); unq.add(r[1]); });
        const nodesCfg = Array.from(unq).map(n => {
            let c='#a8a29e'; 
            if(n.includes("P1")) c='#0ea5e9';
            if(n.includes("P2")) c='#8b5cf6';
            if(n.includes("Taxes")) c='#ef4444'; 
            if(n.includes("Exp")) c='#f97316'; 
            if(n.includes("Mort")||n.includes("Debt")) c='#dc2626'; 
            if(n.includes("Available Cash")) c='#10b981';
            if(n.includes("CCB")) c='#06b6d4';
            if(n.includes("Refund")) c='#22c55e';
            return { color: c };
        });

        const dt = new google.visualization.DataTable(); 
        dt.addColumn('string','From'); dt.addColumn('string','To'); dt.addColumn('number','Amount'); 
        dt.addRows(rows);
        this.app.charts.sankey = new google.visualization.Sankey(document.getElementById('sankey_chart'));
        this.app.charts.sankey.draw(dt, { sankey: { node: { label: { color: document.documentElement.getAttribute('data-bs-theme')==='light'?'#000':'#fff', fontSize:13, bold:true }, nodePadding:30, width:12, colors: nodesCfg.map(x=>x.color) }, link: { colorMode: 'gradient', colors: ['#334155','#475569'] } }, backgroundColor: 'transparent', height: 600, width: '100%' });
    }

    renderComparisonChart() {
        if (!document.getElementById('chartNW') || typeof Chart === 'undefined') return;

        const checkboxes = document.querySelectorAll('#compareSelectionArea input[type="checkbox"]:checked');
        const scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');

        const datasets = [];
        let labels = [];
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        
        const curYear = new Date().getFullYear();

        checkboxes.forEach((cb, i) => {
            const color = colors[i % colors.length];
            if (cb.value === 'current') {
                if (this.app.state.projectionData.length > 0) {
                    if (labels.length === 0) labels = this.app.state.projectionData.map(d => d.year);
                    datasets.push({
                        label: 'Current Plan',
                        data: this.app.state.projectionData.map(d => {
                            const df = this.app.getDiscountFactor(d.year - curYear);
                            return Math.round(d.debugNW / df);
                        }),
                        borderColor: color,
                        backgroundColor: color + '33',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.3
                    });
                }
            } else {
                const s = scenarios[parseInt(cb.value)];
                if (s && s.data && s.data.nwTrajectory) {
                    if (labels.length === 0) labels = s.data.years || s.data.nwTrajectory.map((_, idx) => curYear + idx);
                    datasets.push({
                        label: s.name,
                        data: s.data.nwTrajectory.map((val, idx) => {
                            const df = this.app.getDiscountFactor(idx);
                            return Math.round(val / df);
                        }),
                        borderColor: color,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.3
                    });
                }
            }
        });

        if (this.app.charts.nw) this.app.charts.nw.destroy();

        const ctx = document.getElementById('chartNW').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        this.app.charts.nw = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor, font: { family: 'Inter', size: 13 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { 
                        ticks: { 
                            color: textColor,
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                                return '$' + value;
                            }
                        }, 
                        grid: { color: gridColor } 
                    }
                }
            }
        });
    }
}
