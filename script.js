/**
 * Retirement Planner Pro - Logic v8.0 (Robust Rendering & Fixes)
 * * CHANGE LOG:
 * 1. FIX: Rendering Issue. 'init()' now checks document.readyState to ensure it runs even if loaded late.
 * 2. FIX: Grid Container creation is now forced if the old table isn't found.
 * 3. LOGIC: Smart Decumulation (Lowest Income First) preserved and verified.
 * 4. UI: $0 lines hidden, Red Expenses, Aligned Details, Split Assets/Taxes preserved.
 */

class RetirementPlanner {
    constructor() {
        // --- CENTRAL STATE ---
        this.state = {
            inputs: {}, 
            debt: [],
            // Default Property:
            properties: [
                { name: "Primary Home", value: 1000000, mortgage: 430000, growth: 3.0, rate: 3.29, payment: 0, manual: false }
            ],
            strategies: {
                accum: ['tfsa', 'rrsp', 'nreg', 'cash', 'crypto'],
                decum: ['rrsp', 'crypto', 'nreg', 'tfsa', 'cash']
            },
            mode: 'Couple',
            projectionData: []
        };

        // --- CONFIGURATION CONSTANTS ---
        this.CONSTANTS = {
            MAX_CPP_2026: 18092,
            MAX_OAS_2026: 8908,
            RRIF_START_AGE: 72, 
            TAX_BRACKETS: {
                FED: [55867, 111733, 173205, 246752], // 2025/2026 approx
                ONT: [51446, 102894, 150000, 220000] 
            }
        };

        this.charts = { nw: null, sankey: null }; 
        this.confirmModal = null; // Store Bootstrap modal instance

        // --- DEFAULT EXPENSE DATA ---
        this.expensesByCategory = {
            "Housing": { 
                items: [ 
                    { name: "Property Tax", curr: 6000, ret: 6000, freq: 1 }, 
                    { name: "Enbridge (Gas)", curr: 120, ret: 120, freq: 12 }, 
                    { name: "Enercare (HWT)", curr: 45, ret: 45, freq: 12 }, 
                    { name: "Alectra (Hydro)", curr: 150, ret: 150, freq: 12 }, 
                    { name: "RH Water", curr: 80, ret: 80, freq: 12 } 
                ], 
                colorClass: 'cat-header-housing' 
            },
            "Living": { 
                items: [ 
                    { name: "Grocery", curr: 800, ret: 800, freq: 12 }, 
                    { name: "Costco", curr: 400, ret: 400, freq: 12 }, 
                    { name: "Restaurants", curr: 400, ret: 300, freq: 12 }, 
                    { name: "Cellphone", curr: 120, ret: 120, freq: 12 }, 
                    { name: "Internet", curr: 90, ret: 90, freq: 12 } 
                ], 
                colorClass: 'cat-header-living' 
            },
            "Kids": { 
                items: [ 
                    { name: "Daycare", curr: 1200, ret: 0, freq: 12 }, 
                    { name: "Activities", curr: 200, ret: 0, freq: 12 }, 
                    { name: "RESP Contribution", curr: 208, ret: 0, freq: 12 }, 
                    { name: "Clothing/Toys", curr: 100, ret: 50, freq: 12 } 
                ], 
                colorClass: 'cat-header-kids' 
            },
            "Lifestyle": { 
                items: [ 
                    { name: "Travel", curr: 5000, ret: 15000, freq: 1 }, 
                    { name: "Electronic", curr: 500, ret: 500, freq: 1 }, 
                    { name: "Health Insurance", curr: 50, ret: 300, freq: 12 }, 
                    { name: "Other", curr: 300, ret: 300, freq: 12 } 
                ], 
                colorClass: 'cat-header-lifestyle' 
            }
        };

        this.optimalAges = { p1_cpp: 65, p1_oas: 65, p2_cpp: 65, p2_oas: 65 };
        this.strategyLabels = { 'tfsa': 'TFSA', 'rrsp': 'RRSP', 'nreg': 'Non-Reg', 'cash': 'Cash', 'crypto': 'Crypto' };

        this.eventIcons = {
            "P1 Retires": '<i class="bi bi-cup-hot-fill text-warning" title="P1 Retires"></i>',
            "P2 Retires": '<i class="bi bi-cup-hot text-purple" title="P2 Retires"></i>',
            "Mortgage Paid": '<i class="bi bi-house-check-fill text-success" title="Mortgage Paid"></i>',
            "P1 CPP": '<i class="bi bi-file-earmark-text-fill text-info" title="P1 Starts CPP"></i>',
            "P1 OAS": '<i class="bi bi-cash-stack text-info" title="P1 Starts OAS"></i>',
            "P2 CPP": '<i class="bi bi-file-earmark-text text-purple" title="P2 Starts CPP"></i>',
            "P2 OAS": '<i class="bi bi-cash text-purple" title="P2 Starts OAS"></i>',
            "Crash": '<i class="bi bi-graph-down-arrow text-danger" title="Stress Test: Market Crash (-15%)"></i>',
            "P1 Dies": '<i class="bi bi-heartbreak-fill text-white" title="P1 Deceased"></i>',
            "P2 Dies": '<i class="bi bi-heartbreak text-white" title="P2 Deceased"></i>'
        };

        if(typeof google !== 'undefined' && google.charts) google.charts.load('current', {'packages':['sankey']});
        this.debouncedRun = this.debounce(() => this.run(), 300);
        this.init();
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    init() {
        // --- 2. SETUP FUNCTION ---
        const setup = () => {
            this.confirmModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
            this.setupGridContainer(); // Ensure Grid Exists
            this.populateAgeSelects();
            this.renderExpenseRows(); 
            this.renderProperties();
            this.addDebtRow(); 
            this.renderStrategy();
            this.loadScenariosList();
             
            this.syncStateFromDOM();
            this.toggleModeDisplay(); 

            this.updateAgeDisplay('p1'); 
            this.updateAgeDisplay('p2');
            this.updateAllMortgages(); 
            this.findOptimal(); 
             
            this.bindEvents();
            this.initSidebar();
             
            // Initial Run
            setTimeout(() => { 
                this.syncStateFromDOM(); 
                this.run(); 
                // this.renderComparisonChart(); 
            }, 500); 
        };

        // --- 3. ROBUST EXECUTION ---
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup(); // Run immediately if already loaded
        }
    }

