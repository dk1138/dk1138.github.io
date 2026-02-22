/**
 * Retirement Planner Pro - Data Controller
 * Handles CRUD operations and rendering for dynamic input arrays
 * (Properties, Income, Expenses, Windfalls, Dependents, Strategy, Debt).
 */
class DataController {
    constructor(app) {
        this.app = app;
    }

    // --- DEPENDENTS (CCB & RESP) ---
    renderDependents() {
        const container = document.getElementById('dependents-container'); 
        if(!container) return; 
        container.innerHTML = '';
        
        if (!this.app.state.dependents) this.app.state.dependents = [];
        
        this.app.state.dependents.forEach((dep, idx) => {
            const div = document.createElement('div');
            div.className = 'row g-3 mb-2 align-items-end dependent-row';
            div.innerHTML = `
                <div class="col-5">
                    <label class="form-label small text-muted mb-1">Name</label>
                    <input type="text" class="form-control form-control-sm border-secondary dependent-update" value="${dep.name}" data-idx="${idx}" data-field="name">
                </div>
                <div class="col-5">
                    <label class="form-label small text-muted mb-1">Birth Month</label>
                    <input type="month" class="form-control form-control-sm border-secondary dependent-update" value="${dep.dob}" data-idx="${idx}" data-field="dob">
                </div>
                <div class="col-2">
                    <button type="button" class="btn btn-sm btn-outline-danger w-100 mb-0 py-1" onclick="app.data.removeDependent(${idx})"><i class="bi bi-trash"></i></button>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.dependent-update').forEach(el => {
            el.addEventListener('input', e => {
                const t = e.target;
                this.app.state.dependents[t.dataset.idx][t.dataset.field] = t.value;
                this.app.debouncedRun();
            });
        });
    }

    addDependent() {
        if (!this.app.state.dependents) this.app.state.dependents = [];
        this.app.state.dependents.push({ name: `Child ${this.app.state.dependents.length + 1}`, dob: new Date().toISOString().slice(0, 7) });
        this.renderDependents();
        this.app.run();
    }

    removeDependent(idx) {
        this.app.showConfirm("Remove this dependent?", () => {
            this.app.state.dependents.splice(idx, 1);
            this.renderDependents();
            this.app.run();
        });
    }

    // --- WINDFALLS ---
    renderWindfalls() {
        const container = document.getElementById('windfall-container'); if(!container) return; container.innerHTML = '';
        this.app.state.windfalls.forEach((w, idx) => {
            const today = new Date().toISOString().slice(0, 7), div = document.createElement('div');
            div.className = 'windfall-row p-3 border border-secondary rounded-3 surface-card mb-3';
            div.innerHTML = `<div class="d-flex justify-content-between mb-3"><input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold text-success fs-6 windfall-update px-0" placeholder="Event Name" value="${w.name}" data-idx="${idx}" data-field="name"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.data.removeWindfall(${idx})"><i class="bi bi-x-lg"></i></button></div><div class="row g-3 align-items-center mb-2"><div class="col-4"><label class="form-label small text-muted mb-1">Amount</label><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num windfall-update" value="${w.amount.toLocaleString()}" data-idx="${idx}" data-field="amount"></div></div><div class="col-4"><label class="form-label small text-muted mb-1">Frequency</label><select class="form-select form-select-sm border-secondary windfall-update" data-idx="${idx}" data-field="freq"><option value="one" ${w.freq==='one'?'selected':''}>One Time</option><option value="month" ${w.freq==='month'?'selected':''}>/ Month</option><option value="year" ${w.freq==='year'?'selected':''}>/ Year</option></select></div><div class="col-4 p2-column" style="${this.app.state.mode === 'Couple' ? '' : 'display:none;'}"><label class="form-label small text-muted mb-1">Owner</label><select class="form-select form-select-sm border-secondary windfall-update" data-idx="${idx}" data-field="owner"><option value="p1" ${w.owner==='p1'?'selected':''}>P1</option><option value="p2" ${w.owner==='p2'?'selected':''}>P2</option></select></div></div><div class="row g-3 align-items-end"><div class="col-4"><label class="form-label small text-muted mb-1">Start Date</label><input type="month" class="form-control form-control-sm border-secondary windfall-update" value="${w.start || today}" data-idx="${idx}" data-field="start"></div><div class="col-4" style="${w.freq==='one'?'display:none;':''}"><label class="form-label small text-muted mb-1">End Date</label><input type="month" class="form-control form-control-sm border-secondary windfall-update" value="${w.end}" data-idx="${idx}" data-field="end"></div><div class="col-4 d-flex align-items-center justify-content-end pb-1"><div class="form-check"><input class="form-check-input windfall-update" type="checkbox" id="wf_tax_${idx}" ${w.taxable?'checked':''} data-idx="${idx}" data-field="taxable"><label class="form-check-label text-muted small" for="wf_tax_${idx}">Is Taxable?</label></div></div></div>`;
            container.appendChild(div); div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.app.formatInput(e.target)));
        });
    }

    addWindfall() { this.app.state.windfalls.push({ name: "New Event", amount: 0, freq: 'one', owner: 'p1', taxable: false, start: new Date().toISOString().slice(0, 7), end: '' }); this.renderWindfalls(); this.app.run(); }
    removeWindfall(index) { this.app.showConfirm("Remove this event?", () => { this.app.state.windfalls.splice(index, 1); this.renderWindfalls(); this.app.run(); }); }

    // --- ADDITIONAL INCOME ---
    renderAdditionalIncome() {
        const cP1 = document.getElementById('p1-additional-income-container'), cP2 = document.getElementById('p2-additional-income-container');
        if(cP1) cP1.innerHTML = ''; if(cP2) cP2.innerHTML = '';
        
        this.app.state.additionalIncome.forEach((w, idx) => {
            const tgt = w.owner === 'p2' ? cP2 : cP1; if(!tgt) return;
            const div = document.createElement('div'); div.className = 'income-stream-row p-3 border border-secondary rounded-3 bg-black bg-opacity-25 mt-3 mb-3';
            
            if(!w.startMode) w.startMode = 'date';
            if(w.startRel === undefined) w.startRel = 0;
            if(!w.endMode) w.endMode = 'date';
            if(w.duration === undefined) w.duration = 5;

            let startInputHtml = w.startMode === 'date' 
                ? `<input type="month" class="form-control form-control-sm border-secondary income-stream-update" value="${w.start || new Date().toISOString().slice(0, 7)}" data-idx="${idx}" data-field="start">`
                : `<div class="input-group input-group-sm"><input type="number" class="form-control border-secondary income-stream-update" value="${w.startRel}" data-idx="${idx}" data-field="startRel"><span class="input-group-text border-secondary text-muted">Yrs</span></div>`;

            let endInputHtml = w.endMode === 'date'
                ? `<input type="month" class="form-control form-control-sm border-secondary income-stream-update" value="${w.end}" data-idx="${idx}" data-field="end">`
                : `<div class="input-group input-group-sm"><input type="number" class="form-control border-secondary income-stream-update" value="${w.duration}" data-idx="${idx}" data-field="duration"><span class="input-group-text border-secondary text-muted">Yrs</span></div>`;

            div.innerHTML = `
            <div class="d-flex justify-content-between mb-3">
                <input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold text-info fs-6 income-stream-update px-0" placeholder="Stream Name" value="${w.name}" data-idx="${idx}" data-field="name">
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.data.removeAdditionalIncome(${idx})"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="row g-3 align-items-center mb-2">
                <div class="col-6">
                    <label class="form-label small text-muted mb-1">Amount</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text border-secondary text-muted">$</span>
                        <input type="text" class="form-control border-secondary formatted-num income-stream-update" value="${w.amount.toLocaleString()}" data-idx="${idx}" data-field="amount">
                    </div>
                </div>
                <div class="col-6">
                    <label class="form-label small text-muted mb-1">Frequency</label>
                    <select class="form-select form-select-sm border-secondary income-stream-update" data-idx="${idx}" data-field="freq">
                        <option value="month" ${w.freq==='month'?'selected':''}>/ Month</option>
                        <option value="year" ${w.freq==='year'?'selected':''}>/ Year</option>
                    </select>
                </div>
            </div>
            <div class="row g-3 align-items-end mb-2">
                <div class="col-6">
                    <label class="form-label small text-muted mb-1">Start</label>
                    <select class="form-select form-select-sm border-secondary income-stream-update mb-1" data-idx="${idx}" data-field="startMode" style="font-size: 0.75rem;">
                        <option value="date" ${w.startMode==='date'?'selected':''}>Specific Date</option>
                        <option value="ret_relative" ${w.startMode==='ret_relative'?'selected':''}>After Retirement</option>
                    </select>
                    ${startInputHtml}
                </div>
                <div class="col-6">
                    <label class="form-label small text-muted mb-1">End</label>
                    <select class="form-select form-select-sm border-secondary income-stream-update mb-1" data-idx="${idx}" data-field="endMode" style="font-size: 0.75rem;">
                        <option value="date" ${w.endMode==='date'?'selected':''}>Specific Date</option>
                        <option value="duration" ${w.endMode==='duration'?'selected':''}>Duration</option>
                    </select>
                    ${endInputHtml}
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-6">
                    <label class="form-label small text-muted mb-1">Growth %</label>
                    <div class="input-group input-group-sm">
                        <input type="number" step="0.1" class="form-control border-secondary income-stream-update" value="${w.growth}" data-idx="${idx}" data-field="growth">
                        <span class="input-group-text border-secondary text-muted">%</span>
                    </div>
                </div>
                <div class="col-6 d-flex align-items-end justify-content-end">
                    <div class="form-check mb-1">
                        <input class="form-check-input income-stream-update" type="checkbox" id="inc_tax_${idx}" ${w.taxable?'checked':''} data-idx="${idx}" data-field="taxable">
                        <label class="form-check-label text-muted small" for="inc_tax_${idx}">Is Taxable?</label>
                    </div>
                </div>
            </div>`;
            tgt.appendChild(div); 
            div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.app.formatInput(e.target)));
        });
    }

    addAdditionalIncome(owner) { 
        this.app.state.additionalIncome.push({ 
            name: "Side Hustle / Consulting", amount: 0, freq: 'month', owner, taxable: true, 
            startMode: 'date', start: new Date().toISOString().slice(0, 7), startRel: 0,
            endMode: 'date', end: '', duration: 10, growth: 2.0 
        }); 
        this.renderAdditionalIncome(); this.updateIncomeDisplay(); this.app.run(); 
    }
    
    removeAdditionalIncome(idx) { 
        this.app.showConfirm("Remove income stream?", () => { 
            this.app.state.additionalIncome.splice(idx, 1); 
            this.renderAdditionalIncome(); this.updateIncomeDisplay(); this.app.run(); 
        }); 
    }

    updateIncomeDisplay() {
        const prov = this.app.getRaw('tax_province'), cY = new Date().getFullYear();
        let add = { p1T:0, p1N:0, p2T:0, p2N:0 };
        this.app.state.additionalIncome.forEach(s => {
            let sY, eY;
            if(s.startMode === 'ret_relative'){
                const dob = new Date(this.app.getRaw(`${s.owner}_dob`) + "-01").getFullYear();
                const retAge = this.app.getVal(`${s.owner}_retireAge`);
                sY = dob + retAge + (s.startRel || 0);
            } else {
                sY = new Date(s.start+"-01").getFullYear();
            }
            
            if(s.endMode === 'duration'){
                eY = sY + (s.duration || 0);
            } else {
                eY = (s.end ? new Date(s.end+"-01") : new Date("2100-01-01")).getFullYear();
            }

            if(cY>=sY && cY<=eY) {
                let baseYear = s.startMode === 'ret_relative' ? sY : new Date(s.start+"-01").getFullYear();
                let a = s.amount * Math.pow(1+(s.growth/100), cY-baseYear) * (s.freq==='month'?12:1);
                if (s.startMode === 'date' && cY===sY) a *= (12-new Date(s.start+"-01").getMonth())/12;
                if (s.endMode === 'date' && s.end && cY===eY) a *= Math.min(1, (new Date(s.end+"-01").getMonth()+1)/12);

                if(a>0){ if(s.owner==='p1'){ s.taxable?add.p1T+=a:add.p1N+=a; } else { s.taxable?add.p2T+=a:add.p2N+=a; } }
            }
        });
        const p1G = this.app.getVal('p1_income') + add.p1T;
        const p2G = this.app.getVal('p2_income') + add.p2T;
        const hhG = p1G + add.p1N + (this.app.state.mode==='Couple' ? p2G + add.p2N : 0);
        
        if(document.getElementById('household_gross_display')) document.getElementById('household_gross_display').innerHTML = `$${hhG.toLocaleString()} <span class="monthly-sub">($${Math.round(hhG/12).toLocaleString()}/mo)</span>`;
        
        const engine = new FinanceEngine(this.app.getEngineData());
        const taxBrackets = engine.getInflatedTaxData(1);
        const p1D = engine.calculateTaxDetailed(p1G, prov, taxBrackets);
        const p2D = engine.calculateTaxDetailed(p2G, prov, taxBrackets);
        
        this.app.ui.renderTaxDetails('p1', p1G, p1D); 
        this.app.ui.renderTaxDetails('p2', p2G, p2D);
        
        const hhN = (p1G-p1D.totalTax) + add.p1N + (this.app.state.mode==='Couple' ? (p2G-p2D.totalTax)+add.p2N : 0);
        if(document.getElementById('household_net_display')) document.getElementById('household_net_display').innerHTML = `$${Math.round(hhN).toLocaleString()} <span class="monthly-sub">($${Math.round(hhN/12).toLocaleString()}/mo)</span>`;
        return hhN;
    }

    // --- REAL ESTATE ---
    renderProperties() {
        const c = document.getElementById('real-estate-container'); c.innerHTML = '';
        this.app.state.properties.forEach((p, idx) => {
            const div = document.createElement('div'); 
            div.className = 'property-row p-4 border border-secondary rounded-3 surface-card mb-4';
            
            const incNWId = `prop_nw_${idx}`;
            const sellId = `prop_sell_${idx}`;
            const sellSectionId = `prop_sell_div_${idx}`;

            if (p.sellEnabled === undefined) p.sellEnabled = false;
            if (p.sellAge === undefined) p.sellAge = 65;
            if (p.replacementValue === undefined) p.replacementValue = 0;

            div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary">
                <input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold fs-6 property-update px-0" style="max-width:300px;" value="${p.name}" data-idx="${idx}" data-field="name">
                ${idx > 0 ? `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.data.removeProperty(${idx})"><i class="bi bi-x-lg"></i></button>` : ''}
            </div>
            
            <div class="row g-4">
                <div class="col-6 col-md-3">
                    <label class="form-label text-muted fw-bold">Value</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text border-secondary text-muted">$</span>
                        <input type="text" class="form-control border-secondary formatted-num property-update" value="${p.value.toLocaleString()}" data-idx="${idx}" data-field="value">
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label text-muted fw-bold">Mortgage</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text border-secondary text-muted">$</span>
                        <input type="text" class="form-control border-secondary formatted-num property-update" value="${p.mortgage.toLocaleString()}" data-idx="${idx}" data-field="mortgage">
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label text-muted fw-bold">Growth %</label>
                    <div class="input-group input-group-sm">
                        <input type="number" step="0.01" class="form-control border-secondary property-update" value="${p.growth}" data-idx="${idx}" data-field="growth">
                        <span class="input-group-text border-secondary text-muted">%</span>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label text-muted fw-bold">Rate %</label>
                    <div class="input-group input-group-sm">
                        <input type="number" step="0.01" class="form-control border-secondary property-update" value="${p.rate}" data-idx="${idx}" data-field="rate">
                        <span class="input-group-text border-secondary text-muted">%</span>
                    </div>
                </div>
                <div class="col-12 col-md-4 mt-4">
                    <label class="form-label text-warning fw-bold">Monthly Pmt</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-warning bg-opacity-25 text-warning border-warning">$</span>
                        <input type="text" class="form-control border-warning formatted-num property-update text-warning fw-bold" value="${Math.round(p.payment).toLocaleString()}" data-idx="${idx}" data-field="payment">
                    </div>
                    <div class="mt-2 small" id="prop-payoff-${idx}"></div>
                </div>
            </div>

            <div class="mt-4 pt-3 border-top border-secondary">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="form-check form-switch">
                        <input class="form-check-input property-update fs-5 mt-0" type="checkbox" id="${sellId}" ${p.sellEnabled ? 'checked' : ''} data-idx="${idx}" data-field="sellEnabled" onchange="document.getElementById('${sellSectionId}').style.display = this.checked ? 'flex' : 'none'">
                        <label class="form-check-label text-info fw-bold small ms-2" for="${sellId}" style="margin-top: 3px;">Plan to Sell / Downsize?</label>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input property-update mt-0" type="checkbox" id="${incNWId}" ${p.includeInNW ? 'checked' : ''} data-idx="${idx}" data-field="includeInNW">
                        <label class="form-check-label text-muted small ms-2" for="${incNWId}">Include in NW</label>
                    </div>
                </div>

                <div class="row g-3 mt-2 p-3 border border-secondary rounded-3 bg-black bg-opacity-10" id="${sellSectionId}" style="display: ${p.sellEnabled ? 'flex' : 'none'};">
                    <div class="col-12 col-md-5">
                        <label class="form-label text-muted small fw-bold">Sell at P1 Age</label>
                        <input type="number" class="form-control form-control-sm border-secondary property-update" value="${p.sellAge}" data-idx="${idx}" data-field="sellAge">
                    </div>
                    <div class="col-12 col-md-7">
                        <label class="form-label text-muted small fw-bold">Replacement Home Cost</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text border-secondary text-muted">$</span>
                            <input type="text" class="form-control border-secondary formatted-num property-update" value="${(p.replacementValue || 0).toLocaleString()}" data-idx="${idx}" data-field="replacementValue">
                        </div>
                        <div class="form-text text-muted" style="font-size: 0.7rem;">Enter $0 if renting afterwards. Difference is added to cash.</div>
                    </div>
                </div>
            </div>
            `;
            c.appendChild(div); 
            div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.app.formatInput(e.target)));
        });
        this.updateAllMortgages();
    }

    addProperty() { this.app.state.properties.push({ name: "New Property", value: 500000, mortgage: 400000, growth: 3.0, rate: 4.0, payment: 0, manual: false, includeInNW: false, sellEnabled: false, sellAge: 65, replacementValue: 0 }); this.renderProperties(); this.app.run(); }
    removeProperty(idx) { this.app.showConfirm("Remove property?", () => { this.app.state.properties.splice(idx, 1); this.renderProperties(); this.app.run(); }); }

    updateAllMortgages() { this.app.state.properties.forEach((p, idx) => { if(!p.manual) this.calculateSingleMortgage(idx); this.updatePropPayoffDisplay(idx); }); }
    
    calculateSingleMortgage(idx) {
        const p = this.app.state.properties[idx]; let pmt = 0;
        if (p.mortgage > 0 && p.rate > 0) pmt = p.mortgage * ((p.rate/1200) * Math.pow(1+p.rate/1200, 300)) / (Math.pow(1+p.rate/1200, 300) - 1);
        else if (p.mortgage > 0) pmt = p.mortgage / 300;
        this.app.state.properties[idx].payment = pmt;
        const inputs = document.querySelectorAll(`.property-update[data-idx="${idx}"][data-field="payment"]`);
        if(inputs.length) inputs[0].value = Math.round(pmt).toLocaleString();
    }
    
    updatePropPayoffDisplay(idx) {
        const p = this.app.state.properties[idx], el = document.getElementById(`prop-payoff-${idx}`); if(!el) return;
        if(p.mortgage <= 0) return el.innerHTML = "";
        const r = (p.rate/100)/12; if(p.payment <= p.mortgage*r) return el.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-circle me-1"></i>Payment too low</span>`;
        const nMonths = -Math.log(1 - (r*p.mortgage)/p.payment) / Math.log(1+r);
        if(isFinite(nMonths)) el.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-calendar-check me-1"></i>Payoff: ${Math.floor(nMonths/12)}y ${Math.round(nMonths%12)}m</span>`;
    }

    // --- EXPENSES ---
    renderExpenseRows() {
        const tb = document.getElementById('expenseTableBody'), th = document.getElementById('expenseTableHeader'), t = document.documentElement.getAttribute('data-bs-theme')||'dark', rB=t==='light'?'bg-white':'bg-body-tertiary', rT=t==='light'?'text-dark':'text-white', rBd=t==='light'?'border-dark-subtle':'border-secondary', ab=t==='light'?'text-secondary':'text-white', ic=t==='light'?'bg-white text-dark':'bg-transparent text-white', hc=t==='light'?'bg-white text-dark border-bottom border-dark-subtle':'bg-transparent text-muted border-secondary';
        const gLim = parseInt(this.app.getRaw('exp_gogo_age'))||75, sLim = parseInt(this.app.getRaw('exp_slow_age'))||85;
        
        th.innerHTML = this.app.state.expenseMode==='Simple' 
            ? `<th class="text-uppercase small ps-3 ${hc}" style="width: 40%;">Category / Item</th><th class="text-uppercase small ${hc}" style="width: 30%;">Current</th><th class="text-uppercase small ${hc}" style="width: 30%;">Retirement</th>` 
            : `<th class="text-uppercase small ps-3 ${hc}" style="width: 20%;">Item</th><th class="text-uppercase small ${hc}" style="width: 16%;">Current</th><th class="text-uppercase small ${hc}" style="width: 16%;">Trans</th><th class="text-uppercase small ${hc}" style="width: 16%;">Go-Go <span style="font-size:0.6rem">(&lt;${gLim})</span></th><th class="text-uppercase small ${hc}" style="width: 16%;">Slow-Go <span style="font-size:0.6rem">(&lt;${sLim})</span></th><th class="text-uppercase small ${hc}" style="width: 16%;">No-Go <span style="font-size:0.6rem">(${sLim}+)</span></th>`;
        
        let h='', m={"Housing":{i:"bi-house-door-fill",c:"text-primary"},"Living":{i:"bi-basket2-fill",c:"text-success"},"Kids":{i:"bi-balloon-heart-fill",c:"text-warning"},"Lifestyle":{i:"bi-airplane-engines-fill",c:"text-info"}};
        const rI = (i,f,x,c,cls) => `<div class="input-group input-group-sm mb-1" style="flex-wrap:nowrap;"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${cls}" style="min-width:60px;" value="${(i[f]||0).toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="${f}"></div>`;
        
        Object.entries(this.app.expensesByCategory).forEach(([c, d]) => {
            const mt = m[c]||{i:"bi-tag-fill",c:"text-white"}, cs = this.app.state.expenseMode==='Simple'?3:6;
            h += `<tr class="expense-category-row"><td colspan="${cs}" class="py-3 ps-3 border-bottom ${rBd} ${rB} ${rT}"><div class="d-flex align-items-center justify-content-between"><div class="d-flex align-items-center"><i class="bi ${mt.i} ${mt.c} me-2 fs-6"></i><span class="text-uppercase fw-bold ${mt.c} small" style="letter-spacing:1px;">${c}</span></div><button type="button" class="btn btn-sm btn-link ${ab} p-0 me-3" onclick="app.data.addExpense('${c}')"><i class="bi bi-plus-circle-fill text-success fs-5"></i></button></div></td></tr>`;
            d.items.forEach((i, x) => {
                h += `<tr class="expense-row"><td class="ps-3 align-middle border-bottom border-secondary ${rB} ${rT}"><input type="text" class="form-control form-control-sm border-0 expense-update ${ic}" value="${i.name}" data-cat="${c}" data-idx="${x}" data-field="name"></td>`;
                if(this.app.state.expenseMode==='Simple'){
                    h += `<td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="width:100px;flex-grow:1;" value="${i.curr.toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="curr"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div></td><td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="d-flex align-items-center"><div class="input-group input-group-sm flex-grow-1"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="width:100px;flex-grow:1;" value="${i.ret.toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="ret"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div><button type="button" class="btn btn-sm btn-link text-danger p-0 ms-3 me-2" onclick="app.data.removeExpense('${c}', ${x})"><i class="bi bi-trash"></i></button></div></td>`;
                } else {
                    h += `<td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="input-group input-group-sm mb-1" style="flex-wrap:nowrap;"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="min-width:60px;" value="${(i.curr||0).toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="curr"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div></td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'trans',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'gogo',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'slow',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="d-flex align-items-center justify-content-between">${rI(i,'nogo',x,c,ic)}<button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="app.data.removeExpense('${c}', ${x})"><i class="bi bi-trash"></i></button></div></td>`;
                } h += `</tr>`;
            });
        }); 
        tb.innerHTML = h;
        document.querySelectorAll('.expense-update.formatted-num').forEach(el => el.addEventListener('input', e => this.app.formatInput(e.target)));
    }

    addExpense(c) { 
        this.app.expensesByCategory[c].items.push({ name: "New Expense", curr: 0, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }); 
        this.renderExpenseRows(); this.calcExpenses(); this.app.run(); 
    }
    
    removeExpense(c, i) { 
        this.app.showConfirm('Delete expense?', () => { 
            this.app.expensesByCategory[c].items.splice(i, 1); 
            this.renderExpenseRows(); this.calcExpenses(); this.app.run(); 
        }); 
    }

    calcExpenses() {
        const uR = document.getElementById('useRealDollars')?.checked, inf = this.app.getVal('inflation_rate')/100, cA = Math.abs(new Date(Date.now() - new Date(this.app.getRaw('p1_dob')+"-01").getTime()).getUTCFullYear() - 1970), p1R = this.app.getVal('p1_retireAge'), p2R = this.app.state.mode==='Couple'?this.app.getVal('p2_retireAge'):999, gLim=parseInt(this.app.getRaw('exp_gogo_age'))||75, sLim=parseInt(this.app.getRaw('exp_slow_age'))||85;
        const gF = y => uR?1:Math.pow(1+inf, y), fT=gF(Math.max(0, Math.min(p1R,p2R)-cA)), fG=gF(Math.max(0, Math.max(p1R,this.app.state.mode==='Couple'?p2R:0)-cA)), fS=gF(Math.max(0, gLim-cA)), fN=gF(Math.max(0, sLim-cA));
        let t={curr:0,ret:0,trans:0,gogo:0,slow:0,nogo:0}; 
        Object.values(this.app.expensesByCategory).forEach(c=>c.items.forEach(i=>{ const f=i.freq; t.curr+=(i.curr||0)*f; t.ret+=(i.ret||0)*f; t.trans+=(i.trans||0)*f; t.gogo+=(i.gogo||0)*f; t.slow+=(i.slow||0)*f; t.nogo+=(i.nogo||0)*f; }));
        const fmt = n => '$'+Math.round(n).toLocaleString(), cS="border:none;border-left:1px solid var(--border-color);padding-left:12px;", lS="border:none;text-align:right;padding-right:12px;color:var(--text-muted);font-weight:bold;font-size:0.75rem;text-transform:uppercase;";
        document.getElementById('expenseFooter').innerHTML = this.app.state.expenseMode==='Simple' 
            ? `<table class="table table-sm table-borderless mb-0 bg-transparent" style="table-layout:fixed;"><tr><td width="40%" style="${lS}">Total Annual</td><td width="30%" style="${cS}"><span class="text-danger fw-bold fs-6">${fmt(t.curr)}</span></td><td width="30%" style="${cS}"><span class="text-warning fw-bold fs-6">${fmt(t.ret*(uR?1:fG))}</span></td></tr></table>` 
            : `<table class="table table-sm table-borderless mb-0 bg-transparent" style="table-layout:fixed;"><tr><td width="20%" style="${lS}">Total</td><td width="16%" style="${cS}"><div class="text-danger fw-bold">${fmt(t.curr)}</div><div class="small text-muted" style="font-size:0.7rem">Now</div></td><td width="16%" style="${cS}"><div class="text-warning fw-bold">${fmt(t.trans*fT)}</div><div class="small text-muted" style="font-size:0.7rem">Trans</div></td><td width="16%" style="${cS}"><div class="text-info fw-bold">${fmt(t.gogo*fG)}</div><div class="small text-muted" style="font-size:0.7rem">Go-Go (&lt;${gLim})</div></td><td width="16%" style="${cS}"><div class="text-primary fw-bold">${fmt(t.slow*fS)}</div><div class="small text-muted" style="font-size:0.7rem">Slow (&lt;${sLim})</div></td><td width="16%" style="${cS}"><div class="text-secondary fw-bold">${fmt(t.nogo*fN)}</div><div class="small text-muted" style="font-size:0.7rem">No-Go (${sLim}+)</div></td></tr></table>`;
    }

    // --- DEBTS ---
    addDebtRow() {
        const c = document.getElementById('debt-container'), div = document.createElement('div'); div.className = 'row g-3 mb-2 align-items-center debt-row';
        div.innerHTML = `<div class="col-12 col-md-5"><input type="text" class="form-control form-control-sm" placeholder="Debt Name"></div><div class="col-8 col-md-4"><div class="input-group input-group-sm"><span class="input-group-text">$</span><input type="text" class="form-control formatted-num live-calc debt-amount" value="0"></div></div><div class="col-4 col-md-3"><button type="button" class="btn btn-outline-danger btn-sm w-100"><i class="bi bi-trash"></i></button></div>`;
        c.appendChild(div); div.querySelector('.debt-amount').addEventListener('input', e => { this.app.formatInput(e.target); this.app.debouncedRun(); });
        div.querySelector('.btn-outline-danger').addEventListener('click', () => this.app.showConfirm("Remove this liability?", () => { div.remove(); this.app.debouncedRun(); }));
    }

    getTotalDebt() { 
        let t=0; document.querySelectorAll('.debt-amount').forEach(el=>t+=Number(el.value.replace(/,/g,''))||0); return t; 
    }

    // --- STRATEGY Drag & Drop ---
    renderStrategy() {
        const visibleAccum = this.app.state.strategies.accum;
        const visibleDecum = this.app.state.strategies.decum;

        this.renderList('strat-accum-list', visibleAccum, 'accum', document.getElementById('strat-accum-container'));
        
        const decumContainer = document.getElementById('strat-decumulation'); 
        decumContainer.innerHTML = ''; 
        
        this.renderList('strat-decum-list', visibleDecum, 'decum', decumContainer);

        setTimeout(() => { try { this.app.ui.initPopovers(); } catch(e) {} }, 50);
    }

    renderList(id, arr, type, cont) {
        let ul = document.getElementById(id); 
        if(!ul) { 
            ul = document.createElement('ul'); 
            ul.id = id; 
            ul.className = type === 'decum' ? 'strategy-list p-0 m-0 mb-4' : 'strategy-list p-0 m-0'; 
            ul.style.listStyle = 'none'; 
            cont.appendChild(ul); 
        } else {
            ul.innerHTML = '';
        }

        const taxDescriptions = {
            'tfsa': '<b>TFSA</b><br>Tax-Free Savings Account. Withdrawals are completely tax-free and do not affect government benefits.',
            'fhsa': '<b>FHSA</b><br>First Home Savings Account. Tax-deductible contributions, tax-free withdrawals for a first home. Max 15 years.',
            'resp': '<b>RESP</b><br>Registered Education Savings Plan. Grows tax-deferred. Government matches 20% of first $2,500/yr.',
            'rrsp': '<b>RRSP</b><br>Registered Retirement Savings Plan. Withdrawals are 100% fully taxable as ordinary income.',
            'rrif_acct': '<b>RRIF</b><br>Registered Retirement Income Fund. Subject to mandatory minimum annual withdrawals. 100% fully taxable.',
            'lif': '<b>LIF</b><br>Life Income Fund. Has both minimum AND maximum annual withdrawal limits. 100% fully taxable.',
            'lirf': '<b>LIRF / LIRA</b><br>Locked-In Retirement Account. Must be converted to a LIF before you can withdraw. Tax-deferred.',
            'nreg': '<b>Non-Registered</b><br>Taxable investment account. Capital gains are taxed favorably at a 50% inclusion rate.',
            'cash': '<b>Cash</b><br>Standard savings. No tax sheltering, but withdrawals of the principal are not taxed as new income.',
            'crypto': '<b>Crypto</b><br>Digital assets. Treated as property, meaning gains are taxed at the 50% capital gains inclusion rate.'
        };

        arr.forEach((k, i) => {
            const li = document.createElement('li'); 
            li.className = 'strat-item shadow-sm'; 
            li.draggable = true; 
            li.setAttribute('data-key', k);
            
            li.innerHTML = `
                <span class="fw-bold small d-flex align-items-center">
                    <span class="badge bg-secondary me-2 rounded-circle">${i+1}</span> 
                    ${this.app.strategyLabels[k] || k.toUpperCase()}
                    <i class="bi bi-info-circle text-muted ms-2 info-btn" style="cursor: help; font-size: 0.85rem;" tabindex="0" data-bs-toggle="popover" data-bs-trigger="focus" data-bs-html="true" data-bs-content="${taxDescriptions[k]}"></i>
                </span> 
                <i class="bi bi-grip-vertical grip-icon fs-5"></i>
            `;
            
            li.addEventListener('dragstart', () => { li.classList.add('dragging'); li.style.opacity = '0.5'; });
            li.addEventListener('dragend', () => { li.classList.remove('dragging'); li.style.opacity = '1'; this.updateArrayOrder(id, type); this.app.run(); }); 
            ul.appendChild(li);
        });

        ul.addEventListener('dragover', e => {
            e.preventDefault(); 
            const aE = [...ul.querySelectorAll('.strat-item:not(.dragging)')].reduce((c, ch) => { 
                const b = ch.getBoundingClientRect(), o = e.clientY - b.top - b.height / 2; 
                return o < 0 && o > c.offset ? {offset: o, e: ch} : c; 
            }, {offset: Number.NEGATIVE_INFINITY}).e;
            const drg = document.querySelector('.dragging');
            aE == null ? ul.appendChild(drg) : ul.insertBefore(drg, aE);
        });
    }

    updateArrayOrder(id, type) {
        const o = []; 
        document.getElementById(id).querySelectorAll('.strat-item').forEach(i => o.push(i.getAttribute('data-key')));
        
        const orig = type === 'accum' ? this.app.state.strategies.accum : this.app.state.strategies.decum;
        orig.forEach(k => {
            if (!o.includes(k)) o.push(k);
        });

        if (type === 'accum') this.app.state.strategies.accum = o; 
        else this.app.state.strategies.decum = o; 
        
        this.renderStrategy();
    }

    // --- CPP / OAS ESTIMATOR ---
    estimateCPPOAS() {
        const engine = new FinanceEngine(this.app.getEngineData());
        ['p1','p2'].forEach(p => {
            const rA = this.app.getVal(`${p}_retireAge`);
            const cS = parseInt(this.app.getRaw(`${p}_cpp_start`));
            const oS = parseInt(this.app.getRaw(`${p}_oas_start`));
            const cE = this.app.state.inputs[`${p}_cpp_enabled`];
            const oE = this.app.state.inputs[`${p}_oas_enabled`];
            
            let cppBase = this.app.getVal(`${p}_cpp_est_base`);
            let cV = engine.calcBen(cppBase, cS, 1, rA, 'cpp');
            
            const eC = document.getElementById(`${p}_cpp_est`); 
            if(eC){ 
                eC.innerText = cE ? `$${Math.round(cV).toLocaleString()}/yr` : "Disabled"; 
                if(cE) eC.classList.remove('text-danger'); else eC.classList.add('text-danger'); 
            }
            
            let oasYears = Math.max(0, Math.min(40, this.app.getVal(`${p}_oas_years`)));
            let oV = this.app.CONSTANTS.MAX_OAS * (oasYears / 40);
            oV = engine.calcBen(oV, oS, 1, 65, 'oas');
            
            const eO = document.getElementById(`${p}_oas_est`); 
            if(eO){ 
                eO.innerText = oE ? `$${Math.round(oV).toLocaleString()}/yr` : "Disabled"; 
                if(oE) eO.classList.remove('text-danger'); else eO.classList.add('text-danger'); 
            }
        });
    }
}