    // --- CUSTOM CONFIRMATION HELPER ---
    showConfirm(message, onConfirm) {
        const modalEl = document.getElementById('confirmationModal');
        const body = modalEl.querySelector('.modal-body');
        const btn = document.getElementById('btnConfirmAction');
        
        body.textContent = message;
        
        // Remove existing listeners to prevent multiple firings
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            onConfirm();
            this.confirmModal.hide();
        });
        
        this.confirmModal.show();
    }

    setupGridContainer() {
        const gridId = 'projectionGrid';
        if (document.getElementById(gridId)) return; // Already exists

        const oldTableBody = document.getElementById('projectionTableBody');
        let inserted = false;

        if (oldTableBody) {
            const table = oldTableBody.closest('table');
            if (table && table.parentNode) {
                const gridContainer = document.createElement('div');
                gridContainer.id = gridId;
                gridContainer.className = 'modern-grid';
                table.parentNode.insertBefore(gridContainer, table);
                table.style.display = 'none'; // Hide old table
                inserted = true;
            }
        }
        
        if (!inserted) {
            const container = document.querySelector('.card-body') || document.body;
            const gridContainer = document.createElement('div');
            gridContainer.id = gridId;
            gridContainer.className = 'modern-grid';
            container.appendChild(gridContainer);
        }
    }

    // --- DOM / STATE SYNC ---
    syncStateFromDOM() {
        document.querySelectorAll('input, select').forEach(el => {
            // Skip property inputs as they are handled by array state now
            if (el.id && !el.id.startsWith('comp_') && !el.classList.contains('property-update')) {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    this.state.inputs[el.id] = el.checked;
                } else {
                    this.state.inputs[el.id] = el.value;
                }
            }
        });
        const coupleEl = document.getElementById('modeCouple');
        if(coupleEl) this.state.mode = coupleEl.checked ? 'Couple' : 'Single';
    }

    getVal(id) {
        let raw = this.state.inputs[id];
        if (raw === undefined) {
            const el = document.getElementById(id);
            if (el) raw = el.value; else return 0;
        }
        const val = String(raw).replace(/,/g, '');
        return Number(val) || 0;
    }

    getRaw(id) {
        if (this.state.inputs[id] === undefined) {
            const el = document.getElementById(id);
            if (el) return el.value;
        }
        return this.state.inputs[id];
    }

    // --- SYNC HELPER FOR INPUT -> SIDEBAR ---
    updateSidebarSync(id, val) {
        if (id === 'p1_retireAge') {
            const slider = document.getElementById('qa_p1_retireAge_range');
            const label = document.getElementById('qa_p1_retireAge_val');
            if(slider) slider.value = val;
            if(label) label.innerText = val;
        }
        if (id === 'p2_retireAge') {
            const slider = document.getElementById('qa_p2_retireAge_range');
            const label = document.getElementById('qa_p2_retireAge_val');
            if(slider) slider.value = val;
            if(label) label.innerText = val;
        }
        if (id === 'inflation_rate') {
            const slider = document.getElementById('qa_inflation_range');
            const label = document.getElementById('qa_inflation_val');
            if(slider) slider.value = val;
            if(label) label.innerText = val + '%';
        }
        if (id === 'p1_tfsa_ret') {
            const slider = document.getElementById('qa_return_range');
            const label = document.getElementById('qa_return_val');
            if(slider) slider.value = val;
            if(label) label.innerText = val + '%';
        }
    }

    // --- EVENT LISTENERS ---
    bindEvents() {
        const toggle = document.getElementById('useRealDollars');
        if(toggle) toggle.addEventListener('change', () => { this.run(); });

        document.getElementById('btnClearAll').addEventListener('click', () => {
             this.showConfirm("Are you sure you want to clear all data? This cannot be undone.", () => {
                 this.resetAllData();
             });
        });

        document.getElementById('btnAddProperty').addEventListener('click', () => this.addProperty());

        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('live-calc')) {
                if (e.target.classList.contains('formatted-num')) this.formatInput(e.target);
                
                if (e.target.id && !e.target.id.startsWith('comp_') && !e.target.classList.contains('property-update')) {
                    this.state.inputs[e.target.id] = (e.target.type === 'checkbox' ? e.target.checked : e.target.value);
                    this.updateSidebarSync(e.target.id, e.target.value);
                }
                this.debouncedRun();
            }
            if (e.target.classList.contains('expense-update')) {
                const cat = e.target.dataset.cat;
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                let val = e.target.value;
                 
                if (field === 'curr' || field === 'ret') val = Number(val.replace(/,/g, '')) || 0;
                else if (field === 'freq') val = parseInt(val);
                 
                if (this.expensesByCategory[cat] && this.expensesByCategory[cat].items[idx]) {
                    this.expensesByCategory[cat].items[idx][field] = val;
                }
                if (e.target.classList.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun();
            }
            // Property Update Listener
            if (e.target.classList.contains('property-update')) {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                let val = e.target.value;

                if (field === 'value' || field === 'mortgage' || field === 'payment') {
                    val = Number(val.replace(/,/g, '')) || 0;
                } else if (field === 'growth' || field === 'rate') {
                    val = parseFloat(val) || 0;
                }

                if (this.state.properties[idx]) {
                    this.state.properties[idx][field] = val;
                    if(field === 'payment') this.state.properties[idx].manual = true;
                    // Auto-recalc mortgage payment if other fields change
                    if(field !== 'payment' && field !== 'name') {
                        this.state.properties[idx].manual = false;
                        this.calculateSingleMortgage(idx);
                    }
                }
                
                if (e.target.classList.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun();
            }
        });

        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('live-calc') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'radio')) {
                if(e.target.id && !e.target.id.startsWith('comp_')) {
                    this.state.inputs[e.target.id] = (e.target.type === 'checkbox' ? e.target.checked : e.target.value);
                }
                this.findOptimal();
                this.run();
            }
        });

        document.getElementById('p1_dob').addEventListener('change', () => this.updateAgeDisplay('p1'));
        document.getElementById('p2_dob').addEventListener('change', () => this.updateAgeDisplay('p2'));
        
        const modeRadios = document.getElementsByName('planMode');
        modeRadios.forEach(r => r.addEventListener('change', () => { 
            const coupleEl = document.getElementById('modeCouple');
            if(coupleEl) this.state.mode = coupleEl.checked ? 'Couple' : 'Single';
            this.toggleModeDisplay(); 
            this.run();
        }));

        document.getElementById('btnCollapseSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('btnExpandSidebar').addEventListener('click', () => this.toggleSidebar());

        document.getElementById('yearSlider').addEventListener('input', (e) => {
            const index = parseInt(e.target.value);
            if (this.state.projectionData[index]) {
                const d = this.state.projectionData[index];
                document.getElementById('sliderYearDisplay').innerText = d.year;
                
                let ageText = (this.state.mode === 'Couple') ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                document.getElementById('cfAgeDisplay').innerText = ageText;
                
                const rows = document.querySelectorAll('.grid-row-group');
                rows.forEach(r => r.style.backgroundColor = ''); 
                if(rows[index]) {
                    rows[index].style.backgroundColor = 'rgba(255,193,7,0.1)';
                    rows[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                clearTimeout(this.sliderTimeout);
                this.sliderTimeout = setTimeout(() => this.drawSankey(index), 50);
            }
        });

        const tabEl = document.querySelector('button[data-bs-target="#cashflow-pane"]');
        if(tabEl) {
            tabEl.addEventListener('shown.bs.tab', () => {
                const slider = document.getElementById('yearSlider');
                this.drawSankey(parseInt(slider.value));
            });
        }

        document.getElementById('btnAddDebt').addEventListener('click', () => this.addDebtRow());
        document.getElementById('btnSaveScenario').addEventListener('click', () => this.saveScenario());
        
        document.getElementById('compareSelectionArea').addEventListener('change', (e) => {
            if(e.target.type === 'checkbox') {
                /* setTimeout(() => this.renderComparisonChart(), 50); */
            }
        });
        
        document.body.addEventListener('click', (e) => {
            if(e.target.classList.contains('toggle-btn')) {
                this.toggleGroup(e.target.dataset.type);
            }
            if(e.target.classList.contains('opt-apply')) this.applyOpt(e.target.dataset.target);
        });
    }

    resetAllData() {
        const defaults = {
            p1_dob: '1990-01', p2_dob: '1990-01',
            p1_retireAge: '65', p2_retireAge: '65',
            p1_lifeExp: '90', p2_lifeExp: '90',
            inflation_rate: '2.0',
            tax_province: 'ON',
            p1_cash_ret: '2.0', p2_cash_ret: '2.0',
            p1_tfsa_ret: '6.0', p2_tfsa_ret: '6.0',
            p1_rrsp_ret: '6.0', p2_rrsp_ret: '6.0',
            p1_nonreg_ret: '5.0', p2_nonreg_ret: '5.0',
            p1_crypto_ret: '8.0', p2_crypto_ret: '8.0',
            p1_income_growth: '2.0', p2_income_growth: '2.0',
            p1_db_pension: '0', p2_db_pension: '0'
        };

        // Reset Inputs
        document.querySelectorAll('input, select').forEach(el => {
            if(el.id && !el.id.startsWith('comp_') && !el.classList.contains('property-update')) {
                if(defaults[el.id]) {
                    el.value = defaults[el.id];
                } else if (el.type === 'checkbox' || el.type === 'radio') {
                    if(el.name !== 'planMode') el.checked = false;
                } else {
                    el.value = '0';
                }
                 this.state.inputs[el.id] = (el.type === 'checkbox' ? el.checked : el.value);
            }
        });

        // Reset Properties to default
        this.state.properties = [
            { name: "Primary Home", value: 0, mortgage: 0, growth: 3.0, rate: 3.5, payment: 0, manual: false }
        ];
        this.renderProperties();

        // Clear Expenses
        for (const cat in this.expensesByCategory) {
            this.expensesByCategory[cat].items = [];
        }
        this.renderExpenseRows();

        // Clear Debt
        document.getElementById('debt-container').innerHTML = '';
        this.state.debt = [];

        // Sync Sidebar
        this.updateSidebarSync('p1_retireAge', 65);
        this.updateSidebarSync('p2_retireAge', 65);
        this.updateSidebarSync('inflation_rate', 2.0);
        this.updateSidebarSync('p1_tfsa_ret', 6.0);

        this.updateAgeDisplay('p1'); 
        this.updateAgeDisplay('p2');
        this.run();
    }

    // --- PROPERTY LOGIC ---
    renderProperties() {
        const container = document.getElementById('real-estate-container');
        container.innerHTML = '';
        
        this.state.properties.forEach((prop, idx) => {
            const div = document.createElement('div');
            div.className = 'property-row p-3 border border-secondary rounded bg-black bg-opacity-10 mb-3';
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <input type="text" class="form-control form-control-sm bg-transparent border-0 text-white fw-bold property-update" 
                           style="max-width:200px;" value="${prop.name}" data-idx="${idx}" data-field="name">
                    ${idx > 0 ? `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="app.removeProperty(${idx})"><i class="bi bi-x-lg"></i></button>` : ''}
                </div>
                <div class="row g-3">
                    <div class="col-6 col-md-3">
                        <label class="form-label text-muted small">Value</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-black border-secondary text-muted">$</span>
                            <input type="text" class="form-control bg-black border-secondary text-white formatted-num property-update" 
                                   value="${prop.value.toLocaleString()}" data-idx="${idx}" data-field="value">
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label text-muted small">Mortgage</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-black border-secondary text-muted">$</span>
                            <input type="text" class="form-control bg-black border-secondary text-white formatted-num property-update" 
                                   value="${prop.mortgage.toLocaleString()}" data-idx="${idx}" data-field="mortgage">
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label text-muted small">Growth %</label>
                        <div class="input-group input-group-sm">
                            <input type="number" step="0.01" class="form-control bg-black border-secondary text-white property-update" 
                                   value="${prop.growth}" data-idx="${idx}" data-field="growth">
                            <span class="input-group-text bg-black border-secondary text-muted">%</span>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label text-muted small">Rate %</label>
                        <div class="input-group input-group-sm">
                            <input type="number" step="0.01" class="form-control bg-black border-secondary text-white property-update" 
                                   value="${prop.rate}" data-idx="${idx}" data-field="rate">
                            <span class="input-group-text bg-black border-secondary text-muted">%</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-4">
                        <label class="form-label text-warning small">Monthly Pmt</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-warning text-black border-warning fw-bold">$</span>
                            <input type="text" class="form-control bg-black border-warning text-white formatted-num property-update" 
                                   value="${Math.round(prop.payment).toLocaleString()}" data-idx="${idx}" data-field="payment">
                        </div>
                        <div class="mt-1 small" id="prop-payoff-${idx}"></div>
                    </div>
                </div>
            `;
            container.appendChild(div);
            // Re-apply listeners for formatted inputs
            div.querySelectorAll('.formatted-num').forEach(el => {
                el.addEventListener('input', (e) => this.formatInput(e.target));
            });
        });
        
        this.updateAllMortgages();
    }

    addProperty() {
        this.state.properties.push({ name: "New Property", value: 500000, mortgage: 400000, growth: 3.0, rate: 4.0, payment: 0, manual: false });
        this.renderProperties();
        this.run();
    }

    removeProperty(index) {
        this.showConfirm("Remove this property?", () => {
            this.state.properties.splice(index, 1);
            this.renderProperties();
            this.run();
        });
    }

    updateAllMortgages() {
        this.state.properties.forEach((p, idx) => {
            if(!p.manual) this.calculateSingleMortgage(idx);
            this.updatePropPayoffDisplay(idx);
        });
    }

    calculateSingleMortgage(idx) {
        const p = this.state.properties[idx];
        const P = p.mortgage;
        const annualRate = p.rate / 100;
        let monthlyPayment = 0;
        
        if (P > 0 && annualRate > 0) {
            const r = annualRate / 12; const n = 25 * 12;
            monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else if (P > 0) { monthlyPayment = P / (25*12); }
        
        this.state.properties[idx].payment = monthlyPayment;
        
        // Update DOM input to match calc
        const inputs = document.querySelectorAll(`.property-update[data-idx="${idx}"][data-field="payment"]`);
        if(inputs.length > 0) inputs[0].value = Math.round(monthlyPayment).toLocaleString();
    }

    updatePropPayoffDisplay(idx) {
        const p = this.state.properties[idx];
        const el = document.getElementById(`prop-payoff-${idx}`);
        if(!el) return;
        
        if(p.mortgage <= 0) { el.innerHTML = ""; return; }
        const r = (p.rate/100) / 12;
        if(p.payment <= p.mortgage * r) { el.innerHTML = `<span class="text-danger fw-bold">Payment too low</span>`; return; }
        
        const nMonths = -Math.log(1 - (r * p.mortgage) / p.payment) / Math.log(1 + r);
        if(!isNaN(nMonths) && isFinite(nMonths)) {
            const yrs = Math.floor(nMonths/12); const mos = Math.round(nMonths%12);
            el.innerHTML = `<span class="text-success fw-bold">Payoff: ${yrs}y ${mos}m</span>`;
        }
    }

    // Replace old single updateMortgagePayment
    updateMortgagePayment() { this.updateAllMortgages(); }

    // --- ACCORDION HELPER ---
    toggleRow(el) {
        const group = el.parentElement;
        const detail = group.querySelector('.grid-detail-wrapper');
        const isOpen = group.classList.contains('expanded');
        
        if(!isOpen) {
            group.classList.add('expanded');
            detail.classList.add('open');
        } else {
            group.classList.remove('expanded');
            detail.classList.remove('open');
        }
    }

    toggleModeDisplay() {
        const isCouple = this.state.mode === 'Couple';
        document.body.classList.toggle('is-couple', isCouple);
        document.querySelectorAll('.p2-column').forEach(el => {
            if(el.tagName === 'TH' || el.tagName === 'TD') return; 
            el.style.display = isCouple ? 'block' : 'none';
        });
    }

    // --- MAIN ENGINE ---
    run() {
        try {
            this.estimateCPPOAS();
            this.updateIncomeDisplay();
            this.calcExpenses();
            this.generateProjectionTable(); // Populates data & renders
            
            const slider = document.getElementById('yearSlider');
            if (this.state.projectionData.length > 0) {
                let currentVal = parseInt(slider.value);
                const maxIndex = this.state.projectionData.length - 1;
                
                if(currentVal > maxIndex) currentVal = 0;
                slider.max = maxIndex; 
                
                if (currentVal > maxIndex) { slider.value = 0; currentVal = 0; }
                
                const d = this.state.projectionData[currentVal];
                document.getElementById('sliderYearDisplay').innerText = d.year;
                let ageText = (this.state.mode === 'Couple') ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                document.getElementById('cfAgeDisplay').innerText = ageText;

                if(!this.charts.sankey) this.drawSankey(currentVal);
            }
        } catch (e) {
            console.error("Calculation Error:", e);
        }
    }

    // --- SANKEY CHART ---
    drawSankey(index) {
        if (!this.state.projectionData[index] || typeof google === 'undefined' || !google.visualization) return;

        const d = this.state.projectionData[index];
        const rows = [];
        const fmt = (n) => {
            if(n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
            if(n >= 1000) return '$' + Math.round(n/1000) + 'k';
            return '$' + Math.round(n);
        };

        // 1. INFLOWS -> TOTAL POT
        const potName = `Available Cash\n${fmt(d.debugTotalInflow)}`;

        if (d.incomeP1 > 0) rows.push([`Employment P1\n${fmt(d.incomeP1)}`, potName, Math.round(d.incomeP1)]);
        if (d.incomeP2 > 0) rows.push([`Employment P2\n${fmt(d.incomeP2)}`, potName, Math.round(d.incomeP2)]);
        if (d.benefitsP1 > 0) rows.push([`Gov Benefits P1\n${fmt(d.benefitsP1)}`, potName, Math.round(d.benefitsP1)]);
        if (d.benefitsP2 > 0) rows.push([`Gov Benefits P2\n${fmt(d.benefitsP2)}`, potName, Math.round(d.benefitsP2)]);
        
        // Add DB Pension to Sankey if exists
        if (d.dbP1 > 0) rows.push([`DB Pension P1\n${fmt(d.dbP1)}`, potName, Math.round(d.dbP1)]);
        if (d.dbP2 > 0) rows.push([`DB Pension P2\n${fmt(d.dbP2)}`, potName, Math.round(d.dbP2)]);

        if (d.flows && d.flows.withdrawals) {
            for (const [source, amount] of Object.entries(d.flows.withdrawals)) {
                if (amount > 0) rows.push([`${source}\n${fmt(amount)}`, potName, Math.round(amount)]);
            }
        }

        // 2. TOTAL POT -> OUTFLOWS
        const totalTax = d.taxP1 + d.taxP2;
        if (totalTax > 0) rows.push([potName, `Taxes\n${fmt(totalTax)}`, Math.round(totalTax)]);

        if (d.expenses > 0) rows.push([potName, `Living Exp.\n${fmt(d.expenses)}`, Math.round(d.expenses)]);

        const totalDebt = d.mortgagePay + d.debtPay;
        if (totalDebt > 0) rows.push([potName, `Mortgage/Debt\n${fmt(totalDebt)}`, Math.round(totalDebt)]);

        if (d.flows && d.flows.contributions) {
            for (const [target, amount] of Object.entries(d.flows.contributions)) {
                let label = this.strategyLabels[target] || target;
                if (amount > 0) rows.push([potName, `To ${label}\n${fmt(amount)}`, Math.round(amount)]);
            }
        }

        const uniqueNodes = new Set();
        rows.forEach(r => { uniqueNodes.add(r[0]); uniqueNodes.add(r[1]); });
        
        const nodeColors = [];
        uniqueNodes.forEach(node => {
            let color = '#a8a29e'; 
            if (node.includes("Available Cash")) color = '#f59e0b'; 
            else if (node.includes("Employment")) color = '#10b981'; 
            else if (node.includes("Gov Benefits") || node.includes("DB Pension")) color = '#06b6d4'; 
            else if (node.includes("RRIF") || node.includes("TFSA") || node.includes("RRSP") || node.includes("Non-Reg") || node.includes("Crypto") || node.includes("Cash")) {
                if(node.startsWith("To ")) color = '#3b82f6'; else color = '#8b5cf6';
            }
            if (node.includes("Taxes")) color = '#ef4444'; 
            else if (node.includes("Living Exp")) color = '#f97316'; 
            else if (node.includes("Mortgage") || node.includes("Debt")) color = '#dc2626'; 

            nodeColors.push({ node: node, color: color });
        });

        const nodesConfig = Array.from(uniqueNodes).map(name => {
             const cObj = nodeColors.find(n => n.node === name);
             return { color: cObj ? cObj.color : '#888' };
        });

        const container = document.getElementById('sankey_chart');
        const dataTable = new google.visualization.DataTable();
        dataTable.addColumn('string', 'From');
        dataTable.addColumn('string', 'To');
        dataTable.addColumn('number', 'Amount');
        dataTable.addRows(rows);

        const options = {
            sankey: {
                node: { label: { color: '#ffffff', fontSize: 13, bold: true }, nodePadding: 30, width: 12, colors: nodesConfig.map(n => n.color) },
                link: { colorMode: 'gradient', colors: ['#334155', '#475569'] }
            },
            backgroundColor: 'transparent',
            height: 600,
            width: '100%'
        };

        const chart = new google.visualization.Sankey(container);
        chart.draw(dataTable, options);
        this.charts.sankey = chart;
    }

    getRrifFactor(age) {
        if (age < 71) { return 1 / (90 - age); }
        const rates = { 71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582, 76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682, 81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851, 86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192, 91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000 };
        if (age >= 95) return 0.20;
        return rates[age] || 0.0528; 
    }

    // --- PROJECTION GENERATOR (REFACTORED FOR MULTIPLE PROPERTIES) ---
    generateProjectionTable(onlyCalcNW = false) {
        if (!onlyCalcNW) this.state.projectionData = [];
        
        const mode = this.state.mode;
        const province = this.getRaw('tax_province');
        const inflation = this.getVal('inflation_rate') / 100;
        let tfsa_limit = 7000;
        const taxEfficient = this.state.inputs['taxEfficient']; 
        const stressTest = this.state.inputs['stressTestEnabled'];
        const rrspMeltdown = this.state.inputs['strat_rrsp_topup']; 

        const s1_tfsa = this.state.inputs['skip_first_tfsa_p1'];
        const s1_rrsp = this.state.inputs['skip_first_rrsp_p1'];
        const s2_tfsa = this.state.inputs['skip_first_tfsa_p2'];
        const s2_rrsp = this.state.inputs['skip_first_rrsp_p2'];

        let p1 = { tfsa: this.getVal('p1_tfsa'), rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), crypto: this.getVal('p1_crypto'), inc: this.getVal('p1_income'), dob: new Date(this.getRaw('p1_dob')), retAge: this.getVal('p1_retireAge'), lifeExp: this.getVal('p1_lifeExp') };
        let p2 = { tfsa: this.getVal('p2_tfsa'), rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), crypto: this.getVal('p2_crypto'), inc: this.getVal('p2_income'), dob: new Date(this.getRaw('p2_dob')), retAge: this.getVal('p2_retireAge'), lifeExp: this.getVal('p2_lifeExp') };

        const getRate = (id) => this.getVal(id)/100;
        const baseRatesP1 = { tfsa: getRate('p1_tfsa_ret'), rrsp: getRate('p1_rrsp_ret'), cash: getRate('p1_cash_ret'), nreg: getRate('p1_nonreg_ret'), cryp: getRate('p1_crypto_ret'), inc: getRate('p1_income_growth') };
        const baseRatesP2 = { tfsa: getRate('p2_tfsa_ret'), rrsp: getRate('p2_tfsa_ret'), cash: getRate('p2_cash_ret'), nreg: getRate('p2_nonreg_ret'), cryp: getRate('p2_crypto_ret'), inc: getRate('p2_income_growth') };
        
        p1.rates = {...baseRatesP1}; p2.rates = {...baseRatesP2};

        const p1_cpp_start = parseInt(this.getRaw('p1_cpp_start'));
        const p1_oas_start = parseInt(this.getRaw('p1_oas_start'));
        const p2_cpp_start = parseInt(this.getRaw('p2_cpp_start'));
        const p2_oas_start = parseInt(this.getRaw('p2_oas_start'));

        // Get DB Pension Amounts (Monthly -> Annual Base)
        let p1_db_base = this.getVal('p1_db_pension') * 12;
        let p2_db_base = this.getVal('p2_db_pension') * 12;

        let expCurrentStart = 0; let expRetireStart = 0;
        for (const cat in this.expensesByCategory) {
            this.expensesByCategory[cat].items.forEach(item => {
                expCurrentStart += item.curr * item.freq;
                expRetireStart += item.ret * item.freq;
            });
        }

        // Clone Properties so we don't mutate state directly during projection
        let simProperties = JSON.parse(JSON.stringify(this.state.properties));

        let otherDebt = this.getTotalDebt();
        let expCurrent = expCurrentStart; let expRetire = expRetireStart;
        
        const currentYear = new Date().getFullYear();
        const p1_startAge = currentYear - p1.dob.getFullYear();
        const p2_startAge = currentYear - p2.dob.getFullYear();
        const endAge = Math.max(p1.lifeExp, mode==='Couple' ? p2.lifeExp : 0);
        const yearsToRun = endAge - Math.min(p1_startAge, mode==='Couple' ? p2_startAge : p1_startAge);

        let triggeredEvents = new Set();
        let cpp_max_p1 = this.CONSTANTS.MAX_CPP_2026, oas_max_p1 = this.CONSTANTS.MAX_OAS_2026;
        let cpp_max_p2 = this.CONSTANTS.MAX_CPP_2026, oas_max_p2 = this.CONSTANTS.MAX_OAS_2026;
        let finalNW = 0;

        for (let i = 0; i <= yearsToRun; i++) {
            const year = currentYear + i;
            const p1_age = p1_startAge + i; const p2_age = p2_startAge + i;
            
            const p1_alive = p1_age <= p1.lifeExp;
            const p2_alive = (mode === 'Couple') ? (p2_age <= p2.lifeExp) : false;

            if(!p1_alive && !p2_alive) break;

            const bracketInflator = Math.pow(1 + inflation, i);
            const currentFedBrackets = this.CONSTANTS.TAX_BRACKETS.FED.map(b => b * bracketInflator);
            const currentOntBrackets = this.CONSTANTS.TAX_BRACKETS.ONT.map(b => b * bracketInflator);
            
            let currentRatesP1 = {...baseRatesP1}; let currentRatesP2 = {...baseRatesP2};
            let isCrashYear = false;
            
            if (stressTest && p1_age >= p1.retAge && p1_age < p1.retAge + 2) {
                isCrashYear = true;
                const crashRate = -0.15; const crashCrypto = -0.40; 
                ['tfsa', 'rrsp', 'nreg', 'cash'].forEach(k => { currentRatesP1[k] = crashRate; currentRatesP2[k] = crashRate; });
                currentRatesP1.cryp = crashCrypto; currentRatesP2.cryp = crashCrypto;
            }

            let yearContributions = { tfsa: 0, rrsp: 0, nreg: 0, cash: 0, crypto: 0 };
            let yearWithdrawals = {}; 
            let wdBreakdown = { p1: {}, p2: {} }; 
            let w_p1 = { rrsp: 0 }; let w_p2 = { rrsp: 0 }; 

            let events = [];
            if(p1_alive) {
                if(p1_age === p1.retAge && !triggeredEvents.has('P1 Retires')) { events.push(this.eventIcons['P1 Retires']); triggeredEvents.add('P1 Retires'); }
                if(p1_age === p1_cpp_start) events.push(this.eventIcons['P1 CPP']);
                if(p1_age === p1_oas_start) events.push(this.eventIcons['P1 OAS']);
            } else if (!triggeredEvents.has('P1 Dies')) {
                events.push(this.eventIcons['P1 Dies']); triggeredEvents.add('P1 Dies');
            }

            if(mode==='Couple') {
                if(p2_alive) {
                    if(p2_age === p2.retAge && !triggeredEvents.has('P2 Retires')) { events.push(this.eventIcons['P2 Retires']); triggeredEvents.add('P2 Retires'); }
                    if(p2_age === p2_cpp_start) events.push(this.eventIcons['P2 CPP']);
                    if(p2_age === p2_oas_start) events.push(this.eventIcons['P2 OAS']);
                } else if (!triggeredEvents.has('P2 Dies')) {
                    events.push(this.eventIcons['P2 Dies']); triggeredEvents.add('P2 Dies');
                }
            }

            // Calc Total Mortgage & check payoff event
            let totalMortgageBalance = simProperties.reduce((acc, p) => acc + p.mortgage, 0);
            if(totalMortgageBalance <= 0 && !triggeredEvents.has('Mortgage Paid')) { 
                events.push(this.eventIcons['Mortgage Paid']); triggeredEvents.add('Mortgage Paid'); 
            }
            if(isCrashYear) events.push(this.eventIcons['Crash']);

            const p1_isRetired = p1_age >= p1.retAge;
            const p2_isRetired = (mode === 'Couple') ? (p2_age >= p2.retAge) : true;
            
            let fullyRetired = true;
            if(p1_alive && !p1_isRetired) fullyRetired = false;
            if(p2_alive && !p2_isRetired) fullyRetired = false;

            let p1_gross = 0, p2_gross = 0;
            let p1_cpp_inc = 0, p1_oas_inc = 0;
            let p2_cpp_inc = 0, p2_oas_inc = 0;
            let p1_db_inc = 0, p2_db_inc = 0;

            if(p1_alive) {
                if(!p1_isRetired) { p1_gross += p1.inc; p1.inc *= (1 + currentRatesP1.inc); }
                else {
                    // Retired: Add DB Pension (Indexed)
                    p1_db_inc = p1_db_base * bracketInflator;
                }
                if(p1_age >= p1_cpp_start) p1_cpp_inc = this.calcBen(cpp_max_p1, p1_cpp_start, 1.0, p1.retAge);
                if(p1_age >= p1_oas_start) p1_oas_inc = this.calcBen(oas_max_p1, p1_oas_start, 1.0, 65);
            }

            if(mode === 'Couple' && p2_alive) {
                if(!p2_isRetired) { p2_gross += p2.inc; p2.inc *= (1 + currentRatesP2.inc); }
                else {
                    // Retired: Add DB Pension (Indexed)
                    p2_db_inc = p2_db_base * bracketInflator;
                }
                if(p2_age >= p2_cpp_start) p2_cpp_inc = this.calcBen(cpp_max_p2, p2_cpp_start, 1.0, p2.retAge);
                if(p2_age >= p2_oas_start) p2_oas_inc = this.calcBen(oas_max_p2, p2_oas_start, 1.0, 65);
            }

            cpp_max_p1 *= (1 + inflation); oas_max_p1 *= (1 + inflation); 
            cpp_max_p2 *= (1 + inflation); oas_max_p2 *= (1 + inflation);

            // Mandatory RRIF
            let p1_rrif_inc = 0;
            if (p1_alive && p1.rrsp > 0 && p1_age >= this.CONSTANTS.RRIF_START_AGE) {
                const factor = this.getRrifFactor(p1_age);
                p1_rrif_inc = p1.rrsp * factor;
                p1.rrsp -= p1_rrif_inc; 
                if(p1_rrif_inc > 0) {
                      let typeLabel = "RRIF";
                      if(!yearWithdrawals['P1 RRIF']) yearWithdrawals['P1 RRIF'] = 0;
                      yearWithdrawals['P1 RRIF'] += p1_rrif_inc;
                      w_p1.rrsp += p1_rrif_inc;
                      wdBreakdown.p1[typeLabel] = (wdBreakdown.p1[typeLabel] || 0) + p1_rrif_inc;
                }
            }

            let p2_rrif_inc = 0;
            if (mode === 'Couple' && p2_alive && p2.rrsp > 0 && p2_age >= this.CONSTANTS.RRIF_START_AGE) {
                const factor = this.getRrifFactor(p2_age);
                p2_rrif_inc = p2.rrsp * factor;
                p2.rrsp -= p2_rrif_inc;
                if(p2_rrif_inc > 0) {
                      let typeLabel = "RRIF";
                      if(!yearWithdrawals['P2 RRIF']) yearWithdrawals['P2 RRIF'] = 0;
                      yearWithdrawals['P2 RRIF'] += p2_rrif_inc;
                      w_p2.rrsp += p2_rrif_inc;
                      wdBreakdown.p2[typeLabel] = (wdBreakdown.p2[typeLabel] || 0) + p2_rrif_inc;
                }
            }

            let p1_total_taxable = p1_gross + p1_cpp_inc + p1_oas_inc + p1_rrif_inc + p1_db_inc;
            let p2_total_taxable = p2_gross + p2_cpp_inc + p2_oas_inc + p2_rrif_inc + p2_db_inc;

            if (rrspMeltdown) {
                const lowBracketLimit = currentFedBrackets[0]; 
                
                if (p1_alive && p1.rrsp > 0 && p1_total_taxable < lowBracketLimit) {
                    let room = lowBracketLimit - p1_total_taxable;
                    let draw = Math.min(room, p1.rrsp);
                    if(draw > 0) {
                        p1.rrsp -= draw;
                        p1_total_taxable += draw;
                        if(!yearWithdrawals['RRSP Top-Up']) yearWithdrawals['RRSP Top-Up'] = 0;
                        yearWithdrawals['RRSP Top-Up'] += draw;
                        let label = p1_age >= this.CONSTANTS.RRIF_START_AGE ? 'RRIF' : 'RRSP';
                        wdBreakdown.p1[label] = (wdBreakdown.p1[label] || 0) + draw;
                    }
                }
                if (mode === 'Couple' && p2_alive && p2.rrsp > 0 && p2_total_taxable < lowBracketLimit) {
                    let room = lowBracketLimit - p2_total_taxable;
                    let draw = Math.min(room, p2.rrsp);
                    if(draw > 0) {
                        p2.rrsp -= draw;
                        p2_total_taxable += draw;
                        if(!yearWithdrawals['RRSP Top-Up']) yearWithdrawals['RRSP Top-Up'] = 0;
                        yearWithdrawals['RRSP Top-Up'] += draw;
                        let label = p2_age >= this.CONSTANTS.RRIF_START_AGE ? 'RRIF' : 'RRSP';
                        wdBreakdown.p2[label] = (wdBreakdown.p2[label] || 0) + draw;
                    }
                }
            }

            let t1 = p1_alive ? this.calculateTaxDetailed(p1_total_taxable, province, currentFedBrackets, currentOntBrackets) : { totalTax: 0 };
            let t2 = p2_alive ? this.calculateTaxDetailed(p2_total_taxable, province, currentFedBrackets, currentOntBrackets) : { totalTax: 0 };

            let p1_net = p1_alive ? (p1_total_taxable - t1.totalTax) : 0;
            let p2_net = p2_alive ? (p2_total_taxable - t2.totalTax) : 0;
            const householdNet = p1_net + p2_net;

            let annualExp = fullyRetired ? expRetire : expCurrent;
            
            // --- Property Calculations (Loop all properties) ---
            let totalActualMortgageOutflow = 0;
            
            simProperties.forEach(prop => {
                if(prop.mortgage > 0) {
                    // Monthly Calc logic embedded here for annual steps
                    // Annual Interest Approx
                    const annualRate = prop.rate / 100;
                    const annualInterest = prop.mortgage * annualRate;
                    // Annual Payment
                    const annualPmt = prop.payment * 12;
                    
                    let actualOutflow = Math.min(prop.mortgage + annualInterest, annualPmt);
                    
                    if(actualOutflow >= annualInterest) {
                        let principal = actualOutflow - annualInterest;
                        prop.mortgage -= principal;
                    } else {
                        prop.mortgage += (annualInterest - actualOutflow);
                    }
                    totalActualMortgageOutflow += actualOutflow;
                }
                // Growth
                prop.value *= (1 + (prop.growth/100));
            });

            let debtRepayment = 0;
            if(otherDebt > 0) {
                debtRepayment = Math.min(otherDebt, otherDebt * 0.10); 
                otherDebt -= debtRepayment;
            }

            let visualExpenses = annualExp + totalActualMortgageOutflow + debtRepayment;
            let surplus = householdNet - visualExpenses;

            // Growth
            const grow = (bal, rate) => ({ start: bal, growth: bal*rate, end: bal*(1+rate) });
            let g_p1 = { tfsa: grow(p1.tfsa, currentRatesP1.tfsa), rrsp: grow(p1.rrsp, currentRatesP1.rrsp), cryp: grow(p1.crypto, currentRatesP1.cryp), nreg: grow(p1.nreg, currentRatesP1.nreg), cash: grow(p1.cash, currentRatesP1.cash) };
            p1.tfsa=g_p1.tfsa.end; p1.rrsp=g_p1.rrsp.end; p1.crypto=g_p1.cryp.end; p1.nreg=g_p1.nreg.end; p1.cash=g_p1.cash.end;
            
            let g_p2 = { tfsa: grow(p2.tfsa, currentRatesP2.tfsa), rrsp: grow(p2.rrsp, currentRatesP2.rrsp), cryp: grow(p2.crypto, currentRatesP2.cryp), nreg: grow(p2.nreg, currentRatesP2.nreg), cash: grow(p2.cash, currentRatesP2.cash) };
            p2.tfsa=g_p2.tfsa.end; p2.rrsp=g_p2.rrsp.end; p2.crypto=g_p2.cryp.end; p2.nreg=g_p2.nreg.end; p2.cash=g_p2.cash.end;

            if (surplus > 0) {
                let s1 = (mode==='Couple' && p1_alive && p2_alive) ? surplus/2 : (p1_alive ? surplus : 0);
                let s2 = (mode==='Couple' && p1_alive && p2_alive) ? surplus/2 : (p2_alive ? surplus : 0);
                
                this.state.strategies.accum.forEach(type => {
                    if (s1 > 0 && p1_alive) {
                        let fill = 0;
                        if (type === 'tfsa' && (i > 0 || !s1_tfsa)) { fill = Math.min(s1, tfsa_limit); p1.tfsa += fill; yearContributions.tfsa += fill; }
                        else if (type === 'rrsp' && (i > 0 || !s1_rrsp)) { let limit = p1.inc * 0.18; fill = Math.min(s1, limit); p1.rrsp += fill; yearContributions.rrsp += fill; }
                        else if (type === 'nreg') { fill = s1; p1.nreg += fill; yearContributions.nreg += fill; }
                        else if (type === 'cash') { fill = s1; p1.cash += fill; yearContributions.cash += fill; }
                        else if (type === 'crypto') { fill = s1; p1.crypto += fill; yearContributions.crypto += fill; }
                        s1 -= fill;
                    }
                    if (mode==='Couple' && s2 > 0 && p2_alive) {
                        let fill = 0;
                        if (type === 'tfsa' && (i > 0 || !s2_tfsa)) { fill = Math.min(s2, tfsa_limit); p2.tfsa += fill; yearContributions.tfsa += fill; }
                        else if (type === 'rrsp' && (i > 0 || !s2_rrsp)) { let limit = p2.inc * 0.18; fill = Math.min(s2, limit); p2.rrsp += fill; yearContributions.rrsp += fill; }
                        else if (type === 'nreg') { fill = s2; p2.nreg += fill; yearContributions.nreg += fill; }
                        else if (type === 'cash') { fill = s2; p2.cash += fill; yearContributions.cash += fill; }
                        else if (type === 'crypto') { fill = s2; p2.crypto += fill; yearContributions.crypto += fill; }
                        s2 -= fill;
                    }
                });
            } else {
                let deficit = Math.abs(surplus);
                const drain = (acct, amount, type, owner, isRRSP=false) => { 
                    let take = Math.min(acct, amount); 
                    if(take > 0) {
                        if(!yearWithdrawals[type]) yearWithdrawals[type] = 0;
                        yearWithdrawals[type] += take;
                        let label = type.replace('P1 ', '').replace('P2 ', '');
                        if(isRRSP) {
                            const age = owner === 'p1' ? p1_age : p2_age;
                            if(age >= this.CONSTANTS.RRIF_START_AGE) label = 'RRIF';
                            else label = 'RRSP';
                        }
                        wdBreakdown[owner][label] = (wdBreakdown[owner][label] || 0) + take;
                    }
                    return { rem_acct: acct - take, rem_need: amount - take, taken: take }; 
                };
                
                let remainingDeficit = deficit; 
                let taxBracketLimit = currentFedBrackets[0];

                this.state.strategies.decum.forEach(type => {
                    if(remainingDeficit > 0 && p1.cash + p1.tfsa + p1.rrsp + p1.nreg + p1.crypto + (mode==='Couple'?(p2.cash+p2.tfsa+p2.rrsp+p2.nreg+p2.crypto):0) > 0) { 
                        if (type === 'rrsp') {
                            let p1_lower = p1_total_taxable < p2_total_taxable;
                            let p1_room = Math.max(0, taxBracketLimit - p1_total_taxable);
                            let p2_room = Math.max(0, taxBracketLimit - p2_total_taxable);

                            if (p1_lower && p1_alive && p1.rrsp > 0) {
                                let take = Math.min(p1.rrsp, remainingDeficit, p1_room);
                                if(take > 0) {
                                    let res = drain(p1.rrsp, take, 'P1 RRSP', 'p1', true);
                                    p1.rrsp = res.rem_acct; w_p1.rrsp += res.taken; remainingDeficit -= res.taken;
                                    p1_total_taxable += res.taken;
                                }
                            } else if (!p1_lower && mode==='Couple' && p2_alive && p2.rrsp > 0) {
                                let take = Math.min(p2.rrsp, remainingDeficit, p2_room);
                                if(take > 0) {
                                    let res = drain(p2.rrsp, take, 'P2 RRSP', 'p2', true);
                                    p2.rrsp = res.rem_acct; w_p2.rrsp += res.taken; remainingDeficit -= res.taken;
                                    p2_total_taxable += res.taken;
                                }
                            }

                            if (remainingDeficit > 0) {
                                if (p1_lower && mode==='Couple' && p2_alive && p2.rrsp > 0) {
                                    let take = Math.min(p2.rrsp, remainingDeficit, p2_room);
                                    if(take > 0) {
                                        let res = drain(p2.rrsp, take, 'P2 RRSP', 'p2', true);
                                        p2.rrsp = res.rem_acct; w_p2.rrsp += res.taken; remainingDeficit -= res.taken;
                                        p2_total_taxable += res.taken;
                                    }
                                } else if (!p1_lower && p1_alive && p1.rrsp > 0) {
                                    let take = Math.min(p1.rrsp, remainingDeficit, p1_room);
                                    if(take > 0) {
                                        let res = drain(p1.rrsp, take, 'P1 RRSP', 'p1', true);
                                        p1.rrsp = res.rem_acct; w_p1.rrsp += res.taken; remainingDeficit -= res.taken;
                                        p1_total_taxable += res.taken;
                                    }
                                }
                            }

                            if (remainingDeficit > 0) {
                                let split = remainingDeficit / 2;
                                if (mode === 'Single') split = remainingDeficit;

                                if (p1_alive && p1.rrsp > 0) {
                                    let res = drain(p1.rrsp, split, 'P1 RRSP', 'p1', true);
                                    p1.rrsp = res.rem_acct; w_p1.rrsp += res.taken; remainingDeficit -= res.taken;
                                    p1_total_taxable += res.taken;
                                }
                                if (mode === 'Couple' && p2_alive && p2.rrsp > 0) {
                                    let res = drain(p2.rrsp, remainingDeficit, 'P2 RRSP', 'p2', true);
                                    p2.rrsp = res.rem_acct; w_p2.rrsp += res.taken; remainingDeficit -= res.taken;
                                    p2_total_taxable += res.taken;
                                }
                            }
                        } 
                        else {
                           let split = remainingDeficit / 2;
                           if (mode === 'Single') split = remainingDeficit;
                           
                           let d1_part = split;
                           let res1 = {rem_acct: 0, rem_need: d1_part, taken: 0};
                           if(type==='crypto') { res1 = drain(p1.crypto, d1_part, 'P1 Crypto', 'p1'); p1.crypto = res1.rem_acct; }
                           else if(type==='nreg') { res1 = drain(p1.nreg, d1_part, 'P1 Non-Reg', 'p1'); p1.nreg = res1.rem_acct; }
                           else if(type==='tfsa') { res1 = drain(p1.tfsa, d1_part, 'P1 TFSA', 'p1'); p1.tfsa = res1.rem_acct; }
                           else if(type==='cash') { res1 = drain(p1.cash, d1_part, 'P1 Cash', 'p1'); p1.cash = res1.rem_acct; }
                           remainingDeficit -= res1.taken;

                           if (mode === 'Couple') {
                               let d2_part = remainingDeficit;
                               if(d1_part > 0 && res1.taken >= d1_part) d2_part = split;

                               let res2 = {rem_acct: 0, rem_need: d2_part, taken: 0};
                               if(type==='crypto') { res2 = drain(p2.crypto, d2_part, 'P2 Crypto', 'p2'); p2.crypto = res2.rem_acct; }
                               else if(type==='nreg') { res2 = drain(p2.nreg, d2_part, 'P2 Non-Reg', 'p2'); p2.nreg = res2.rem_acct; }
                               else if(type==='tfsa') { res2 = drain(p2.tfsa, d2_part, 'P2 TFSA', 'p2'); p2.tfsa = res2.rem_acct; }
                               else if(type==='cash') { res2 = drain(p2.cash, d2_part, 'P2 Cash', 'p2'); p2.cash = res2.rem_acct; }
                               remainingDeficit -= res2.taken;
                           }
                        }
                    }
                });
                
                if (remainingDeficit > 0) { 
                    if (p1_alive && p1.rrsp > 0) {
                        let res = drain(p1.rrsp, remainingDeficit, 'P1 RRSP (Forced)', 'p1', true); 
                        p1.rrsp = res.rem_acct; p1_total_taxable += res.taken; remainingDeficit -= res.taken;
                    }
                    if (mode==='Couple' && p2_alive && p2.rrsp > 0) {
                        let res = drain(p2.rrsp, remainingDeficit, 'P2 RRSP (Forced)', 'p2', true); 
                        p2.rrsp = res.rem_acct; p2_total_taxable += res.taken; remainingDeficit -= res.taken;
                    }
                }
            }

            t1 = p1_alive ? this.calculateTaxDetailed(p1_total_taxable, province, currentFedBrackets, currentOntBrackets) : { totalTax: 0 };
            t2 = p2_alive ? this.calculateTaxDetailed(p2_total_taxable, province, currentFedBrackets, currentOntBrackets) : { totalTax: 0 };

            // Calc End Year Net Worth
            const p1_tot = p1.tfsa + p1.rrsp + p1.crypto + p1.nreg + p1.cash;
            const p2_tot = mode === 'Couple' ? (p2.tfsa + p2.rrsp + p2.crypto + p2.nreg + p2.cash) : 0;
            const investTot = p1_tot + p2_tot;
            const liquidNW = investTot - otherDebt;
            
            // Total Real Estate Equity
            let totalREValue = simProperties.reduce((acc, p) => acc + p.value, 0);
            let totalREMortgage = simProperties.reduce((acc, p) => acc + p.mortgage, 0);
            
            const nw = liquidNW + (totalREValue - totalREMortgage);
            finalNW = nw;

            if(!onlyCalcNW) {
                let totalWithdrawal = 0;
                for(let k in yearWithdrawals) totalWithdrawal += yearWithdrawals[k];

                let totalGrowth = g_p1.tfsa.growth + g_p1.rrsp.growth + g_p1.cryp.growth + g_p1.nreg.growth + g_p1.cash.growth +
                                (mode==='Couple' ? (g_p2.tfsa.growth + g_p2.rrsp.growth + g_p2.cryp.growth + g_p2.nreg.growth + g_p2.cash.growth) : 0);
                let growthPct = investTot > 0 ? (totalGrowth / (investTot - totalGrowth - surplus)) * 100 : 0;

                this.state.projectionData.push({
                    year: year, p1Age: p1_age, p2Age: mode==='Couple'?p2_age:null,
                    p1Alive: p1_alive, p2Alive: p2_alive,
                    incomeP1: p1_gross, incomeP2: p2_gross, 
                    benefitsP1: p1_cpp_inc + p1_oas_inc, benefitsP2: p2_cpp_inc + p2_oas_inc, 
                    cppP1: p1_cpp_inc, cppP2: p2_cpp_inc,
                    oasP1: p1_oas_inc, oasP2: p2_oas_inc,
                    dbP1: p1_db_inc, dbP2: p2_db_inc,
                    taxP1: t1.totalTax, taxP2: t2.totalTax,
                    p1Net: p1_net, p2Net: p2_net,
                    expenses: annualExp, mortgagePay: totalActualMortgageOutflow, debtPay: debtRepayment, 
                    surplus: surplus, drawdown: surplus < 0 ? Math.abs(surplus) : 0,
                    debugNW: nw, debugTotalInflow: (p1_gross + p2_gross + p1_cpp_inc + p1_oas_inc + p2_cpp_inc + p2_oas_inc + p1_db_inc + p2_db_inc + totalWithdrawal),
                    assetsP1: {...p1}, assetsP2: {...p2},
                    wdBreakdown: wdBreakdown,
                    inv_tfsa: p1.tfsa + p2.tfsa, inv_rrsp: p1.rrsp + p2.rrsp, inv_cash: p1.cash + p2.cash, inv_nreg: p1.nreg + p2.nreg, inv_crypto: p1.crypto + p2.crypto,
                    flows: { contributions: yearContributions, withdrawals: yearWithdrawals },
                    totalGrowth: totalGrowth, growthPct: growthPct,
                    events: events,
                    householdNet: householdNet, visualExpenses: visualExpenses, 
                    mortgage: totalREMortgage, 
                    homeValue: totalREValue, 
                    investTot: investTot, liquidNW: liquidNW, isCrashYear: isCrashYear
                });
            }
            expCurrent *= (1 + inflation); expRetire *= (1 + inflation); tfsa_limit *= (1 + inflation);
        }

        if (!onlyCalcNW) {
            let html = `
                <div class="grid-header">
                    <div class="col-start col-timeline">Timeline</div>
                    <div class="col-start">Status</div>
                    <div>Net Income</div>
                    <div class="text-danger">Expenses</div>
                    <div>Surplus</div>
                    <div>Net Worth</div>
                    <div class="text-center"><i class="bi bi-chevron-bar-down"></i></div>
                </div>
            `;
            
            this.state.projectionData.forEach((d, idx) => {
                const df = this.getDiscountFactor(idx);
                const fmtK = (num) => { 
                    const val = num / df; 
                    const abs = Math.abs(val); 
                    if (Math.round(abs) === 0) return ''; 
                    const sign = val < 0 ? '-' : ''; 
                    if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + 'M'; 
                    if (abs >= 1000) return sign + Math.round(abs / 1000) + 'k'; 
                    return sign + abs.toFixed(0); 
                };

                const p1AgeDisplay = d.p1Alive ? d.p1Age : '†';
                const p2AgeDisplay = mode==='Couple' ? (d.p2Alive ? d.p2Age : '†') : '';
                
                let status = '';
                const p1Ret = d.p1Age >= p1.retAge;
                const p2Ret = mode === 'Couple' ? (d.p2Age >= p2.retAge) : true; 

                if (mode === 'Couple') {
                    if (!p1Ret && !p2Ret) {
                        status = `<span class="status-pill status-working">Working</span>`;
                    } else if ((p1Ret && !p2Ret) || (!p1Ret && p2Ret)) {
                        status = `<span class="status-pill status-semi">Transition</span>`;
                    } else {
                        if (d.p1Age < 70) {
                            status = `<span class="status-pill status-gogo">Go-go Phase</span>`;
                        } else if (d.p1Age < 80) {
                            status = `<span class="status-pill status-slow">Slow-go Phase</span>`;
                        } else {
                            status = `<span class="status-pill status-nogo">No-go Phase</span>`;
                        }
                    }
                } else {
                    if (!p1Ret) {
                        status = `<span class="status-pill status-working">Working</span>`;
                    } else {
                        if (d.p1Age < 70) {
                            status = `<span class="status-pill status-gogo">Go-go Phase</span>`;
                        } else if (d.p1Age < 80) {
                            status = `<span class="status-pill status-slow">Slow-go Phase</span>`;
                        } else {
                            status = `<span class="status-pill status-nogo">No-go Phase</span>`;
                        }
                    }
                }

                const surplusClass = d.surplus < 0 ? 'val-negative' : 'val-positive';
                const surplusSign = d.surplus > 0 ? '+' : '';

                const line = (label, val, className='') => {
                    if(!val || Math.round(val) === 0) return '';
                    return `<div class="detail-item"><span>${label}</span> <span class="${className}">${fmtK(val)}</span></div>`;
                };
                const subLine = (label, val) => {
                    if(!val || Math.round(val) === 0) return '';
                    return `<div class="detail-item sub"><span>${label}</span> <span>${fmtK(val)}</span></div>`;
                };

                let incomeLines = '';
                incomeLines += line("Employment P1", d.incomeP1);
                if(mode==='Couple') incomeLines += line("Employment P2", d.incomeP2);
                
                if (d.benefitsP1 + d.benefitsP2 > 0) {
                    incomeLines += subLine("CPP/OAS P1", d.cppP1 + d.oasP1);
                    if(mode==='Couple') incomeLines += subLine("CPP/OAS P2", d.cppP2 + d.oasP2);
                }
                
                // Add DB Pension Lines
                if (d.dbP1 > 0) incomeLines += subLine("DB Pension P1", d.dbP1);
                if (d.dbP2 > 0) incomeLines += subLine("DB Pension P2", d.dbP2);
                
                for(const [type, amt] of Object.entries(d.wdBreakdown.p1)) {
                    incomeLines += subLine(`${type} W/D P1`, amt);
                }
                if(mode==='Couple') {
                    for(const [type, amt] of Object.entries(d.wdBreakdown.p2)) {
                        incomeLines += subLine(`${type} W/D P2`, amt);
                    }
                }

                let incomeDetails = `
                    <div class="detail-box">
                        <div class="detail-title">Income Sources</div>
                        ${incomeLines}
                        <div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;">
                            <span class="text-white">Total Net</span> <span class="text-success fw-bold">${fmtK(d.householdNet)}</span>
                        </div>
                    </div>`;

                let expenseLines = '';
                expenseLines += line("Living Exp", d.expenses);
                expenseLines += line("Mortgage", d.mortgagePay);
                expenseLines += line("Debt Repayment", d.debtPay);
                expenseLines += line("Tax Paid P1", d.taxP1, "val-negative");
                if(mode==='Couple') expenseLines += line("Tax Paid P2", d.taxP2, "val-negative");

                let expenseDetails = `
                    <div class="detail-box">
                        <div class="detail-title">Outflows & Taxes</div>
                        ${expenseLines}
                        <div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;">
                            <span class="text-white">Total Out</span> <span class="text-danger fw-bold">${fmtK(d.visualExpenses)}</span>
                        </div>
                    </div>`;

                let p1Assets = d.assetsP1;
                let p2Assets = d.assetsP2;
                let p1R_Label = d.p1Age >= this.CONSTANTS.RRIF_START_AGE ? 'RRIF P1' : 'RRSP P1';
                let p2R_Label = d.p2Age >= this.CONSTANTS.RRIF_START_AGE ? 'RRIF P2' : 'RRSP P2';

                let assetLines = '';
                assetLines += line("TFSA P1", p1Assets.tfsa);
                if(mode==='Couple') assetLines += line("TFSA P2", p2Assets.tfsa);
                
                assetLines += line(p1R_Label, p1Assets.rrsp);
                if(mode==='Couple') assetLines += line(p2R_Label, p2Assets.rrsp);
                
                assetLines += line("Non-Reg P1", p1Assets.nreg);
                if(mode==='Couple') assetLines += line("Non-Reg P2", p2Assets.nreg);
                
                assetLines += line("Cash P1", p1Assets.cash);
                if(mode==='Couple') assetLines += line("Cash P2", p2Assets.cash);
                
                assetLines += line("Liquid Net Worth", d.liquidNW, "text-info fw-bold"); 
                assetLines += line("Real Estate Eq.", d.homeValue - d.mortgage);

                let assetDetails = `
                    <div class="detail-box">
                        <div class="detail-title">Assets (End of Year)</div>
                        ${assetLines}
                        <div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;">
                            <span class="text-white">Total NW</span> <span class="text-info fw-bold">${fmtK(d.debugNW)}</span>
                        </div>
                    </div>`;

                html += `
                    <div class="grid-row-group">
                        <div class="grid-summary-row" onclick="app.toggleRow(this)">
                            <div class="col-start col-timeline">
                                <div class="d-flex align-items-center">
                                    <span class="year-badge me-1">${d.year}</span>
                                    <span class="event-icons-inline">${d.events.join('')}</span>
                                </div>
                                <span class="age-text">${p1AgeDisplay} ${mode==='Couple' ? '/ '+p2AgeDisplay : ''}</span>
                            </div>
                            <div class="col-start">${status}</div>
                            <div class="val-positive">${fmtK(d.householdNet)}</div>
                            <div class="val-neutral text-danger">${fmtK(d.visualExpenses)}</div>
                            <div class="${surplusClass}">${surplusSign}${fmtK(d.surplus)}</div>
                            <div class="text-white fw-bold">${fmtK(d.debugNW)}</div>
                            <div class="text-center toggle-icon"><i class="bi bi-chevron-down"></i></div>
                        </div>
                        <div class="grid-detail-wrapper">
                            <div class="detail-container">
                                ${incomeDetails}
                                ${expenseDetails}
                                ${assetDetails}
                            </div>
                        </div>
                    </div>
                `;
            });

            const gridContainer = document.getElementById('projectionGrid');
            if(gridContainer) gridContainer.innerHTML = html;
        }
        return finalNW;
    }

    // --- Helpers ---

    calcBen(maxVal, startAge, pct, retAge) {
        let val = maxVal * pct;
        let mDiff = (startAge - 65) * 12;
        if(mDiff < 0) val *= (1 - (Math.abs(mDiff)*0.006));
        else val *= (1 + (mDiff*0.007));
        if(retAge < 60) {
             let zeroYears = 65 - retAge; 
             let penalizable = Math.max(0, zeroYears - 8);
             let factor = (39 - penalizable) / 39; 
             val *= Math.max(0, factor);
        }
        return val;
    }

    calculateTaxDetailed(income, province, fedBrackets = null, ontBrackets = null) {
        if(income <= 0) return { fed: 0, prov: 0, cpp_ei: 0, totalTax: 0, margRate: 0 };
        
        const FED = fedBrackets || this.CONSTANTS.TAX_BRACKETS.FED;
        const ONT = ontBrackets || this.CONSTANTS.TAX_BRACKETS.ONT;

        let fed = 0, margFed = 0;
        if (income <= FED[0]) { fed += income * 0.14; margFed = 0.14; }
        else {
            fed += FED[0] * 0.14;
            if (income <= FED[1]) { fed += (income - FED[0]) * 0.205; margFed = 0.205; }
            else {
                fed += (FED[1] - FED[0]) * 0.205;
                if (income <= FED[2]) { fed += (income - FED[1]) * 0.26; margFed = 0.26; }
                else {
                    fed += (FED[2] - FED[1]) * 0.26;
                    if (income <= FED[3]) { fed += (income - FED[2]) * 0.29; margFed = 0.29; }
                    else {
                        fed += (FED[3] - FED[2]) * 0.29;
                        fed += (income - FED[3]) * 0.33; margFed = 0.33;
                    }
                }
            }
        }

        let prov = 0, margProv = 0;
        if(province === 'ON') {
             if(income <= ONT[0]) { prov += income * 0.0505; margProv = 0.0505; }
             else {
                 prov += ONT[0] * 0.0505;
                 if(income <= ONT[1]) { prov += (income - ONT[0]) * 0.0915; margProv = 0.0915; }
                 else {
                     prov += (ONT[1] - ONT[0]) * 0.0915;
                     if(income <= ONT[2]) { prov += (income - ONT[1]) * 0.1116; margProv = 0.1116; }
                     else {
                         prov += (ONT[2] - ONT[1]) * 0.1116;
                         if(income <= ONT[3]) { prov += (income - ONT[2]) * 0.1216; margProv = 0.1216; }
                         else {
                             prov += (ONT[3] - ONT[2]) * 0.1216;
                             prov += (income - ONT[3]) * 0.1316; margProv = 0.1316;
                         }
                     }
                 }
             }

             let surtax = 0; let surtaxRate = 0;
             if(prov > 5400) { surtax += (prov - 5400) * 0.20; surtaxRate += 0.20; }
             if(prov > 7100) { surtax += (prov - 7100) * 0.36; surtaxRate += 0.36; }
             if(surtaxRate > 0) margProv = margProv * (1 + surtaxRate);
             prov += surtax;
             let health = 0; if(income > 20000) health = Math.min(900, (income-20000)*0.06); prov += health;
        } else { prov = income * 0.10; margProv = 0.10; }

        let cpp = 0; const ympe = 74600; const yampe = 85000;
        if(income > 3500) cpp += (Math.min(income, ympe) - 3500) * 0.0595;
        if(income > ympe) cpp += (Math.min(income, yampe) - ympe) * 0.04;
        let ei = Math.min(income, 68900) * 0.0164;
        return { fed: fed, prov: prov, cpp_ei: cpp + ei, totalTax: fed + prov + cpp + ei, margRate: margFed + margProv };
    }

    updateAgeDisplay(prefix) {
        const dobInput = this.getRaw(prefix + '_dob');
        const el = document.getElementById(prefix + '_age');
        if (!dobInput) { el.innerHTML = "--"; return; }
        const dob = new Date(dobInput + "-01"); 
        const age = new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970;
        el.innerHTML = Math.abs(age) + " years old";
    }

    toggleModeDisplay() {
        const isCouple = this.state.mode === 'Couple';
        document.body.classList.toggle('is-couple', isCouple);
        document.querySelectorAll('.p2-column').forEach(el => {
            if(el.tagName === 'TH' || el.tagName === 'TD') return; 
            el.style.display = isCouple ? 'block' : 'none';
        });
    }

    toggleSidebar() {
        const expanded = document.getElementById('sidebarExpanded');
        const collapsed = document.getElementById('sidebarCollapsed');
        const sidebarCol = document.getElementById('sidebarCol');
        if(expanded.style.display === 'none') {
            expanded.style.display = 'block';
            collapsed.style.display = 'none';
            sidebarCol.style.width = '320px';
        } else {
            expanded.style.display = 'none';
            collapsed.style.display = 'block'; 
            sidebarCol.style.width = '50px';
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }

    renderExpenseRows() {
        const tbody = document.getElementById('expenseTableBody'); let html = '';
        const catMeta = {
            "Housing": { icon: "bi-house-door-fill", color: "text-primary" },
            "Living": { icon: "bi-basket2-fill", color: "text-success" },
            "Kids": { icon: "bi-balloon-heart-fill", color: "text-warning" },
            "Lifestyle": { icon: "bi-airplane-engines-fill", color: "text-info" }
        };

        for (const [category, data] of Object.entries(this.expensesByCategory)) {
           const meta = catMeta[category] || { icon: "bi-tag-fill", color: "text-white" };
           
           html += `
           <tr class="expense-category-row">
               <td colspan="3" class="py-3 ps-3 border-bottom border-secondary bg-black bg-opacity-25">
                   <div class="d-flex align-items-center justify-content-between">
                       <div class="d-flex align-items-center">
                           <i class="bi ${meta.icon} ${meta.color} me-2 fs-6"></i>
                           <span class="text-uppercase fw-bold ${meta.color} small" style="letter-spacing: 1px;">${category}</span>
                       </div>
                       <button type="button" class="btn btn-sm btn-link text-white p-0 me-3" title="Add Row" onclick="app.addExpense('${category}')">
                           <i class="bi bi-plus-circle-fill text-success fs-5"></i>
                       </button>
                   </div>
               </td>
           </tr>`;
           
           data.items.forEach((item, index) => {
             html += `
             <tr class="expense-row">
                <td class="ps-3 align-middle border-bottom border-secondary">
                    <input type="text" class="form-control form-control-sm bg-transparent border-0 text-white-50 expense-update" 
                           value="${item.name}" data-cat="${category}" data-idx="${index}" data-field="name">
                </td>
                <td class="align-middle border-bottom border-secondary">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-black border-secondary text-muted">$</span>
                        <input type="text" class="form-control bg-black border-secondary text-white formatted-num expense-update" 
                               style="width: 100px; flex-grow: 0;" value="${item.curr.toLocaleString()}" data-cat="${category}" data-idx="${index}" data-field="curr">
                        <select class="form-select bg-black border-secondary text-white expense-update" style="width: auto; flex-grow: 0; padding-right: 0;"
                                data-cat="${category}" data-idx="${index}" data-field="freq">
                            <option value="12" ${item.freq===12?'selected':''}>/month</option>
                            <option value="1" ${item.freq===1?'selected':''}>/year</option>
                        </select>
                    </div>
                </td>
                <td class="align-middle border-bottom border-secondary">
                    <div class="d-flex align-items-center">
                        <div class="input-group input-group-sm flex-grow-1">
                            <span class="input-group-text bg-black border-secondary text-muted">$</span>
                            <input type="text" class="form-control bg-black border-secondary text-white formatted-num expense-update" 
                                   style="width: 100px; flex-grow: 0;" value="${item.ret.toLocaleString()}" data-cat="${category}" data-idx="${index}" data-field="ret">
                            <select class="form-select bg-black border-secondary text-white expense-update" style="width: auto; flex-grow: 0; padding-right: 0;"
                                    data-cat="${category}" data-idx="${index}" data-field="freq"> 
                                <option value="12" ${item.freq===12?'selected':''}>/month</option>
                                <option value="1" ${item.freq===1?'selected':''}>/year</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-3 me-2" title="Delete Line" onclick="app.removeExpense('${category}', ${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
             </tr>`;
           });
        }
        tbody.innerHTML = html;
        document.querySelectorAll('.expense-update').forEach(el => {
            if(el.classList.contains('formatted-num')) {
               el.addEventListener('input', (e) => this.formatInput(e.target));
            }
        });
    }

    addExpense(category) {
        this.expensesByCategory[category].items.push({ name: "New Expense", curr: 0, ret: 0, freq: 12 });
        this.renderExpenseRows();
        this.run();
    }

    removeExpense(category, index) {
        this.showConfirm('Delete this expense line?', () => {
            this.expensesByCategory[category].items.splice(index, 1);
            this.renderExpenseRows();
            this.run();
        });
    }

    addDebtRow() {
        const container = document.getElementById('debt-container');
        const div = document.createElement('div');
        div.className = 'row g-3 mb-2 align-items-center debt-row';
        div.innerHTML = `<div class="col-12 col-md-5"><input type="text" class="form-control form-control-sm" placeholder="Debt Name (e.g. LOC)"></div><div class="col-8 col-md-4"><div class="input-group input-group-sm"><span class="input-group-text">$</span><input type="text" class="form-control formatted-num live-calc debt-amount" value="0"></div></div><div class="col-4 col-md-3"><button type="button" class="btn btn-outline-danger btn-sm w-100"><i class="bi bi-trash"></i></button></div>`;
        container.appendChild(div);
        
        const input = div.querySelector('.debt-amount');
        input.addEventListener('input', (e) => { this.formatInput(e.target); this.debouncedRun(); });
        div.querySelector('.btn-outline-danger').addEventListener('click', () => { div.remove(); this.debouncedRun(); });
    }

    // --- 5. RENDER STRATEGY (WITH OPTIMIZATION CARD) ---
    renderStrategy() {
        // Accumulation
        this.renderList('strat-accum-list', this.state.strategies.accum, 'accum', document.getElementById('strat-accum-container'));
        
        // Decumulation Area
        const decumContainer = document.getElementById('strat-decumulation');
        decumContainer.innerHTML = ''; // Clear prev
        
        // A. OPTIMIZATION CARD
        const optCard = document.createElement('div');
        optCard.className = 'card bg-black border-secondary mb-3';
        optCard.innerHTML = `
            <div class="card-header border-secondary text-uppercase small fw-bold text-muted bg-dark bg-opacity-50">
                <i class="bi bi-stars text-warning me-2"></i>Optimization Strategies
            </div>
            <div class="card-body p-3">
                <div class="form-check form-switch">
                    <input class="form-check-input live-calc" type="checkbox" role="switch" id="strat_rrsp_topup" ${this.state.inputs['strat_rrsp_topup'] ? 'checked' : ''}>
                    <label class="form-check-label text-white small fw-bold" for="strat_rrsp_topup">
                        RRSP Low-Income Top-Up
                        <div class="text-muted fw-normal mt-1" style="font-size:0.75rem; line-height: 1.2;">
                            Withdraws RRSP to fill the lowest tax bracket (~$55k) in years with low income. Funds are reinvested automatically.
                        </div>
                    </label>
                </div>
            </div>
        `;
        decumContainer.appendChild(optCard);

        // B. Decumulation List Title
        const title = document.createElement('h6');
        title.className = "text-white small fw-bold mb-2 text-uppercase";
        title.innerText = "Withdrawal Order (Drag to Reorder)";
        decumContainer.appendChild(title);

        // C. Draggable List
        this.renderList('strat-decum-list', this.state.strategies.decum, 'decum', decumContainer);
    }

    renderList(listId, array, type, container) {
        let list = document.getElementById(listId);
        if(!list) {
            const ul = document.createElement('ul');
            ul.id = listId;
            ul.className = 'strategy-list p-0 m-0';
            ul.style.listStyle = 'none';
            container.appendChild(ul);
            list = ul;
        } else {
            list.innerHTML = '';
        }
        
        array.forEach((key, index) => {
            const li = document.createElement('li');
            li.className = 'strat-item';
            li.draggable = true;
            li.setAttribute('data-key', key);
            li.innerHTML = `<span class="fw-bold text-white small"><span class="badge bg-secondary me-2 rounded-circle">${index + 1}</span> ${this.strategyLabels[key]}</span> <i class="bi bi-grip-vertical grip-icon fs-5"></i>`;
            
            li.addEventListener('dragstart', () => { li.classList.add('dragging'); li.style.opacity = '0.5'; });
            li.addEventListener('dragend', () => { 
                li.classList.remove('dragging'); 
                li.style.opacity = '1';
                this.updateArrayOrder(listId, type);
                this.run();
            });
            list.appendChild(li);
        });
        
        list.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(list, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) { list.appendChild(draggable); } 
            else { list.insertBefore(draggable, afterElement); }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.strat-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateArrayOrder(listId, type) {
        const list = document.getElementById(listId);
        const newOrder = [];
        list.querySelectorAll('.strat-item').forEach(item => {
            newOrder.push(item.getAttribute('data-key'));
        });
        if(type === 'accum') this.state.strategies.accum = newOrder;
        else this.state.strategies.decum = newOrder;
        this.renderStrategy(); // Re-render to keep indices correct
    }

    getDiscountFactor(yearIdx) {
        if (!document.getElementById('useRealDollars').checked) return 1;
        const inflation = this.getVal('inflation_rate') / 100;
        return Math.pow(1 + inflation, yearIdx);
    }

    formatInput(el) { 
        let val = el.value.replace(/,/g, ''); 
        if(!isNaN(val) && val !== '') { el.value = Number(val).toLocaleString('en-US'); } 
    }

    toggleGroup(type) {
        const btn = document.querySelector(`span[data-type="${type}"]`);
        const isCurrentlyShown = document.body.classList.contains(`show-${type}`);
        if(isCurrentlyShown) {
            document.body.classList.remove(`show-${type}`);
            btn.innerText = '[+]';
        } else {
            document.body.classList.add(`show-${type}`);
            btn.innerText = '[-]';
        }
    }

    restoreDetailsState() {
        ['inv', 'inc', 'exp'].forEach(type => {
            const isShown = document.body.classList.contains(`show-${type}`);
            const btn = document.querySelector(`span[data-type="${type}"]`);
            if(btn) btn.innerText = isShown ? '[-]' : '[+]';
        });
    }

    // --- Optimization Helpers ---

    findOptimal() {
        const p1CPP = document.getElementById('p1_cpp_start');
        const p1OAS = document.getElementById('p1_oas_start');
        
        let maxNW = -Infinity; let bestC = 65; let bestO = 65;
        const origC = p1CPP.value; const origO = p1OAS.value;

        for(let c=60; c<=70; c+=5) {
            for(let o=65; o<=70; o+=5) {
                this.state.inputs['p1_cpp_start'] = c;
                this.state.inputs['p1_oas_start'] = o;
                const nw = this.generateProjectionTable(true);
                if(nw > maxNW) { maxNW = nw; bestC = c; bestO = o; }
            }
        }
        this.optimalAges.p1_cpp = bestC; this.optimalAges.p1_oas = bestO;
        this.state.inputs['p1_cpp_start'] = origC;
        this.state.inputs['p1_oas_start'] = origO;

        document.getElementById('p1_cpp_opt').innerHTML = `Optimal: Age ${bestC} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="p1_cpp">Apply</a>)`;
        document.getElementById('p1_oas_opt').innerHTML = `Optimal: Age ${bestO} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="p1_oas">Apply</a>)`;

        if(this.state.mode === 'Couple') {
            const p2CPP = document.getElementById('p2_cpp_start');
            const p2OAS = document.getElementById('p2_oas_start');
            const origC2 = p2CPP.value; const origO2 = p2OAS.value;
            
            maxNW = -Infinity; bestC = 65; bestO = 65;
            for(let c=60; c<=70; c+=5) {
                for(let o=65; o<=70; o+=5) {
                    this.state.inputs['p2_cpp_start'] = c;
                    this.state.inputs['p2_oas_start'] = o;
                    const nw = this.generateProjectionTable(true);
                    if(nw > maxNW) { maxNW = nw; bestC = c; bestO = o; }
                }
            }
            this.optimalAges.p2_cpp = bestC; this.optimalAges.p2_oas = bestO;
            this.state.inputs['p2_cpp_start'] = origC2;
            this.state.inputs['p2_oas_start'] = origO2;

            document.getElementById('p2_cpp_opt').innerHTML = `Optimal: Age ${bestC} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="p2_cpp">Apply</a>)`;
            document.getElementById('p2_oas_opt').innerHTML = `Optimal: Age ${bestO} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="p2_oas">Apply</a>)`;
        }
    }

    applyOpt(target) {
        if(target === 'p1_cpp') { document.getElementById('p1_cpp_start').value = this.optimalAges.p1_cpp; this.state.inputs['p1_cpp_start'] = this.optimalAges.p1_cpp; }
        if(target === 'p1_oas') { document.getElementById('p1_oas_start').value = this.optimalAges.p1_oas; this.state.inputs['p1_oas_start'] = this.optimalAges.p1_oas; }
        if(target === 'p2_cpp') { document.getElementById('p2_cpp_start').value = this.optimalAges.p2_cpp; this.state.inputs['p2_cpp_start'] = this.optimalAges.p2_cpp; }
        if(target === 'p2_oas') { document.getElementById('p2_oas_start').value = this.optimalAges.p2_oas; this.state.inputs['p2_oas_start'] = this.optimalAges.p2_oas; }
        this.run();
    }

    estimateCPPOAS() {
        const update = (prefix) => {
            const retAge = this.getVal(prefix+'_retireAge');
            const cppStart = parseInt(this.getRaw(prefix+'_cpp_start'));
            const oasStart = parseInt(this.getRaw(prefix+'_oas_start'));
            
            let cppVal = this.CONSTANTS.MAX_CPP_2026;
            let mDiff = (cppStart - 65) * 12;
            if(mDiff < 0) cppVal *= (1 - (Math.abs(mDiff)*0.006));
            else cppVal *= (1 + (mDiff*0.007));
            
            if(retAge < 60) {
                let zeroYears = 65 - retAge; 
                let penalizable = Math.max(0, zeroYears - 8);
                let factor = (39 - penalizable) / 39; 
                cppVal *= Math.max(0, factor);
            }
            const elCPP = document.getElementById(prefix+'_cpp_est');
            if(elCPP) elCPP.innerText = `Est: $${Math.round(cppVal).toLocaleString()}/yr`;

            let oasVal = this.CONSTANTS.MAX_OAS_2026;
            let oDiff = (oasStart - 65) * 12;
            if(oDiff > 0) oasVal *= (1 + (oDiff * 0.006));
            const elOAS = document.getElementById(prefix+'_oas_est');
            if(elOAS) elOAS.innerText = `Est: $${Math.round(oasVal).toLocaleString()}/yr`;
        }
        update('p1');
        update('p2');
    }

    updateIncomeDisplay() {
        const prov = this.getRaw('tax_province');
        const p1Inc = this.getVal('p1_income'); 
        const p2Inc = this.getVal('p2_income');
        const mode = this.state.mode;
        
        const hhGross = mode === 'Couple' ? p1Inc + p2Inc : p1Inc;
        const grossEl = document.getElementById('household_gross_display');
        if(grossEl) grossEl.innerHTML = '$' + hhGross.toLocaleString() + ` <span class="monthly-sub">($${Math.round(hhGross/12).toLocaleString()}/mo)</span>`;
        
        const p1Data = this.calculateTaxDetailed(p1Inc, prov); 
        this.renderTaxDetails('p1', p1Inc, p1Data);
        
        const p2Data = this.calculateTaxDetailed(p2Inc, prov); 
        this.renderTaxDetails('p2', p2Inc, p2Data);
        
        const hhNet = (p1Inc - p1Data.totalTax) + (mode === 'Couple' ? (p2Inc - p2Data.totalTax) : 0);
        const netEl = document.getElementById('household_net_display');
        if(netEl) netEl.innerHTML = '$' + Math.round(hhNet).toLocaleString() + ` <span class="monthly-sub">($${Math.round(hhNet/12).toLocaleString()}/mo)</span>`;
        return hhNet;
    }

    renderTaxDetails(prefix, gross, data) {
        const container = document.getElementById(prefix + '_tax_details');
        if (!container) return;
        if(gross > 0) {
            container.innerHTML = `
                <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Federal Tax</span> <span class="text-white">($${Math.round(data.fed).toLocaleString()}) ${((data.fed/gross)*100).toFixed(1)}%</span></div>
                <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Provincial Tax</span> <span class="text-white">($${Math.round(data.prov).toLocaleString()}) ${((data.prov/gross)*100).toFixed(1)}%</span></div>
                <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">CPP/EI Premiums</span> <span class="text-white">($${Math.round(data.cpp_ei).toLocaleString()})</span></div>
                <div class="d-flex justify-content-between mt-2"><span class="text-warning fw-bold">Total Tax</span> <span class="text-warning fw-bold">($${Math.round(data.totalTax).toLocaleString()})</span></div>
                <div class="d-flex justify-content-between"><span class="text-muted">Marginal Rate</span> <span class="text-white">${(data.margRate*100).toFixed(2)}%</span></div>
                <div class="d-flex justify-content-between mt-2 pt-2 border-top border-white"><span class="text-success fw-bold">After-Tax Income</span> <span class="text-success fw-bold">$${Math.round(gross - data.totalTax).toLocaleString()}</span></div>
            `;
        } else { container.innerHTML = `<span class="text-muted text-center d-block small">No Income Entered</span>`; }
    }

    updateMortgagePayment() {
        if (this.state.manualMortgage) return;
        const P = this.getVal('mortgage_amt');
        const annualRate = this.getVal('mortgage_rate') / 100;
        let monthlyPayment = 0;
        if (P > 0 && annualRate > 0) {
            const r = annualRate / 12; const n = 25 * 12;
            monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else if (P > 0) { monthlyPayment = P / (25*12); }
        
        const val = Math.round(monthlyPayment).toLocaleString('en-US');
        document.getElementById('mortgage_payment').value = val;
        this.state.inputs['mortgage_payment'] = val;
        
        this.updateMortgagePayoffDate();
    }

    updateMortgagePayoffDate() {
        const P = this.getVal('mortgage_amt');
        const annualRate = this.getVal('mortgage_rate') / 100;
        const pmt = this.getVal('mortgage_payment');
        const el = document.getElementById('mortgage_payoff_display');
        if(P <= 0) { el.innerHTML = ""; return; }
        const r = annualRate / 12;
        if(pmt <= P * r) { el.innerHTML = `<span class="text-danger small fw-bold">Payment too low</span>`; return; }
        const nMonths = -Math.log(1 - (r * P) / pmt) / Math.log(1 + r);
        if(!isNaN(nMonths) && isFinite(nMonths)) {
            const now = new Date();
            const futureDate = new Date(now.setMonth(now.getMonth() + nMonths));
            const dateStr = futureDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const yrs = Math.floor(nMonths/12); const mos = Math.round(nMonths%12);
            el.innerHTML = `<span class="small text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Payoff: ${dateStr} (${yrs}y ${mos}m)</span>`;
        } else { el.innerHTML = ""; }
    }

    getRawExpenseTotals() {
        let cur = 0, ret = 0;
        for (const cat in this.expensesByCategory) {
            this.expensesByCategory[cat].items.forEach(item => {
                cur += item.curr * item.freq;
                ret += item.ret * item.freq;
            });
        }
        return { current: cur, retirement: ret };
    }

    getTotalDebt() {
        let total = 0;
        document.querySelectorAll('.debt-amount').forEach(el => { total += Number(el.value.replace(/,/g, '')) || 0; });
        return total;
    }

    calcExpenses() {
        const { current, retirement } = this.getRawExpenseTotals();
        const curEl = document.getElementById('total_annual_current');
        const retEl = document.getElementById('total_annual_retirement');
        
        if (curEl) curEl.innerHTML = '$' + current.toLocaleString() + ` <span class="monthly-sub">($${Math.round(current/12).toLocaleString()}/mo)</span>`;
        if (retEl) retEl.innerHTML = '$' + retirement.toLocaleString() + ` <span class="monthly-sub">($${Math.round(retirement/12).toLocaleString()}/mo)</span>`;
    }

    // --- Sidebars & Extras ---

    initSidebar() {
        // --- EXISTING SLIDER LOGIC ---
        if(document.getElementById('p1_retireAge')) {
            document.getElementById('qa_p1_retireAge_range').value = document.getElementById('p1_retireAge').value;
            document.getElementById('qa_p1_retireAge_val').innerText = document.getElementById('p1_retireAge').value;
        }
        
        document.getElementById('qa_p1_retireAge_range').addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('p1_retireAge').value = val;
            this.state.inputs['p1_retireAge'] = val;
            document.getElementById('qa_p1_retireAge_val').innerText = val;
            this.debouncedRun();
        });
        
        const bindSlider = (sliderId, inputId, labelId, suffix='') => {
            document.getElementById(sliderId).addEventListener('input', (e) => {
                const val = e.target.value;
                const input = document.getElementById(inputId);
                if(input) {
                    input.value = val;
                    this.state.inputs[inputId] = val;
                    if(labelId) document.getElementById(labelId).innerText = val + suffix;
                    this.debouncedRun();
                }
            });
        };
        bindSlider('qa_p2_retireAge_range', 'p2_retireAge', 'qa_p2_retireAge_val');
        bindSlider('qa_inflation_range', 'inflation_rate', 'qa_inflation_val', '%');
        bindSlider('qa_return_range', 'p1_tfsa_ret', 'qa_return_val', '%'); 
    }

    populateAgeSelects() {
        const cppSelects = document.querySelectorAll('.cpp-age-select');
        cppSelects.forEach(sel => {
            let html = '';
            for(let i=60; i<=70; i++) html += `<option value="${i}" ${i===65?'selected':''}>${i}</option>`;
            sel.innerHTML = html;
        });
        const oasSelects = document.querySelectorAll('.oas-age-select');
        oasSelects.forEach(sel => {
            let html = '';
            for(let i=65; i<=70; i++) html += `<option value="${i}" ${i===65?'selected':''}>${i}</option>`;
            sel.innerHTML = html;
        });
    }

    loadScenariosList() {
        const list = document.getElementById('scenarioList');
        const compareArea = document.getElementById('compareSelectionArea');
        list.innerHTML = '';
        
        let compHTML = `<div class="d-flex align-items-center mb-2 p-2 rounded" style="background: rgba(255,255,255,0.05);">
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" value="current" id="comp_current" checked>
                <label class="form-check-label text-white small" for="comp_current">Current Unsaved Plan</label>
            </div>
        </div>`;

        let scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');
        
        scenarios.forEach((s, idx) => {
            list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center bg-dark text-white border-secondary">
                ${s.name}
                <div>
                    <button class="btn btn-sm btn-success me-2" onclick="app.loadScenario(${idx})">Load</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteScenario(${idx})">Delete</button>
                </div>
            </li>`;
            
            compHTML += `<div class="d-flex align-items-center mb-2 p-2 rounded" style="background: rgba(255,255,255,0.05);">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" value="${idx}" id="comp_${idx}">
                    <label class="form-check-label text-white small" for="comp_${idx}">${s.name}</label>
                </div>
            </div>`;
        });
        compareArea.innerHTML = compHTML;
    }

    loadScenario(idx) {
        let scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');
        const s = scenarios[idx];
        if(!s) return;
        this.loadStateToDOM(s.data);
        this.run();
        alert("Loaded " + s.name);
    }

    loadStateToDOM(data) {
        this.state.inputs = {...data.inputs};
        this.state.strategies = {...data.strategies};
        
        for (const [id, val] of Object.entries(this.state.inputs)) {
            if (id.startsWith('comp_')) continue;

            const el = document.getElementById(id);
            if(el) {
                if(el.type === 'checkbox' || el.type === 'radio') el.checked = val;
                else el.value = val;
            }
        }
        
        if (data.expensesData) {
            this.expensesByCategory = data.expensesData;
        } 
        this.renderExpenseRows();

        if (data.properties) {
            this.state.properties = data.properties;
            this.renderProperties();
        }

        const debtContainer = document.getElementById('debt-container');
        debtContainer.innerHTML = '';
        if (data.debt) {
            data.debt.forEach(amt => {
                this.addDebtRow();
                const inputs = debtContainer.querySelectorAll('.debt-amount');
                inputs[inputs.length-1].value = amt;
            });
        }
        this.toggleModeDisplay();
        this.renderStrategy();
    }

    deleteScenario(idx) {
        this.showConfirm("Are you sure you want to delete this scenario?", () => {
            let scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');
            scenarios.splice(idx, 1);
            localStorage.setItem('rp_scenarios', JSON.stringify(scenarios));
            this.loadScenariosList();
        });
    }
    
    saveScenario() {
        const nameInput = document.getElementById('scenarioName');
        if (!nameInput.value) { alert("Enter a name!"); return; }
        
        let scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');
        scenarios.push({
            name: nameInput.value,
            data: this.getCurrentSnapshot()
        });
        localStorage.setItem('rp_scenarios', JSON.stringify(scenarios));
        this.loadScenariosList();
        nameInput.value = '';
        alert("Scenario saved.");
    }

    getCurrentSnapshot() {
        const snapshot = {
            inputs: {...this.state.inputs},
            strategies: {...this.state.strategies},
            debt: [], 
            properties: JSON.parse(JSON.stringify(this.state.properties)),
            expensesData: JSON.parse(JSON.stringify(this.expensesByCategory))
        };
        document.querySelectorAll('.debt-amount').forEach(el => snapshot.debt.push(el.value));
        return snapshot;
    }
}

const app = new RetirementPlanner();
