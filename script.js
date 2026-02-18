/**
 * Retirement Planner Pro - Logic v10.47 (Smart Income Streams & Post-Retirement Fix)
 * * Changelog:
 * - v10.47: ENHANCED: Additional Income streams now support relative scheduling (e.g., "Start 0 years after retirement", "Lasts for 5 years").
 * - v10.47: REMOVED: Legacy "Post-Retirement Income" hardcoded section (superseded by flexible streams).
 * - v10.46: FIXED: "Iterative Deficit" loop now correctly accounts for non-taxable withdrawals (TFSA/Capital).
 * - v10.45: FIXED: "Surplus" calculation is now Iterative.
 */
class RetirementPlanner {
    constructor() {
        this.APP_VERSION = "10.47";
        this.state = {
            inputs: {},
            debt: [],
            properties: [{ name: "Primary Home", value: 1000000, mortgage: 430000, growth: 3.0, rate: 3.29, payment: 0, manual: false, includeInNW: false }],
            windfalls: [],
            additionalIncome: [],
            strategies: { 
                accum: ['tfsa', 'rrsp', 'nreg', 'cash', 'crypto'], 
                decum: ['rrsp', 'crypto', 'nreg', 'tfsa', 'cash'] 
            },
            mode: 'Couple',
            projectionData: [],
            expenseMode: 'Simple'
        };

        this.AUTO_SAVE_KEY = 'rp_autosave_v1';
        this.THEME_KEY = 'rp_theme';
        
        this.CONSTANTS = {
            MAX_CPP_2026: 18092, 
            MAX_OAS_2026: 8908, 
            RRIF_START_AGE: 72, 
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
            }
        };

        this.charts = { nw: null, sankey: null }; 
        this.confirmModal = null; 
        this.saveModalInstance = null;
        this.sliderTimeout = null;

        this.expensesByCategory = {
            "Housing": { items: [ { name: "Property Tax", curr: 6000, ret: 6000, trans: 6000, gogo: 6000, slow: 6000, nogo: 6000, freq: 1 }, { name: "Enbridge (Gas)", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Enercare (HWT)", curr: 45, ret: 45, trans: 45, gogo: 45, slow: 45, nogo: 45, freq: 12 }, { name: "Alectra (Hydro)", curr: 150, ret: 150, trans: 150, gogo: 150, slow: 150, nogo: 150, freq: 12 }, { name: "RH Water", curr: 80, ret: 80, trans: 80, gogo: 80, slow: 80, nogo: 80, freq: 12 } ], colorClass: 'cat-header-housing' },
            "Living": { items: [ { name: "Grocery", curr: 800, ret: 800, trans: 800, gogo: 800, slow: 700, nogo: 600, freq: 12 }, { name: "Costco", curr: 400, ret: 400, trans: 400, gogo: 400, slow: 350, nogo: 300, freq: 12 }, { name: "Restaurants", curr: 400, ret: 300, trans: 350, gogo: 350, slow: 200, nogo: 100, freq: 12 }, { name: "Cellphone", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Internet", curr: 90, ret: 90, trans: 90, gogo: 90, slow: 90, nogo: 90, freq: 12 } ], colorClass: 'cat-header-living' },
            "Kids": { items: [ { name: "Daycare", curr: 1200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Activities", curr: 200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "RESP Contribution", curr: 208, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Clothing/Toys", curr: 100, ret: 50, trans: 50, gogo: 50, slow: 0, nogo: 0, freq: 12 } ], colorClass: 'cat-header-kids' },
            "Lifestyle": { items: [ { name: "Travel", curr: 5000, ret: 15000, trans: 10000, gogo: 15000, slow: 5000, nogo: 0, freq: 1 }, { name: "Electronic", curr: 500, ret: 500, trans: 500, gogo: 500, slow: 500, nogo: 200, freq: 1 }, { name: "Health Insurance", curr: 50, ret: 300, trans: 150, gogo: 300, slow: 500, nogo: 1000, freq: 12 }, { name: "Other", curr: 300, ret: 300, trans: 300, gogo: 300, slow: 200, nogo: 100, freq: 12 } ], colorClass: 'cat-header-lifestyle' }
        };
        
        this.optimalAges = { p1_cpp: 65, p1_oas: 65, p2_cpp: 65, p2_oas: 65 };
        this.strategyLabels = { 'tfsa': 'TFSA', 'rrsp': 'RRSP', 'nreg': 'Non-Reg', 'cash': 'Cash', 'crypto': 'Crypto', 'rrif': 'RRIF' };
        this.iconDefs = {
            "P1 Retires": { icon: 'bi-cup-hot-fill', color: 'text-warning', title: "P1 Retires" }, "P2 Retires": { icon: 'bi-cup-hot', color: 'text-purple', title: "P2 Retires" },
            "Mortgage Paid": { icon: 'bi-house-check-fill', color: 'text-success', title: "Mortgage Paid" }, "Crash": { icon: 'bi-graph-down-arrow', color: 'text-danger', title: "Stress Test: Market Crash (-15%)" },
            "P1 CPP": { icon: 'bi-file-earmark-text-fill', color: 'text-info', title: "P1 Starts CPP" }, "P1 OAS": { icon: 'bi-cash-stack', color: 'text-info', title: "P1 Starts OAS" },
            "P2 CPP": { icon: 'bi-file-earmark-text', color: 'text-purple', title: "P2 Starts CPP" }, "P2 OAS": { icon: 'bi-cash', color: 'text-purple', title: "P2 Starts OAS" },
            "P1 Dies": { icon: 'bi-heartbreak-fill', color: 'text-white', title: "P1 Deceased" }, "P2 Dies": { icon: 'bi-heartbreak', color: 'text-white', title: "P2 Deceased" },
            "Windfall": { icon: 'bi-gift-fill', color: 'text-success', title: "Inheritance/Bonus Received" }
        };

        if(typeof google !== 'undefined' && google.charts) google.charts.load('current', {'packages':['sankey']});
        
        // Debounce for the main run
        this.debouncedRun = this.debounce(() => this.run(), 300);
        // Special separate debounce for real estate payment updates
        this.debouncedPayoffUpdate = this.debounce((idx) => {
             this.updatePropPayoffDisplay(idx);
             this.run(); 
        }, 500);

        this.init();
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    init() {
        const setup = () => {
            // Version Header Injection
            const selectors = ['#app-title', '.navbar-brand', 'h1', '.h1', 'h2'];
            let headerEl = null;
            for (const sel of selectors) {
                headerEl = document.querySelector(sel);
                if (headerEl) break;
            }

            if(headerEl && !document.getElementById('rp_version_badge')) {
                const vSpan = document.createElement('span');
                vSpan.id = 'rp_version_badge';
                vSpan.className = 'badge bg-warning text-dark ms-2 small';
                vSpan.style.fontSize = '0.65rem';
                vSpan.style.verticalAlign = 'middle';
                vSpan.innerText = `v${this.APP_VERSION}`;
                headerEl.appendChild(vSpan);
            }

            this.confirmModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
            if(document.getElementById('saveScenarioModal')) {
                this.saveModalInstance = new bootstrap.Modal(document.getElementById('saveScenarioModal'));
            }
            this.setupGridContainer(); 
            this.populateAgeSelects();
            const savedData = localStorage.getItem(this.AUTO_SAVE_KEY);
            if (savedData) {
                try { this.loadStateToDOM(JSON.parse(savedData)); } 
                catch(e) { console.error("Failed load, falling back to defaults", e); this.renderDefaults(); }
            } else this.renderDefaults();

            this.initTheme(); 
            this.loadScenariosList(); 
            this.syncStateFromDOM(); 
            this.toggleModeDisplay(); 
            this.updateBenefitVisibility();
            this.updateAgeDisplay('p1'); 
            this.updateAgeDisplay('p2');
            this.updateAllMortgages(); 
            this.findOptimal(); 
            this.bindEvents(); 
            this.initSidebar();
            this.initPopovers(); 

            setTimeout(() => { this.syncStateFromDOM(); this.run(); }, 500); 
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
        else setup(); 
    }

    initPopovers() {
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, {
            trigger: 'focus', 
            html: true 
        }));
    }

    initTheme() {
        const savedTheme = localStorage.getItem(this.THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        this.updateThemeIcon(savedTheme); 
        this.updateImportButton(savedTheme); 
    }

    toggleTheme() {
        const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        localStorage.setItem(this.THEME_KEY, next);
        this.updateThemeIcon(next); 
        this.updateImportButton(next); 
        this.renderExpenseRows(); 
        this.run(); 
    }

    updateThemeIcon(theme) {
        const btn = document.getElementById('btnThemeToggle');
        if (!btn) return;
        btn.innerHTML = theme === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
        btn.className = theme === 'dark' ? 'btn btn-outline-secondary d-flex align-items-center justify-content-center' : 'btn btn-outline-dark d-flex align-items-center justify-content-center text-dark';
    }

    updateImportButton(theme) {
        const lbl = document.querySelector('label[for="fileUpload"]');
        if(lbl) lbl.className = theme === 'light' ? 'btn btn-outline-dark text-dark flex-grow-1 btn-sm fw-bold' : 'btn btn-outline-primary fw-bold';
    }

    renderDefaults() {
        this.renderExpenseRows(); 
        this.renderProperties(); 
        this.addDebtRow(); 
        this.renderWindfalls(); 
        this.renderAdditionalIncome(); 
        this.renderStrategy();
    }

    showConfirm(message, onConfirm) {
        const modalEl = document.getElementById('confirmationModal');
        modalEl.querySelector('.modal-body').textContent = message;
        const btn = document.getElementById('btnConfirmAction');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => { onConfirm(); this.confirmModal.hide(); });
        this.confirmModal.show();
    }

    setupGridContainer() {
        const gridId = 'projectionGrid';
        if (document.getElementById(gridId)) return; 
        const oldTableBody = document.getElementById('projectionTableBody');
        let container = document.querySelector('.card-body') || document.body;
        const gridContainer = document.createElement('div');
        gridContainer.id = gridId; gridContainer.className = 'modern-grid';
        if (oldTableBody && oldTableBody.closest('table').parentNode) {
            oldTableBody.closest('table').parentNode.insertBefore(gridContainer, oldTableBody.closest('table'));
            oldTableBody.closest('table').style.display = 'none'; 
        } else container.appendChild(gridContainer);
    }

    syncStateFromDOM() {
        document.querySelectorAll('input, select').forEach(el => {
            if (el.id && !el.id.startsWith('comp_') && !el.className.includes('-update') && !el.classList.contains('debt-amount')) {
                this.state.inputs[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
            }
        });
        const coupleEl = document.getElementById('modeCouple');
        if(coupleEl) this.state.mode = coupleEl.checked ? 'Couple' : 'Single';
    }

    getVal(id) {
        let raw = this.state.inputs[id] !== undefined ? this.state.inputs[id] : (document.getElementById(id)?.value || 0);
        return Number(String(raw).replace(/,/g, '')) || 0;
    }

    getRaw(id) { return this.state.inputs[id] !== undefined ? this.state.inputs[id] : document.getElementById(id)?.value; }

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

    bindEvents() {
        const $ = id => document.getElementById(id);
        if($('btnThemeToggle')) $('btnThemeToggle').addEventListener('click', () => this.toggleTheme());
        if($('useRealDollars')) $('useRealDollars').addEventListener('change', () => { this.calcExpenses(); this.run(); });

        document.body.addEventListener('change', (e) => {
            if (e.target.id === 'expense_mode_advanced') {
                this.state.expenseMode = e.target.checked ? 'Advanced' : 'Simple';
                if($('expense-phase-controls')) $('expense-phase-controls').style.display = e.target.checked ? 'flex' : 'none';
                this.renderExpenseRows(); this.calcExpenses(); this.run();
            }
            if (e.target.id === 'asset_mode_advanced') {
                const isAdv = e.target.checked;
                document.querySelectorAll('.asset-bal-col').forEach(el => el.className = isAdv ? 'col-3 asset-bal-col' : 'col-5 asset-bal-col');
                document.querySelectorAll('.asset-ret-col').forEach(el => el.className = isAdv ? 'col-3 asset-ret-col' : 'col-4 asset-ret-col');
                document.querySelectorAll('.adv-asset-col').forEach(el => el.style.display = isAdv ? 'block' : 'none');
                document.querySelectorAll('.lbl-ret').forEach(el => el.innerText = isAdv ? 'Pre-Ret(%)' : 'Return (%)');
                this.run();
            }
            // Removed post-ret income enable toggles logic
            if (e.target.classList.contains('live-calc') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'radio')) {
                if(e.target.id && !e.target.id.startsWith('comp_')) this.state.inputs[e.target.id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                if(e.target.id && e.target.id.includes('_enabled')) this.updateBenefitVisibility();
                this.findOptimal(); this.run(); this.calcExpenses(); 
            }
        });

        const gogoS = $('exp_gogo_age'), slowS = $('exp_slow_age');
        if (gogoS && slowS) {
            gogoS.addEventListener('input', e => {
                let v = parseInt(e.target.value), sV = parseInt(slowS.value);
                $('exp_gogo_val').innerText = v; this.state.inputs['exp_gogo_age'] = v;
                if(v > sV) { slowS.value = v; $('exp_slow_val').innerText = v; this.state.inputs['exp_slow_age'] = v; }
                this.renderExpenseRows(); this.calcExpenses(); this.debouncedRun();
            });
            slowS.addEventListener('input', e => {
                let v = parseInt(e.target.value), gV = parseInt(gogoS.value);
                $('exp_slow_val').innerText = v; this.state.inputs['exp_slow_age'] = v;
                if(v < gV) { gogoS.value = v; $('exp_gogo_val').innerText = v; this.state.inputs['exp_gogo_age'] = v; }
                this.renderExpenseRows(); this.calcExpenses(); this.debouncedRun();
            });
        }

        $('btnClearAll').addEventListener('click', () => this.showConfirm("Clear all data?", () => this.resetAllData()));
        $('btnAddProperty').addEventListener('click', () => this.addProperty());
        $('btnAddWindfall').addEventListener('click', () => this.addWindfall());
        if ($('btnAddIncomeP1')) $('btnAddIncomeP1').addEventListener('click', () => this.addAdditionalIncome('p1'));
        if ($('btnAddIncomeP2')) $('btnAddIncomeP2').addEventListener('click', () => this.addAdditionalIncome('p2'));
        $('btnExportCSV').addEventListener('click', () => this.exportToCSV());
        $('fileUpload').addEventListener('change', e => this.handleFileUpload(e));
        $('btnClearStorage').addEventListener('click', () => this.clearStorage());

        document.body.addEventListener('input', e => {
            const cl = e.target.classList;
            if (cl.contains('live-calc')) {
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                if (e.target.id && !e.target.id.startsWith('comp_') && e.target.id !== 'exp_gogo_age' && e.target.id !== 'exp_slow_age' && !cl.contains('property-update') && !cl.contains('windfall-update') && !cl.contains('debt-amount') && !cl.contains('income-stream-update')) {
                    this.state.inputs[e.target.id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    this.updateSidebarSync(e.target.id, e.target.value);
                }
                this.debouncedRun();
            }
            if (cl.contains('expense-update')) {
                const { cat, idx, field } = e.target.dataset;
                let val = ['curr', 'ret', 'trans', 'gogo', 'slow', 'nogo'].includes(field) ? Number(e.target.value.replace(/,/g, '')) || 0 : (field === 'freq' ? parseInt(e.target.value) : e.target.value);
                if (this.expensesByCategory[cat]?.items[idx]) this.expensesByCategory[cat].items[idx][field] = val;
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun(); this.calcExpenses(); 
            }
            if (cl.contains('property-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                if (['value', 'mortgage', 'payment'].includes(field)) val = Number(String(val).replace(/,/g, '')) || 0;
                else if (['growth', 'rate'].includes(field)) val = parseFloat(val) || 0;
                if (this.state.properties[idx]) {
                    this.state.properties[idx][field] = val;
                    if(field === 'payment') this.state.properties[idx].manual = true;
                    if(!['payment', 'name', 'includeInNW'].includes(field)) { this.state.properties[idx].manual = false; this.calculateSingleMortgage(idx); }
                    
                    if(field === 'payment') this.debouncedPayoffUpdate(idx);
                }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                
                if(field !== 'payment') this.debouncedRun();
            }
            if (cl.contains('windfall-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : (field === 'amount' ? Number(e.target.value.replace(/,/g, '')) || 0 : e.target.value);
                if (this.state.windfalls[idx]) { this.state.windfalls[idx][field] = val; if(field === 'freq') this.renderWindfalls(); }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun();
            }
            if (cl.contains('income-stream-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : (['amount', 'growth', 'startRel', 'duration'].includes(field) ? Number(e.target.value.replace(/,/g, '')) || 0 : e.target.value);
                if (this.state.additionalIncome[idx]) {
                    this.state.additionalIncome[idx][field] = val;
                    // Trigger re-render if mode changed to show correct inputs
                    if (field === 'startMode' || field === 'endMode') {
                        this.renderAdditionalIncome();
                    }
                }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.updateIncomeDisplay(); this.debouncedRun();
            }
        });

        $('p1_dob').addEventListener('change', () => this.updateAgeDisplay('p1'));
        $('p2_dob').addEventListener('change', () => this.updateAgeDisplay('p2'));
        document.getElementsByName('planMode').forEach(r => r.addEventListener('change', () => { 
            if($('modeCouple')) this.state.mode = $('modeCouple').checked ? 'Couple' : 'Single';
            this.toggleModeDisplay(); this.run(); this.calcExpenses();
        }));

        $('btnCollapseSidebar').addEventListener('click', () => this.toggleSidebar());
        $('btnExpandSidebar').addEventListener('click', () => this.toggleSidebar());

        $('yearSlider').addEventListener('input', e => {
            const index = parseInt(e.target.value);
            if (this.state.projectionData[index]) {
                const d = this.state.projectionData[index];
                $('sliderYearDisplay').innerText = d.year;
                $('cfAgeDisplay').innerText = this.state.mode === 'Couple' ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                document.querySelectorAll('.grid-row-group').forEach(r => r.style.backgroundColor = ''); 
                if(document.querySelectorAll('.grid-row-group')[index]) {
                    document.querySelectorAll('.grid-row-group')[index].style.backgroundColor = 'rgba(255,193,7,0.1)';
                    document.querySelectorAll('.grid-row-group')[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                clearTimeout(this.sliderTimeout);
                this.sliderTimeout = setTimeout(() => this.drawSankey(index), 50);
            }
        });

        if(document.querySelector('button[data-bs-target="#cashflow-pane"]')) {
            document.querySelector('button[data-bs-target="#cashflow-pane"]').addEventListener('shown.bs.tab', () => this.drawSankey(parseInt($('yearSlider').value)));
        }
        
        const compareTabBtn = document.querySelector('button[data-bs-target="#compare-pane"]');
        if (compareTabBtn) {
            compareTabBtn.addEventListener('shown.bs.tab', () => { if(this.charts.nw) this.charts.nw.resize(); this.renderComparisonChart(); });
        }

        if($('compareSelectionArea')) {
            $('compareSelectionArea').addEventListener('change', () => this.renderComparisonChart());
        }

        $('btnAddDebt').addEventListener('click', () => this.addDebtRow());
        
        if($('btnModalSaveScenario')) {
            $('btnModalSaveScenario').addEventListener('click', () => this.saveScenarioFromModal());
        }

        document.body.addEventListener('click', e => {
            if(e.target.classList.contains('toggle-btn')) this.toggleGroup(e.target.dataset.type);
            if(e.target.classList.contains('opt-apply')) this.applyOpt(e.target.dataset.target);
        });
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
                if (chk.checked) {
                    container.style.display = 'block';
                } else {
                    container.style.display = 'none';
                }
            }
        });
    }

    saveToLocalStorage() { localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(this.getCurrentSnapshot())); }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try { 
                this.loadStateToDOM(JSON.parse(event.target.result)); 
                this.run(); 
                this.updateScenarioBadge(file.name.replace('.json',''));
                alert('Configuration loaded successfully.'); 
            } 
            catch(err) { alert('Error parsing JSON.'); console.error(err); }
        };
        reader.readAsText(file); e.target.value = '';
    }

    clearStorage() {
        if(confirm("Delete auto-saved data and reset everything to defaults?")) { 
            localStorage.removeItem(this.AUTO_SAVE_KEY); 
            this.updateScenarioBadge(null);
            location.reload(); 
        }
    }

    resetAllData() {
        const defs = { 
            p1_dob: '1990-01', p2_dob: '1990-01', p1_retireAge: '65', p2_retireAge: '65', p1_lifeExp: '90', p2_lifeExp: '90', inflation_rate: '2.0', tax_province: 'ON', 
            p1_cash_ret: '2.0', p1_cash_ret_retire: '2.0', p2_cash_ret: '2.0', p2_cash_ret_retire: '2.0', 
            p1_tfsa_ret: '6.0', p1_tfsa_ret_retire: '6.0', p2_tfsa_ret: '6.0', p2_tfsa_ret_retire: '6.0', 
            p1_rrsp_ret: '6.0', p1_rrsp_ret_retire: '6.0', p2_rrsp_ret: '6.0', p2_rrsp_ret_retire: '6.0', 
            p1_nonreg_ret: '5.0', p1_nonreg_ret_retire: '5.0', p2_nonreg_ret: '5.0', p2_nonreg_ret_retire: '5.0', 
            p1_nonreg_yield: '2.0', p2_nonreg_yield: '2.0', 
            p1_crypto_ret: '8.0', p1_crypto_ret_retire: '8.0', p2_crypto_ret: '8.0', p2_crypto_ret_retire: '8.0',
            p1_lirf_ret: '6.0', p1_lirf_ret_retire: '6.0', p2_lirf_ret: '6.0', p2_lirf_ret_retire: '6.0',
            p1_lif_ret: '5.0', p1_lif_ret_retire: '5.0', p2_lif_ret: '5.0', p2_lif_ret_retire: '5.0',
            p1_rrif_acct_ret: '5.0', p1_rrif_acct_ret_retire: '5.0', p2_rrif_acct_ret: '5.0', p2_rrif_acct_ret_retire: '5.0',
            
            p1_cpp_est_base: '10,000', p2_cpp_est_base: '10,000',
            p1_oas_years: '40', p2_oas_years: '40',
            
            p1_income_growth: '2.0', p2_income_growth: '2.0', 
            p1_db_lifetime: '0', p2_db_lifetime: '0', 
            p1_db_lifetime_start: '60', p2_db_lifetime_start: '60', 
            p1_db_bridge: '0', p2_db_bridge: '0', 
            p1_db_bridge_start: '60', p2_db_bridge_start: '60', 
            p1_cpp_enabled: true, p1_oas_enabled: true, p1_db_enabled: false,
            p2_cpp_enabled: true, p2_oas_enabled: true, p2_db_enabled: false,
            pension_split_enabled: false,
            cfg_tfsa_limit: '7,000', cfg_rrsp_limit: '32,960',
            exp_gogo_age: '75', exp_slow_age: '85'
        };
        
        document.querySelectorAll('input, select').forEach(el => {
            if(el.id && !el.id.startsWith('comp_') && !el.className.includes('-update') && !el.classList.contains('debt-amount')) {
                if(defs[el.id] !== undefined) el.type === 'checkbox' ? el.checked = defs[el.id] : el.value = defs[el.id];
                else if (el.type === 'checkbox' || el.type === 'radio') { if(el.name !== 'planMode') el.checked = false; } else el.value = '0';
                this.state.inputs[el.id] = el.type === 'checkbox' ? el.checked : el.value;
            }
        });
        this.state.properties = [{ name: "Primary Home", value: 0, mortgage: 0, growth: 3.0, rate: 3.5, payment: 0, manual: false, includeInNW: false }];
        this.state.windfalls = []; this.state.additionalIncome = []; 
        for (const cat in this.expensesByCategory) this.expensesByCategory[cat].items = [];
        this.renderProperties(); this.renderWindfalls(); this.renderAdditionalIncome(); this.renderExpenseRows(); this.calcExpenses();
        document.getElementById('debt-container').innerHTML = ''; this.state.debt = [];
        this.updateSidebarSync('p1_retireAge', 65); this.updateSidebarSync('p2_retireAge', 65); this.updateSidebarSync('inflation_rate', 2.0); this.updateSidebarSync('p1_tfsa_ret', 6.0);
        document.getElementById('exp_gogo_val').innerText = '75'; document.getElementById('exp_slow_val').innerText = '85'; 
        
        if(document.getElementById('p1_db_lifetime_start_val')) document.getElementById('p1_db_lifetime_start_val').innerText = '60';
        if(document.getElementById('p1_db_bridge_start_val')) document.getElementById('p1_db_bridge_start_val').innerText = '60';
        if(document.getElementById('p2_db_lifetime_start_val')) document.getElementById('p2_db_lifetime_start_val').innerText = '60';
        if(document.getElementById('p2_db_bridge_start_val')) document.getElementById('p2_db_bridge_start_val').innerText = '60';
        
        if(document.getElementById('p1_oas_years_val')) document.getElementById('p1_oas_years_val').innerText = '40';
        if(document.getElementById('p2_oas_years_val')) document.getElementById('p2_oas_years_val').innerText = '40';
        if(document.getElementById('p1_cpp_start_val')) document.getElementById('p1_cpp_start_val').innerText = this.getRaw('p1_cpp_start')||'65';
        if(document.getElementById('p1_oas_start_val')) document.getElementById('p1_oas_start_val').innerText = this.getRaw('p1_oas_start')||'65';
        if(document.getElementById('p2_cpp_start_val')) document.getElementById('p2_cpp_start_val').innerText = this.getRaw('p2_cpp_start')||'65';
        if(document.getElementById('p2_oas_start_val')) document.getElementById('p2_oas_start_val').innerText = this.getRaw('p2_oas_start')||'65';
        
        if(document.getElementById('cfg_tfsa_limit')) document.getElementById('cfg_tfsa_limit').value = (this.getVal('cfg_tfsa_limit') || 7000).toLocaleString();
        if(document.getElementById('cfg_rrsp_limit')) document.getElementById('cfg_rrsp_limit').value = (this.getVal('cfg_rrsp_limit') || 32960).toLocaleString();

        this.updateBenefitVisibility();
    }

    exportToCSV() {
        if (!this.state.projectionData.length) return alert("No data available.");
        const mode = this.state.mode, d = this.state.projectionData;
        const h = ["Year", "P1 Age", mode==="Couple"?"P2 Age":null, "P1 Base Income", mode==="Couple"?"P2 Base Income":null, "P1 Post-Ret Inc", mode==="Couple"?"P2 Post-Ret Inc":null, "P1 Benefits", mode==="Couple"?"P2 Benefits":null, "P1 DB Pension", mode==="Couple"?"P2 DB Pension":null, "Windfall", "P1 Taxes", mode==="Couple"?"P2 Taxes":null, "Total Expenses", "Mortgage Payment", "Debt Payment", "Surplus/Deficit", "P1 TFSA", "P1 RRSP", "P1 Non-Reg", "P1 Cash", "P1 Crypto", "P1 LIRF", "P1 LIF", "P1 RRIF", mode==="Couple"?"P2 TFSA":null, mode==="Couple"?"P2 RRSP":null, mode==="Couple"?"P2 Non-Reg":null, mode==="Couple"?"P2 Cash":null, mode==="Couple"?"P2 Crypto":null, mode==="Couple"?"P2 LIRF":null, mode==="Couple"?"P2 LIF":null, mode==="Couple"?"P2 RRIF":null, "Liquid Net Worth", "Home Equity", "Total Net Worth"].filter(x=>x);
        const rows = d.map(r => [r.year, r.p1Age, mode==="Couple"?(r.p2Age||""):null, Math.round(r.incomeP1), mode==="Couple"?Math.round(r.incomeP2):null, Math.round(r.postRetP1||0), mode==="Couple"?Math.round(r.postRetP2||0):null, Math.round(r.benefitsP1), mode==="Couple"?Math.round(r.benefitsP2):null, Math.round(r.dbP1), mode==="Couple"?Math.round(r.dbP2):null, Math.round(r.windfall), Math.round(r.taxP1), mode==="Couple"?Math.round(r.taxP2):null, Math.round(r.expenses), Math.round(r.mortgagePay), Math.round(r.debtPay), Math.round(r.surplus), Math.round(r.assetsP1.tfsa), Math.round(r.assetsP1.rrsp), Math.round(r.assetsP1.nreg), Math.round(r.assetsP1.cash), Math.round(r.assetsP1.crypto), Math.round(r.assetsP1.lirf), Math.round(r.assetsP1.lif), Math.round(r.assetsP1.rrif_acct), mode==="Couple"?Math.round(r.assetsP2.tfsa):null, mode==="Couple"?Math.round(r.assetsP2.rrsp):null, mode==="Couple"?Math.round(r.assetsP2.nreg):null, mode==="Couple"?Math.round(r.assetsP2.cash):null, mode==="Couple"?Math.round(r.assetsP2.crypto):null, mode==="Couple"?Math.round(r.assetsP2.lirf):null, mode==="Couple"?Math.round(r.assetsP2.lif):null, mode==="Couple"?Math.round(r.assetsP2.rrif_acct):null, Math.round(r.liquidNW), Math.round(r.homeValue-r.mortgage), Math.round(r.debugNW)].filter(x=>x!==null).join(","));
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + [h.join(","), ...rows].join("\n"))); link.setAttribute("download", "retirement_plan_pro.csv");
        document.body.appendChild(link); link.click(); link.remove();
    }

    renderWindfalls() {
        const container = document.getElementById('windfall-container'); if(!container) return; container.innerHTML = '';
        this.state.windfalls.forEach((w, idx) => {
            const today = new Date().toISOString().slice(0, 7), div = document.createElement('div');
            div.className = 'windfall-row p-3 border border-secondary rounded-3 surface-card mb-3';
            div.innerHTML = `<div class="d-flex justify-content-between mb-3"><input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold text-success fs-6 windfall-update px-0" placeholder="Event Name" value="${w.name}" data-idx="${idx}" data-field="name"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.removeWindfall(${idx})"><i class="bi bi-x-lg"></i></button></div><div class="row g-3 align-items-center mb-2"><div class="col-4"><label class="form-label small text-muted mb-1">Amount</label><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num windfall-update" value="${w.amount.toLocaleString()}" data-idx="${idx}" data-field="amount"></div></div><div class="col-4"><label class="form-label small text-muted mb-1">Frequency</label><select class="form-select form-select-sm border-secondary windfall-update" data-idx="${idx}" data-field="freq"><option value="one" ${w.freq==='one'?'selected':''}>One Time</option><option value="month" ${w.freq==='month'?'selected':''}>/ Month</option><option value="year" ${w.freq==='year'?'selected':''}>/ Year</option></select></div><div class="col-4 p2-column" style="${this.state.mode === 'Couple' ? '' : 'display:none;'}"><label class="form-label small text-muted mb-1">Owner</label><select class="form-select form-select-sm border-secondary windfall-update" data-idx="${idx}" data-field="owner"><option value="p1" ${w.owner==='p1'?'selected':''}>P1</option><option value="p2" ${w.owner==='p2'?'selected':''}>P2</option></select></div></div><div class="row g-3 align-items-end"><div class="col-4"><label class="form-label small text-muted mb-1">Start Date</label><input type="month" class="form-control form-control-sm border-secondary windfall-update" value="${w.start || today}" data-idx="${idx}" data-field="start"></div><div class="col-4" style="${w.freq==='one'?'display:none;':''}"><label class="form-label small text-muted mb-1">End Date</label><input type="month" class="form-control form-control-sm border-secondary windfall-update" value="${w.end}" data-idx="${idx}" data-field="end"></div><div class="col-4 d-flex align-items-center justify-content-end pb-1"><div class="form-check"><input class="form-check-input windfall-update" type="checkbox" id="wf_tax_${idx}" ${w.taxable?'checked':''} data-idx="${idx}" data-field="taxable"><label class="form-check-label text-muted small" for="wf_tax_${idx}">Is Taxable?</label></div></div></div>`;
            container.appendChild(div); div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.formatInput(e.target)));
        });
    }

    addWindfall() { this.state.windfalls.push({ name: "New Event", amount: 0, freq: 'one', owner: 'p1', taxable: false, start: new Date().toISOString().slice(0, 7), end: '' }); this.renderWindfalls(); this.run(); }
    removeWindfall(index) { this.showConfirm("Remove this event?", () => { this.state.windfalls.splice(index, 1); this.renderWindfalls(); this.run(); }); }

    renderAdditionalIncome() {
        const cP1 = document.getElementById('p1-additional-income-container'), cP2 = document.getElementById('p2-additional-income-container');
        if(cP1) cP1.innerHTML = ''; if(cP2) cP2.innerHTML = '';
        
        this.state.additionalIncome.forEach((w, idx) => {
            const tgt = w.owner === 'p2' ? cP2 : cP1; if(!tgt) return;
            const div = document.createElement('div'); div.className = 'income-stream-row p-3 border border-secondary rounded-3 bg-black bg-opacity-25 mt-3 mb-3';
            
            // Set defaults if new fields missing
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
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.removeAdditionalIncome(${idx})"><i class="bi bi-x-lg"></i></button>
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
            div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.formatInput(e.target)));
        });
    }

    addAdditionalIncome(owner) { 
        this.state.additionalIncome.push({ 
            name: "Side Hustle / Consulting", 
            amount: 0, 
            freq: 'month', 
            owner, 
            taxable: true, 
            startMode: 'date',
            start: new Date().toISOString().slice(0, 7), 
            startRel: 0,
            endMode: 'date',
            end: '', 
            duration: 10,
            growth: 2.0 
        }); 
        this.renderAdditionalIncome(); 
        this.updateIncomeDisplay(); 
        this.run(); 
    }
    
    removeAdditionalIncome(idx) { this.showConfirm("Remove income stream?", () => { this.state.additionalIncome.splice(idx, 1); this.renderAdditionalIncome(); this.updateIncomeDisplay(); this.run(); }); }

    renderProperties() {
        const c = document.getElementById('real-estate-container'); c.innerHTML = '';
        this.state.properties.forEach((p, idx) => {
            const div = document.createElement('div'); div.className = 'property-row p-4 border border-secondary rounded-3 surface-card mb-4';
            div.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary"><input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold fs-6 property-update px-0" style="max-width:300px;" value="${p.name}" data-idx="${idx}" data-field="name">${idx>0?`<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.removeProperty(${idx})"><i class="bi bi-x-lg"></i></button>`:''}</div><div class="row g-4"><div class="col-6 col-md-3"><label class="form-label text-muted fw-bold">Value</label><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num property-update" value="${p.value.toLocaleString()}" data-idx="${idx}" data-field="value"></div></div><div class="col-6 col-md-3"><label class="form-label text-muted fw-bold">Mortgage</label><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num property-update" value="${p.mortgage.toLocaleString()}" data-idx="${idx}" data-field="mortgage"></div></div><div class="col-6 col-md-3"><label class="form-label text-muted fw-bold">Growth %</label><div class="input-group input-group-sm"><input type="number" step="0.01" class="form-control border-secondary property-update" value="${p.growth}" data-idx="${idx}" data-field="growth"><span class="input-group-text border-secondary text-muted">%</span></div></div><div class="col-6 col-md-3"><label class="form-label text-muted fw-bold">Rate %</label><div class="input-group input-group-sm"><input type="number" step="0.01" class="form-control border-secondary property-update" value="${p.rate}" data-idx="${idx}" data-field="rate"><span class="input-group-text border-secondary text-muted">%</span></div></div><div class="col-12 col-md-4 mt-4"><label class="form-label text-warning fw-bold">Monthly Pmt</label><div class="input-group input-group-sm"><span class="input-group-text bg-warning bg-opacity-25 text-warning border-warning">$</span><input type="text" class="form-control border-warning formatted-num property-update text-warning fw-bold" value="${Math.round(p.payment).toLocaleString()}" data-idx="${idx}" data-field="payment"></div><div class="mt-2 small" id="prop-payoff-${idx}"></div></div><div class="col-12 border-top border-secondary pt-3 mt-4"><div class="form-check form-switch"><input class="form-check-input property-update fs-5 mt-0" type="checkbox" id="prop_nw_${idx}" ${p.includeInNW?'checked':''} data-idx="${idx}" data-field="includeInNW"><label class="form-check-label text-muted small fw-medium ms-2" style="margin-top: 3px;" for="prop_nw_${idx}">Include in Total Net Worth Calculation</label></div></div></div>`;
            c.appendChild(div); div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.formatInput(e.target)));
        });
        this.updateAllMortgages();
    }

    addProperty() { this.state.properties.push({ name: "New Property", value: 500000, mortgage: 400000, growth: 3.0, rate: 4.0, payment: 0, manual: false, includeInNW: false }); this.renderProperties(); this.run(); }
    removeProperty(idx) { this.showConfirm("Remove property?", () => { this.state.properties.splice(idx, 1); this.renderProperties(); this.run(); }); }

    updateAllMortgages() { this.state.properties.forEach((p, idx) => { if(!p.manual) this.calculateSingleMortgage(idx); this.updatePropPayoffDisplay(idx); }); }
    calculateSingleMortgage(idx) {
        const p = this.state.properties[idx]; let pmt = 0;
        if (p.mortgage > 0 && p.rate > 0) pmt = p.mortgage * ((p.rate/1200) * Math.pow(1+p.rate/1200, 300)) / (Math.pow(1+p.rate/1200, 300) - 1);
        else if (p.mortgage > 0) pmt = p.mortgage / 300;
        this.state.properties[idx].payment = pmt;
        const inputs = document.querySelectorAll(`.property-update[data-idx="${idx}"][data-field="payment"]`);
        if(inputs.length) inputs[0].value = Math.round(pmt).toLocaleString();
    }
    updatePropPayoffDisplay(idx) {
        const p = this.state.properties[idx], el = document.getElementById(`prop-payoff-${idx}`); if(!el) return;
        if(p.mortgage <= 0) return el.innerHTML = "";
        const r = (p.rate/100)/12; if(p.payment <= p.mortgage*r) return el.innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-exclamation-circle me-1"></i>Payment too low</span>`;
        const nMonths = -Math.log(1 - (r*p.mortgage)/p.payment) / Math.log(1+r);
        if(isFinite(nMonths)) el.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-calendar-check me-1"></i>Payoff: ${Math.floor(nMonths/12)}y ${Math.round(nMonths%12)}m</span>`;
    }

    toggleRow(el) { el.parentElement.classList.toggle('expanded'); el.parentElement.querySelector('.grid-detail-wrapper').classList.toggle('open'); }
    toggleModeDisplay() {
        const c = this.state.mode === 'Couple'; document.body.classList.toggle('is-couple', c);
        document.querySelectorAll('.p2-column').forEach(el => { if(!['TH','TD'].includes(el.tagName)) el.style.display = c ? '' : 'none'; });
        if(this.charts.nw) this.charts.nw.resize();
    }

    run() {
        try {
            this.estimateCPPOAS(); this.updateIncomeDisplay(); this.calcExpenses(); this.generateProjectionTable(); 
            const slider = document.getElementById('yearSlider');
            if (this.state.projectionData.length) {
                let cur = parseInt(slider.value), max = this.state.projectionData.length - 1;
                slider.max = max; if(cur > max) { slider.value = 0; cur = 0; }
                const d = this.state.projectionData[cur];
                document.getElementById('sliderYearDisplay').innerText = d.year;
                document.getElementById('cfAgeDisplay').innerText = this.state.mode === 'Couple' ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                clearTimeout(this.sliderTimeout); this.sliderTimeout = setTimeout(() => this.drawSankey(cur), 50);
            }
            this.renderComparisonChart();
            this.saveToLocalStorage();
        } catch (e) { console.error("Error:", e); }
    }

    drawSankey(idx) {
        if (!this.state.projectionData[idx] || !google?.visualization) return;
        const d = this.state.projectionData[idx], rows = [], fmt = n => n>=1000000 ? '$'+(n/1000000).toFixed(1)+'M' : (n>=1000 ? '$'+Math.round(n/1000)+'k' : '$'+Math.round(n));
        
        let totalIn = 0;
        const addRow = (from, to, val) => {
            if(Math.round(val) > 0) {
                rows.push([from, to, Math.round(val)]);
                if(to.includes('Available Cash')) totalIn += val;
            }
        };

        const potName = `Available Cash\n${fmt(d.householdNet)}`; 
        
        if(d.incomeP1>0) addRow(`Employment P1\n${fmt(d.incomeP1)}`, potName, d.incomeP1);
        if(d.postRetP1>0) addRow(`Post-Ret Work P1\n${fmt(d.postRetP1)}`, potName, d.postRetP1);
        if(d.cppP1>0) addRow(`CPP P1\n${fmt(d.cppP1)}`, potName, d.cppP1);
        if(d.oasP1>0) addRow(`OAS P1\n${fmt(d.oasP1)}`, potName, d.oasP1);
        if(d.dbP1>0) addRow(`DB Pension P1\n${fmt(d.dbP1)}`, potName, d.dbP1);
        if(d.invIncP1>0) addRow(`Inv. Yield P1\n${fmt(d.invIncP1)}`, potName, d.invIncP1);

        if(d.incomeP2>0) addRow(`Employment P2\n${fmt(d.incomeP2)}`, potName, d.incomeP2);
        if(d.postRetP2>0) addRow(`Post-Ret Work P2\n${fmt(d.postRetP2)}`, potName, d.postRetP2);
        if(d.cppP2>0) addRow(`CPP P2\n${fmt(d.cppP2)}`, potName, d.cppP2);
        if(d.oasP2>0) addRow(`OAS P2\n${fmt(d.oasP2)}`, potName, d.oasP2);
        if(d.dbP2>0) addRow(`DB Pension P2\n${fmt(d.dbP2)}`, potName, d.dbP2);
        if(d.invIncP2>0) addRow(`Inv. Yield P2\n${fmt(d.invIncP2)}`, potName, d.invIncP2);

        if(d.windfall>0) addRow(`Inheritance/Bonus\n${fmt(d.windfall)}`, potName, d.windfall);

        if(d.flows?.withdrawals) Object.entries(d.flows.withdrawals).forEach(([s,a]) => addRow(`${s}\n${fmt(a)}`, potName, a));
        
        const tTax = d.taxP1 + d.taxP2, tDebt = d.mortgagePay + d.debtPay;
        
        if(tTax>0) addRow(potName, `Taxes\n${fmt(tTax)}`, tTax);
        if(d.expenses>0) addRow(potName, `Living Exp.\n${fmt(d.expenses)}`, d.expenses);
        if(tDebt>0) addRow(potName, `Mortgage/Debt\n${fmt(tDebt)}`, tDebt);
        
        if(d.flows?.contributions) {
             Object.entries(d.flows.contributions.p1).forEach(([t,a]) => addRow(potName, `To P1 ${this.strategyLabels[t]||t}\n${fmt(a)}`, a));
             Object.entries(d.flows.contributions.p2).forEach(([t,a]) => addRow(potName, `To P2 ${this.strategyLabels[t]||t}\n${fmt(a)}`, a));
        }

        const unq = new Set(); rows.forEach(r => { unq.add(r[0]); unq.add(r[1]); });
        const nodesCfg = Array.from(unq).map(n => {
            let c='#a8a29e'; 
            if(n.includes("P1")) c='#0ea5e9';
            if(n.includes("P2")) c='#8b5cf6';
            if(n.includes("Taxes")) c='#ef4444'; 
            if(n.includes("Exp")) c='#f97316'; 
            if(n.includes("Mort")||n.includes("Debt")) c='#dc2626'; 
            if(n.includes("Available Cash")) c='#10b981';
            return { color: c };
        });

        const dt = new google.visualization.DataTable(); dt.addColumn('string','From'); dt.addColumn('string','To'); dt.addColumn('number','Amount'); dt.addRows(rows);
        this.charts.sankey = new google.visualization.Sankey(document.getElementById('sankey_chart'));
        this.charts.sankey.draw(dt, { sankey: { node: { label: { color: document.documentElement.getAttribute('data-bs-theme')==='light'?'#000':'#fff', fontSize:13, bold:true }, nodePadding:30, width:12, colors: nodesCfg.map(x=>x.color) }, link: { colorMode: 'gradient', colors: ['#334155','#475569'] } }, backgroundColor: 'transparent', height: 600, width: '100%' });
    }

    getRrifFactor(age) {
        if(age<71) return 1/(90-age); if(age>=95) return 0.20;
        return {71:0.0528,72:0.0540,73:0.0553,74:0.0567,75:0.0582,76:0.0598,77:0.0617,78:0.0636,79:0.0658,80:0.0682,81:0.0708,82:0.0738,83:0.0771,84:0.0808,85:0.0851,86:0.0899,87:0.0955,88:0.1021,89:0.1099,90:0.1192,91:0.1306,92:0.1449,93:0.1634,94:0.1879}[age] || 0.0528;
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

    generateProjectionTable(onlyCalcNW = false) {
        if(!onlyCalcNW) this.state.projectionData = [];
        const mode = this.state.mode;
        const curY = new Date().getFullYear();
        
        let person1 = { tfsa: this.getVal('p1_tfsa'), rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), crypto: this.getVal('p1_crypto'), lirf: this.getVal('p1_lirf'), lif: this.getVal('p1_lif'), rrif_acct: this.getVal('p1_rrif_acct'), inc: this.getVal('p1_income'), dob: new Date(this.getRaw('p1_dob')), retAge: this.getVal('p1_retireAge'), lifeExp: this.getVal('p1_lifeExp'), nreg_yield: this.getVal('p1_nonreg_yield')/100, acb: this.getVal('p1_nonreg') };
        let person2 = { tfsa: this.getVal('p2_tfsa'), rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), dob: new Date(this.getRaw('p2_dob')), retAge: this.getVal('p2_retireAge'), lifeExp: this.getVal('p2_lifeExp'), nreg_yield: this.getVal('p2_nonreg_yield')/100, acb: this.getVal('p2_nonreg') };

        let simProperties = JSON.parse(JSON.stringify(this.state.properties));
        let totalDebt = this.getTotalDebt();
        const p1StartAge = curY - person1.dob.getFullYear();
        const p2StartAge = curY - person2.dob.getFullYear();
        const endAge = Math.max(person1.lifeExp, mode==='Couple'?person2.lifeExp:0);
        const yearsToRun = endAge - Math.min(p1StartAge, mode==='Couple'?p2StartAge:p1StartAge);
        let trackedEvents = new Set();
        let finalNetWorth = 0;

        let consts = {
            cppMax1: this.getVal('p1_cpp_est_base'),
            oasMax1: this.CONSTANTS.MAX_OAS_2026 * (Math.max(0, Math.min(40, this.getVal('p1_oas_years'))) / 40),
            cppMax2: this.getVal('p2_cpp_est_base'),
            oasMax2: this.CONSTANTS.MAX_OAS_2026 * (Math.max(0, Math.min(40, this.getVal('p2_oas_years'))) / 40),
            tfsaLimit: this.getVal('cfg_tfsa_limit') || 7000,
            rrspMax: this.getVal('cfg_rrsp_limit') || 32960,
            inflation: this.getVal('inflation_rate')/100
        };

        for (let i=0; i<=yearsToRun; i++) {
            const yr = curY+i;
            const age1 = p1StartAge+i;
            const age2 = p2StartAge+i;
            const alive1 = age1 <= person1.lifeExp;
            const alive2 = mode==='Couple' ? age2 <= person2.lifeExp : false;
            
            if (!alive1 && !alive2) break;

            const bInf = Math.pow(1+consts.inflation, i);
            const isRet1 = age1 >= person1.retAge;
            const isRet2 = mode==='Couple' ? age2 >= person2.retAge : true;
            
            this.applyGrowth(person1, person2, isRet1, isRet2, this.state.inputs['asset_mode_advanced'], consts.inflation, i);

            const inflows = this.calcInflows(yr, i, person1, person2, age1, age2, alive1, alive2, isRet1, isRet2, consts, bInf, trackedEvents);
            const rrifMin = this.calcRRIFMin(person1, person2, age1, age2, alive1, alive2);
            const expenses = this.calcOutflows(yr, i, age1, bInf, isRet1, isRet2);

            let mortgagePayment = 0;
            simProperties.forEach(p => { 
                if(p.mortgage>0 && p.payment>0) { 
                    let annPmt=p.payment*12, interest=p.mortgage*(p.rate/100), principal=annPmt-interest; 
                    if(principal>p.mortgage) { principal=p.mortgage; annPmt=principal+interest; } 
                    p.mortgage=Math.max(0, p.mortgage-principal); 
                    mortgagePayment+=annPmt; 
                } 
                p.value*=(1+(p.growth/100)); 
            });
            let debtRepayment = totalDebt>0 ? Math.min(totalDebt, 6000) : 0; totalDebt-=debtRepayment;
            if(simProperties.reduce((s,p)=>s+p.mortgage,0)<=0 && !trackedEvents.has('Mortgage Paid')){ trackedEvents.add('Mortgage Paid'); inflows.events.push('Mortgage Paid'); }

            let taxableIncome1 = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + rrifMin.p1 + inflows.p1.windfallTaxable + (person1.nreg * person1.nreg_yield);
            let taxableIncome2 = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + rrifMin.p2 + inflows.p2.windfallTaxable + (alive2 ? (person2.nreg * person2.nreg_yield) : 0);

            if (mode === 'Couple' && this.state.inputs['pension_split_enabled']) {
                this.applyPensionSplitting(taxableIncome1, taxableIncome2, inflows, rrifMin, person1, person2, age1, age2, (n1, n2) => { taxableIncome1=n1; taxableIncome2=n2; });
            }

            let rrspDed = { p1: 0, p2: 0 };
            const taxBrackets = this.getInflatedTaxData(bInf);
            if(this.state.inputs['strat_rrsp_topup']) {
                 const lowBracket = taxBrackets.FED.brackets[0];
                 if(alive1 && person1.rrsp>0 && taxableIncome1 < lowBracket) {
                     let d = Math.min(lowBracket - taxableIncome1, person1.rrsp);
                     if(d>0) { person1.rrsp-=d; taxableIncome1+=d; rrspDed.p1=d; }
                 }
                 if(alive2 && person2.rrsp>0 && taxableIncome2 < lowBracket) {
                     let d = Math.min(lowBracket - taxableIncome2, person2.rrsp);
                     if(d>0) { person2.rrsp-=d; taxableIncome2+=d; rrspDed.p2=d; }
                 }
            }

            let tax1 = alive1 ? this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets) : {totalTax:0, margRate: 0};
            let tax2 = alive2 ? this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets) : {totalTax:0, margRate: 0};

            let netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
            let netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
            
            let totalNetIncome = netIncome1 + netIncome2;
            const totalOutflows = expenses + mortgagePayment + debtRepayment;
            let surplus = totalNetIncome - totalOutflows;

            let flowLog = { contributions: { p1:{tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0}, p2:{tfsa:0, rrsp:0, nreg:0, cash:0, crypto:0} }, withdrawals: {} };
            let wdBreakdown = { p1: {}, p2: {} };

            if(rrifMin.p1>0) { flowLog.withdrawals['P1 RRIF']=(flowLog.withdrawals['P1 RRIF']||0)+rrifMin.p1; wdBreakdown.p1.RRIF=rrifMin.p1; }
            if(rrifMin.p2>0) { flowLog.withdrawals['P2 RRIF']=(flowLog.withdrawals['P2 RRIF']||0)+rrifMin.p2; wdBreakdown.p2.RRIF=rrifMin.p2; }
            if(rrspDed.p1>0) { flowLog.withdrawals['P1 RRSP Top-Up']=(flowLog.withdrawals['P1 RRSP Top-Up']||0)+rrspDed.p1; wdBreakdown.p1.RRSP=rrspDed.p1; }
            if(rrspDed.p2>0) { flowLog.withdrawals['P2 RRSP Top-Up']=(flowLog.withdrawals['P2 RRSP Top-Up']||0)+rrspDed.p2; wdBreakdown.p2.RRSP=rrspDed.p2; }

            const rrspRoom1 = Math.min(inflows.p1.earned * 0.18, consts.rrspMax * bInf);
            const rrspRoom2 = Math.min(inflows.p2.earned * 0.18, consts.rrspMax * bInf);

            if (surplus > 0) {
                this.handleSurplus(surplus, person1, person2, alive1, alive2, flowLog, i, consts.tfsaLimit*bInf, rrspRoom1, rrspRoom2);
            } else {
                // Iterative Deficit Handling loop (Max 5 passes to converge on tax impact)
                let addedToTaxableIncome = 0; // Accumulate taxable gross-ups (RRSP etc) here
                
                for(let pass=0; pass<5; pass++) {
                    // Recalculate everything dynamic
                    let dynTax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets);
                    let dynTax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets);
                    
                    // Update main loop tax vars for final display
                    tax1 = dynTax1; 
                    tax2 = dynTax2;

                    let dynNet1 = taxableIncome1 - dynTax1.totalTax + inflows.p1.windfallNonTax;
                    let dynNet2 = alive2 ? taxableIncome2 - dynTax2.totalTax + inflows.p2.windfallNonTax : 0;
                    let dynTotalNet = dynNet1 + dynNet2;
                    
                    // Correctly calculate cash generated from withdrawals that WASN'T added to taxable income (e.g. TFSA)
                    let currentWithdrawals = Object.values(flowLog.withdrawals).reduce((a,b)=>a+b,0);
                    let cashFromNonTaxableWd = Math.max(0, currentWithdrawals - addedToTaxableIncome);

                    // Deficit = Total Outflows - (Net Income + Non-Taxable Cash generated by withdrawals)
                    let currentDeficit = totalOutflows - (dynTotalNet + cashFromNonTaxableWd);
                    
                    if (currentDeficit < 1) break; // Close enough
                    
                    this.handleDeficit(currentDeficit, person1, person2, taxableIncome1, taxableIncome2, alive1, alive2, flowLog, wdBreakdown, taxBrackets, (pfx, taxAmt, grossAmt) => {
                        // This callback updates the income tracking for the NEXT pass
                        if (pfx === 'p1') taxableIncome1 += grossAmt;
                        if (pfx === 'p2') taxableIncome2 += grossAmt;
                        addedToTaxableIncome += grossAmt; // Track this so we don't double count it in the Non-Taxable calculation
                    }, age1, age2);
                }
                
                // Final Recalc for display consistency
                tax1 = this.calculateTaxDetailed(taxableIncome1, this.getRaw('tax_province'), taxBrackets);
                tax2 = this.calculateTaxDetailed(taxableIncome2, this.getRaw('tax_province'), taxBrackets);
                netIncome1 = taxableIncome1 - tax1.totalTax + inflows.p1.windfallNonTax;
                netIncome2 = alive2 ? taxableIncome2 - tax2.totalTax + inflows.p2.windfallNonTax : 0;
                surplus = (netIncome1 + netIncome2) - totalOutflows;
            }

            const assets1 = person1.tfsa+person1.rrsp+person1.crypto+person1.nreg+person1.cash+person1.lirf+person1.lif+person1.rrif_acct;
            const assets2 = alive2 ? person2.tfsa+person2.rrsp+person2.crypto+person2.nreg+person2.cash+person2.lirf+person2.lif+person2.rrif_acct : 0;
            const liquidNW = (assets1 + assets2) - totalDebt;
            let realEstateValue = 0, realEstateDebt = 0;
            simProperties.forEach(p => { if(p.includeInNW) { realEstateValue+=p.value; realEstateDebt+=p.mortgage; } });
            finalNetWorth = liquidNW + (realEstateValue - realEstateDebt);

            if(!onlyCalcNW) {
                // Gross Inflow for Display
                const totalWithdrawals = Object.values(flowLog.withdrawals).reduce((a,b)=>a+b,0);
                const p1GrossTotal = inflows.p1.gross + inflows.p1.cpp + inflows.p1.oas + inflows.p1.pension + inflows.p1.windfallTaxable + inflows.p1.windfallNonTax;
                const p2GrossTotal = inflows.p2.gross + inflows.p2.cpp + inflows.p2.oas + inflows.p2.pension + inflows.p2.windfallTaxable + inflows.p2.windfallNonTax;
                const totalYield = (person1.nreg * person1.nreg_yield) + (alive2 ? (person2.nreg * person2.nreg_yield) : 0);
                const grossInflow = p1GrossTotal + p2GrossTotal + totalYield + totalWithdrawals;
                
                // Net Cash Surplus
                const cashSurplus = grossInflow - (totalOutflows + tax1.totalTax + tax2.totalTax);

                this.state.projectionData.push({
                    year: yr, p1Age: age1, p2Age: alive2?age2:null, p1Alive: alive1, p2Alive: alive2,
                    incomeP1: inflows.p1.gross, incomeP2: inflows.p2.gross,
                    cppP1: inflows.p1.cpp, cppP2: inflows.p2.cpp,
                    oasP1: inflows.p1.oas, oasP2: inflows.p2.oas,
                    benefitsP1: inflows.p1.cpp + inflows.p1.oas, benefitsP2: inflows.p2.cpp + inflows.p2.oas,
                    dbP1: inflows.p1.pension, dbP2: inflows.p2.pension,
                    taxP1: tax1.totalTax, taxP2: tax2.totalTax,
                    p1Net: netIncome1, p2Net: netIncome2,
                    expenses: expenses, mortgagePay: mortgagePayment, debtPay: debtRepayment,
                    surplus: Math.abs(cashSurplus) < 5 ? 0 : cashSurplus,
                    debugNW: finalNetWorth,
                    liquidNW: liquidNW,
                    assetsP1: {...person1}, assetsP2: {...person2},
                    wdBreakdown: wdBreakdown,
                    flows: flowLog,
                    events: inflows.events,
                    householdNet: grossInflow, // Total cash flowing in
                    grossInflow: grossInflow, 
                    visualExpenses: expenses + mortgagePayment + debtRepayment + tax1.totalTax + tax2.totalTax,
                    mortgage: simProperties.reduce((s,p)=>s+p.mortgage,0), 
                    homeValue: simProperties.reduce((s,p)=>s+p.value,0),
                    windfall: inflows.p1.windfallTaxable + inflows.p1.windfallNonTax + inflows.p2.windfallTaxable + inflows.p2.windfallNonTax,
                    postRetP1: inflows.p1.postRet, postRetP2: inflows.p2.postRet,
                    invIncP1: (person1.nreg * person1.nreg_yield), invIncP2: (person2.nreg * person2.nreg_yield),
                    debugTotalInflow: grossInflow
                });
            }

            consts.cppMax1*=(1+consts.inflation); consts.oasMax1*=(1+consts.inflation);
            consts.cppMax2*=(1+consts.inflation); consts.oasMax2*=(1+consts.inflation);
        }
        
        if(!onlyCalcNW) this.renderProjectionGrid();
        return finalNetWorth;
    }

    applyGrowth(p1, p2, isRet1, isRet2, isAdv, inf, i) {
        const stress = this.state.inputs['stressTestEnabled'] && i === 0; 
        const getRates = (p, ret) => {
            const r = id => this.getVal(`${p}_${id}_ret` + (isAdv && ret ? '_retire' : ''))/100;
            return { 
                tfsa: r('tfsa'), rrsp: r('rrsp'), cash: r('cash'), nreg: r('nonreg'), 
                cryp: r('crypto'), lirf: r('lirf'), lif: r('lif'), rrif_acct: r('rrif_acct'), 
                inc: this.getVal(`${p}_income_growth`)/100 
            };
        };
        const g1 = getRates('p1', isRet1), g2 = getRates('p2', isRet2);
        
        if(stress) { ['tfsa','rrsp','nreg','cash','lirf','lif','rrif_acct'].forEach(k=>{ g1[k]=-0.15; g2[k]=-0.15; }); g1.cryp=-0.40; g2.cryp=-0.40; }

        const grow = (p, rates) => {
            p.tfsa*=(1+rates.tfsa); p.rrsp*=(1+rates.rrsp); p.cash*=(1+rates.cash); p.crypto*=(1+rates.cryp);
            p.lirf*=(1+rates.lirf); p.lif*=(1+rates.lif); p.rrif_acct*=(1+rates.rrif_acct);
            p.nreg *= (1 + (rates.nreg - p.nreg_yield));
            if(!isRet1) p.inc *= (1+rates.inc); 
        };
        grow(p1, g1); grow(p2, g2);
    }

    calcInflows(yr, i, p1, p2, age1, age2, alive1, alive2, isRet1, isRet2, c, bInf, events) {
        let res = { p1: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0 }, p2: { gross:0, earned:0, cpp:0, oas:0, pension:0, windfallTaxable:0, windfallNonTax:0, postRet:0 }, events: [] };
        
        const calcP = (p, age, isRet, pfx, maxCpp, maxOas) => {
            let inf = { gross:0, earned:0, cpp:0, oas:0, pension:0, postRet:0 };
            if(!isRet) { inf.gross += p.inc; inf.earned += p.inc; }
            
            if(this.state.inputs[`${pfx}_db_enabled`]) {
                const lStart = parseInt(this.getRaw(`${pfx}_db_lifetime_start`)||60), bStart = parseInt(this.getRaw(`${pfx}_db_bridge_start`)||60);
                if(age >= lStart) inf.pension += this.getVal(`${pfx}_db_lifetime`) * 12 * bInf;
                if(age >= bStart && age < 65) inf.pension += this.getVal(`${pfx}_db_bridge`) * 12 * bInf;
            }

            if(this.state.inputs[`${pfx}_cpp_enabled`] && age>=parseInt(this.getRaw(`${pfx}_cpp_start`))) {
                inf.cpp = this.calcBen(maxCpp, parseInt(this.getRaw(`${pfx}_cpp_start`)), 1, p.retAge, 'cpp');
                if(age === parseInt(this.getRaw(`${pfx}_cpp_start`))) events.add(`${pfx.toUpperCase()} CPP`);
            }
            if(this.state.inputs[`${pfx}_oas_enabled`] && age>=parseInt(this.getRaw(`${pfx}_oas_start`))) {
                inf.oas = this.calcBen(maxOas, parseInt(this.getRaw(`${pfx}_oas_start`)), 1, 65, 'oas');
                if(age === parseInt(this.getRaw(`${pfx}_oas_start`))) events.add(`${pfx.toUpperCase()} OAS`);
            }
            return inf;
        };

        if(alive1) { let r = calcP(p1, age1, isRet1, 'p1', c.cppMax1, c.oasMax1); res.p1 = {...res.p1, ...r}; }
        if(alive2) { let r = calcP(p2, age2, isRet2, 'p2', c.cppMax2, c.oasMax2); res.p2 = {...res.p2, ...r}; }

        if(alive1 && isRet1 && !events.has('P1 Retires')){ events.add('P1 Retires'); res.events.push('P1 Retires'); }
        if(alive2 && isRet2 && !events.has('P2 Retires')){ events.add('P2 Retires'); res.events.push('P2 Retires'); }
        
        this.state.windfalls.forEach(w => {
            let act=false, amt=0, sY=new Date(w.start+"-01").getFullYear();
            if(w.freq==='one'){ if(sY===yr) { act=true; amt=w.amount; } }
            else { let eY=(w.end?new Date(w.end+"-01"):new Date("2100-01-01")).getFullYear(); if(yr>=sY && yr<=eY) { act=true; amt=w.amount*(w.freq==='month'?(yr===sY?12-new Date(w.start+"-01").getMonth():(yr===eY?new Date(w.end+"-01").getMonth()+1:12)):1); } }
            if(act && amt>0){ 
                if(w.freq==='one') res.events.push('Windfall');
                let target = (w.owner==='p2' && alive2) ? res.p2 : res.p1;
                if(w.taxable) target.windfallTaxable += amt; else target.windfallNonTax += amt;
            }
        });

        this.state.additionalIncome.forEach(s => {
            let sY, eY;
            
            // Calculate Start Year
            if (s.startMode === 'ret_relative') {
                const ownerP = s.owner === 'p2' ? p2 : p1;
                const retYear = ownerP.dob.getFullYear() + ownerP.retAge;
                sY = retYear + (s.startRel || 0);
            } else {
                sY = new Date(s.start+"-01").getFullYear();
            }

            // Calculate End Year
            if (s.endMode === 'duration') {
                eY = sY + (s.duration || 0);
            } else {
                eY = (s.end ? new Date(s.end+"-01") : new Date("2100-01-01")).getFullYear();
            }

            if(yr>=sY && yr<=eY) {
                // Growth calc needs base year. For relative start, base is sY. For date start, base is s.start
                let baseYear = s.startMode === 'ret_relative' ? sY : new Date(s.start+"-01").getFullYear();
                
                let amt = s.amount * Math.pow(1+(s.growth/100), yr-baseYear);
                
                // Frequency Adjustment
                amt *= (s.freq==='month' ? 12 : 1);
                
                // Partial year logic (simplified for relative dates to be full year)
                if (s.startMode === 'date') {
                     if (yr === sY) amt *= (12 - new Date(s.start+"-01").getMonth()) / 12;
                }
                if (s.endMode === 'date' && s.end) {
                     if (yr === eY) amt *= Math.min(1, (new Date(s.end+"-01").getMonth() + 1) / 12);
                }

                if(amt>0) { 
                    let target = (s.owner==='p2' && alive2) ? res.p2 : res.p1;
                    if (target) {
                        if(s.taxable) { 
                            target.gross += amt; 
                            target.earned += amt;
                            // Check if this is technically post-retirement work
                            const ownerP = s.owner === 'p2' ? p2 : p1;
                            const isRet = (s.owner==='p2' ? isRet2 : isRet1);
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
        if(alive1 && p1.rrsp>0 && age1>=this.CONSTANTS.RRIF_START_AGE){ r.p1=p1.rrsp*this.getRrifFactor(age1); p1.rrsp-=r.p1; }
        if(alive2 && p2.rrsp>0 && age2>=this.CONSTANTS.RRIF_START_AGE){ r.p2=p2.rrsp*this.getRrifFactor(age2); p2.rrsp-=r.p2; }
        return r;
    }

    calcOutflows(yr, i, age, bInf, isRet1, isRet2) {
        let expTotals = { curr:0, ret:0, trans:0, gogo:0, slow:0, nogo:0 };
        Object.values(this.expensesByCategory).forEach(c => c.items.forEach(item => { 
            const f=item.freq; expTotals.curr+=(item.curr||0)*f; expTotals.ret+=(item.ret||0)*f; 
            expTotals.trans+=(item.trans||0)*f; expTotals.gogo+=(item.gogo||0)*f; expTotals.slow+=(item.slow||0)*f; expTotals.nogo+=(item.nogo||0)*f; 
        }));
        
        let exp = 0;
        const fullyRetired = isRet1 && isRet2;
        const gLim = parseInt(this.getRaw('exp_gogo_age'))||75, sLim = parseInt(this.getRaw('exp_slow_age'))||85;

        if(this.state.expenseMode === 'Simple') {
            exp = fullyRetired ? expTotals.ret : expTotals.curr;
        } else {
            if(!fullyRetired) exp = expTotals.curr;
            else if(age < gLim) exp = expTotals.gogo;
            else if(age < sLim) exp = expTotals.slow;
            else exp = expTotals.nogo;
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
        this.state.strategies.accum.forEach(t => { 
            if(r<=0) return;
            if(t==='tfsa'){ 
                if(alive1 && (!this.state.inputs['skip_first_tfsa_p1']||i>0)){
                    let take = Math.min(r, tfsaLim); p1.tfsa+=take; log.contributions.p1.tfsa+=take; r-=take;
                } 
                if(alive2 && r>0 && (!this.state.inputs['skip_first_tfsa_p2']||i>0)){
                    let take = Math.min(r, tfsaLim); p2.tfsa+=take; log.contributions.p2.tfsa+=take; r-=take;
                } 
            }
            else if(t==='rrsp'){
                let priority = [];
                const p1HasRoom = (!this.state.inputs['skip_first_rrsp_p1']||i>0) && alive1;
                const p2HasRoom = (!this.state.inputs['skip_first_rrsp_p2']||i>0) && alive2;
                if (p1HasRoom && p2HasRoom) {
                    if (p1.rrsp < p2.rrsp) priority = [{p: p1, room: rrspLim1, k: 'p1'}, {p: p2, room: rrspLim2, k: 'p2'}];
                    else priority = [{p: p2, room: rrspLim2, k: 'p2'}, {p: p1, room: rrspLim1, k: 'p1'}];
                } else if (p1HasRoom) priority = [{p: p1, room: rrspLim1, k: 'p1'}];
                else if (p2HasRoom) priority = [{p: p2, room: rrspLim2, k: 'p2'}];

                priority.forEach(obj => {
                    if (r > 0) {
                        let take = Math.min(r, obj.room);
                        obj.p.rrsp += take; log.contributions[obj.k].rrsp += take; r -= take;
                    }
                });
            }
            else if(t==='nreg'){
                if(alive1){ p1.nreg+=r; log.contributions.p1.nreg+=r; p1.acb+=r; r=0; }
            } 
            else if(t==='cash'){
                if(alive1){ p1.cash+=r; log.contributions.p1.cash+=r; r=0; }
            } 
            else if(t==='crypto'){
                if(alive1){ p1.crypto+=r; log.contributions.p1.crypto+=r; r=0; }
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
        const strats = this.state.strategies.decum;

        const wd = (p, t, a, pfx, mRate) => { 
            if(a<=0 || p[t]<=0) return 0;
            
            let isTaxable = ['rrsp', 'rrif_acct', 'lif', 'lirf'].includes(t);
            let grossNeeded = a;

            if (isTaxable) {
                // Gross up to cover tax
                let effRate = Math.min(mRate || 0, 0.54); 
                grossNeeded = a / (1 - effRate);
            }
            
            let tk = Math.min(p[t], grossNeeded);
            
            let currentAge = (pfx === 'p1') ? age1 : age2;
            let logKey = this.strategyLabels[t];
            if (t === 'rrsp' && currentAge >= this.CONSTANTS.RRIF_START_AGE) logKey = 'RRIF';

            p[t] -= tk;
            
            // Update Stats
            let k = (pfx.toUpperCase())+" "+logKey;
            log.withdrawals[k] = (log.withdrawals[k]||0) + tk;
            breakdown[pfx][logKey] = (breakdown[pfx][logKey]||0) + tk;
            
            // Calculate actual tax impact (approx for loop sorting, precise for callback)
            if (isTaxable) {
                 // For RRSP/RRIF, the entire amount is taxable income
                 if(onWithdrawal) onWithdrawal(pfx, 0, tk);
            } else if (t === 'nreg') {
                 // For Non-Reg... Let's defer NREG income updates to the outer loop since they are complex.
            }

            // Return NET cash obtained
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
                
                // If one couldn't pay their half, push remainder to deficit
                df = df - (gotP1 + gotP2);
                
                // Update running income estimate for sorting
                if(['rrsp','rrif_acct','lif','lirf'].includes(p1Type)) runInc1 += (gotP1 / (1-Math.min(mR1,0.54)));
                if(['rrsp','rrif_acct','lif','lirf'].includes(p2Type)) runInc2 += (gotP2 / (1-Math.min(mR2,0.54)));

            } else {
                let toTake = df;
                if (p1Type && p2Type) {
                    let gap = Math.abs(runInc1 - runInc2);
                    let mR = (target === 'p1' ? mR1 : mR2);
                    let effRate = Math.min(mR || 0, 0.54);
                    // Estimate net gap
                    let netGap = gap * (1 - effRate);
                    if (netGap > 0) toTake = Math.min(df, netGap);
                }
                
                if (toTake < 10) toTake = Math.min(df, 500);

                if (target === 'p1') {
                    let got = wd(p1, p1Type, toTake, 'p1', mR1);
                    if(['rrsp','rrif_acct','lif','lirf'].includes(p1Type)) runInc1 += (got / (1-Math.min(mR1,0.54)));
                    df -= got;
                } else {
                    let got = wd(p2, p2Type, toTake, 'p2', mR2);
                    if(['rrsp','rrif_acct','lif','lirf'].includes(p2Type)) runInc2 += (got / (1-Math.min(mR2,0.54)));
                    df -= got;
                }
            }
        }
    }

    renderProjectionGrid() {
        const th = document.documentElement.getAttribute('data-bs-theme')||'dark';
        const hC = th==='light'?'bg-white text-dark border-bottom border-dark-subtle':'bg-transparent text-white border-secondary';
        const tT = th==='light'?'text-dark':'text-body';
        let html = `<div class="grid-header ${hC}"><div class="col-start col-timeline ${tT}">Timeline</div><div class="col-start">Status</div><div class="text-body ${tT}">Cash Inflow</div><div class="text-danger">Expenses</div><div class="${tT}">Surplus</div><div class="${tT}">Net Worth</div><div class="text-center ${tT}"><i class="bi bi-chevron-bar-down"></i></div></div>`;
        
        this.state.projectionData.forEach((d) => {
            const df = this.getDiscountFactor(d.year - new Date().getFullYear());
            const fmtK = n => { const v=n/df, a=Math.abs(v); if(Math.round(a)===0)return''; const s=v<0?'-':''; return a>=1000000?s+(a/1000000).toFixed(1)+'M':(a>=1000?s+Math.round(a/1000)+'k':s+a.toFixed(0)); };
            const fmtC = (v) => v > 0 ? ` <span class="text-success small fw-bold">(+${fmtK(v)})</span>` : '';
            const fmtFlow = (c, w) => {
                if(c > 0) return ` <span class="text-success small fw-bold">(+${fmtK(c)})</span>`;
                if(w > 0) return ` <span class="text-danger small fw-bold">(-${fmtK(w)})</span>`;
                return '';
            };
            const p1A=d.p1Alive?d.p1Age:'†', p2A=this.state.mode==='Couple'?(d.p2Alive?d.p2Age:'†'):'';
            
            const p1R = this.getVal('p1_retireAge') <= d.p1Age, p2R = this.getVal('p2_retireAge') <= (d.p2Age||0);
            const gLim = parseInt(this.getRaw('exp_gogo_age')), sLim = parseInt(this.getRaw('exp_slow_age'));
            let stat = `<span class="status-pill status-working">Working</span>`;
            if(this.state.mode==='Couple') { if(p1R&&p2R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`; else if(p1R||p2R) stat = `<span class="status-pill status-semi">Transition</span>`; }
            else if(p1R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`;
            
            const ln = (l,v,c='') => (!v||Math.round(v)===0)?'':`<div class="detail-item"><span>${l}</span> <span class="${c}">${fmtK(v)}</span></div>`;
            const sL = (l,v) => (!v||Math.round(v)===0)?'':`<div class="detail-item sub"><span>${l}</span> <span>${fmtK(v)}</span></div>`;
            
            let groupP1 = '', groupP2 = '', groupOther = '';
            if(d.incomeP1 > 0) groupP1 += ln("Employment", d.incomeP1);
            if(d.postRetP1 > 0) groupP1 += sL("Post-Ret Work", d.postRetP1);
            if(d.cppP1 > 0) groupP1 += sL("CPP", d.cppP1);
            if(d.oasP1 > 0) groupP1 += sL("OAS", d.oasP1);
            if(d.dbP1 > 0) groupP1 += sL("DB Pension", d.dbP1);
            if(d.invIncP1 > 0) groupP1 += ln("Inv. Yield (Taxable)", d.invIncP1, "text-muted");
            
            Object.entries(d.wdBreakdown.p1).forEach(([t,a]) => groupP1 += sL(`${t} Withdrawals`, a));

            if(this.state.mode==='Couple') {
                if(d.incomeP2 > 0) groupP2 += ln("Employment", d.incomeP2);
                if(d.postRetP2 > 0) groupP2 += sL("Post-Ret Work", d.postRetP2);
                if(d.cppP2 > 0) groupP2 += sL("CPP", d.cppP2);
                if(d.oasP2 > 0) groupP2 += sL("OAS", d.oasP2);
                if(d.dbP2 > 0) groupP2 += sL("DB Pension", d.dbP2);
                if(d.invIncP2 > 0) groupP2 += ln("Inv. Yield (Taxable)", d.invIncP2, "text-muted");
                Object.entries(d.wdBreakdown.p2).forEach(([t,a]) => groupP2 += sL(`${t} Withdrawals`, a));
            }

            if(d.windfall > 0) groupOther += ln("Inheritance/Bonus", d.windfall, "text-success fw-bold");

            let iL = '';
            if(groupP1) iL += `<div class="mb-2"><span class="text-info fw-bold small text-uppercase" style="font-size:0.7rem; border-bottom:1px solid #334155; display:block; margin-bottom:4px;">Player 1</span>${groupP1}</div>`;
            if(groupP2) iL += `<div class="mb-2"><span class="text-purple fw-bold small text-uppercase" style="font-size:0.7rem; border-bottom:1px solid #334155; display:block; margin-bottom:4px;">Player 2</span>${groupP2}</div>`;
            if(groupOther) iL += `<div>${groupOther}</div>`;
            
            let eL = ln("Living Exp",d.expenses)+ln("Mortgage",d.mortgagePay)+ln("Debt Repayment",d.debtPay)+ln("Tax Paid P1",d.taxP1,"val-negative")+(this.state.mode==='Couple'?ln("Tax Paid P2",d.taxP2,"val-negative"):'');
            
            let aL = ln(`TFSA P1${fmtFlow(d.flows.contributions.p1.tfsa, d.wdBreakdown.p1['TFSA'])}`, d.assetsP1.tfsa) + (this.state.mode==='Couple'?ln(`TFSA P2${fmtFlow(d.flows.contributions.p2.tfsa, d.wdBreakdown.p2['TFSA'])}`, d.assetsP2.tfsa):'');
            
            let r1Label = d.p1Age >= 72 ? 'RRIF' : 'RRSP';
            let r1Wd = (d.wdBreakdown.p1['RRSP']||0) + (d.wdBreakdown.p1['RRIF']||0);
            aL += ln(`${r1Label} P1${fmtFlow(d.flows.contributions.p1.rrsp, r1Wd)}`, d.assetsP1.rrsp);
            
            if(this.state.mode === 'Couple') {
                let r2Label = d.p2Age >= 72 ? 'RRIF' : 'RRSP';
                let r2Wd = (d.wdBreakdown.p2['RRSP']||0) + (d.wdBreakdown.p2['RRIF']||0);
                aL += ln(`${r2Label} P2${fmtFlow(d.flows.contributions.p2.rrsp, r2Wd)}`, d.assetsP2.rrsp);
            }

            aL += ln("LIRF P1",d.assetsP1.lirf) + (this.state.mode==='Couple'?ln("LIRF P2",d.assetsP2.lirf):'');
            aL += ln("LIF P1",d.assetsP1.lif) + (this.state.mode==='Couple'?ln("LIF P2",d.assetsP2.lif):'');
            aL += ln("Manual RRIF P1",d.assetsP1.rrif_acct) + (this.state.mode==='Couple'?ln("Manual RRIF P2",d.assetsP2.rrif_acct):'');
            aL += ln(`Non-Reg P1${fmtFlow(d.flows.contributions.p1.nreg, d.wdBreakdown.p1['Non-Reg'])}`, d.assetsP1.nreg) + (this.state.mode==='Couple'?ln(`Non-Reg P2${fmtFlow(d.flows.contributions.p2.nreg, d.wdBreakdown.p2['Non-Reg'])}`, d.assetsP2.nreg):'');
            aL += ln(`Cash P1${fmtFlow(d.flows.contributions.p1.cash, d.wdBreakdown.p1['Cash'])}`, d.assetsP1.cash) + (this.state.mode==='Couple'?ln(`Cash P2${fmtFlow(d.flows.contributions.p2.cash, d.wdBreakdown.p2['Cash'])}`, d.assetsP2.cash):'');
            aL += ln(`Crypto P1${fmtFlow(d.flows.contributions.p1.crypto, d.wdBreakdown.p1['Crypto'])}`, d.assetsP1.crypto) + (this.state.mode==='Couple'?ln(`Crypto P2${fmtFlow(d.flows.contributions.p2.crypto, d.wdBreakdown.p2['Crypto'])}`, d.assetsP2.crypto):'');
            aL += ln("Liquid Net Worth",d.liquidNW,"text-info fw-bold")+ln("Total Real Estate Eq.",d.homeValue-d.mortgage);
            
            const rB = th==='light'?'bg-white border-bottom border-dark-subtle':'', rT = th==='light'?'text-dark':'text-white';
            html += `<div class="grid-row-group" style="${th==='light'?'border-bottom:1px solid #ddd;':''}"><div class="grid-summary-row ${rB}" onclick="app.toggleRow(this)"><div class="col-start col-timeline"><div class="d-flex align-items-center"><span class="fw-bold fs-6 me-1 ${rT}">${d.year}</span><span class="event-icons-inline">${d.events.map(k=>this.getIconHTML(k,th)).join('')}</span></div><span class="age-text ${rT}">${p1A} ${this.state.mode==='Couple'?'/ '+p2A:''}</span></div><div class="col-start">${stat}</div><div class="val-positive">${fmtK(d.grossInflow)}</div><div class="val-neutral text-danger">${fmtK(d.visualExpenses)}</div><div class="${d.surplus<0?'val-negative':'val-positive'}">${d.surplus>0?'+':''}${fmtK(d.surplus)}</div><div class="fw-bold ${rT}">${fmtK(d.debugNW)}</div><div class="text-center toggle-icon ${rT}"><i class="bi bi-chevron-down"></i></div></div><div class="grid-detail-wrapper"><div class="detail-container"><div class="detail-box surface-card"><div class="detail-title">Income Sources</div>${iL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Gross Inflow</span> <span class="text-success fw-bold">${fmtK(d.grossInflow)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">Outflows & Taxes</div>${eL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Out</span> <span class="text-danger fw-bold">${fmtK(d.visualExpenses)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">Assets (End of Year)</div>${aL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total NW</span> <span class="text-info fw-bold">${fmtK(d.debugNW)}</span></div></div></div></div></div>`;
        });
        const grid = document.getElementById('projectionGrid'); if(grid) grid.innerHTML = html;
    }

    getIconHTML(k, th) {
        const d = this.iconDefs[k]; if(!d) return ''; let c = d.color;
        if(th==='light'){ if(c.includes('text-white')||c.includes('text-warning')) c='text-dark'; if(c.includes('text-info')) c='text-primary'; }
        return `<i class="bi ${d.icon} ${c}" title="${d.title}"></i>`;
    }

    getInflatedTaxData(bInf) {
        let tDat = JSON.parse(JSON.stringify(this.CONSTANTS.TAX_DATA));
        Object.values(tDat).forEach(d => { 
            if(d.brackets) d.brackets = d.brackets.map(b=>b*bInf); 
            if(d.surtax){ if(d.surtax.t1) d.surtax.t1*=bInf; if(d.surtax.t2) d.surtax.t2*=bInf; } 
        });
        return tDat;
    }

    calculateProgressiveTax(i, b, r) {
        let t=0, m=r[0], p=0;
        for(let j=0; j<b.length; j++){ if(i>b[j]){ t+=(b[j]-p)*r[j]; p=b[j]; } else { return {tax:t+(i-p)*r[j], marg:r[j]}; } }
        return {tax:t+(i-p)*r[r.length-1], marg:r[r.length-1]};
    }

    calculateTaxDetailed(inc, prov, tDat=null) {
        if(inc<=0) return { fed:0, prov:0, cpp_ei:0, totalTax:0, margRate:0 };
        const D = tDat||this.CONSTANTS.TAX_DATA, fC = this.calculateProgressiveTax(inc, D.FED.brackets, D.FED.rates), pC = this.calculateProgressiveTax(inc, D[prov]?.brackets||[999999999], D[prov]?.rates||[0.10]);
        let fed=fC.tax, provT=pC.tax, mF=fC.marg, mP=pC.marg;
        if(prov==='ON'){ let s=0; if(D.ON.surtax){ if(provT>D.ON.surtax.t1) s+=(provT-D.ON.surtax.t1)*D.ON.surtax.r1; if(provT>D.ON.surtax.t2) s+=(provT-D.ON.surtax.t2)*D.ON.surtax.r2; } if(s>0) mP*=1.56; provT+=s+(inc>20000?Math.min(900,(inc-20000)*0.06):0); }
        if(prov==='PE'&&D.PE.surtax&&provT>D.PE.surtax.t1) provT+=(provT-D.PE.surtax.t1)*D.PE.surtax.r1;
        if(prov==='QC'&&D.QC.abatement) fed-=fed*D.QC.abatement;
        let cpp=0; if(inc>3500) cpp+=(Math.min(inc,74600)-3500)*0.0595; if(inc>74600) cpp+=(Math.min(inc,85000)-74600)*0.04;
        const ei=Math.min(inc,68900)*0.0164;
        return { fed, prov:provT, cpp_ei:cpp+ei, totalTax:fed+provT+cpp+ei, margRate:mF+mP };
    }

    updateAgeDisplay(pfx) {
        const dI = this.getRaw(`${pfx}_dob`), el = document.getElementById(`${pfx}_age`);
        if(!dI){ el.innerHTML="--"; return; }
        
        const age = Math.abs(new Date(Date.now() - new Date(dI+"-01").getTime()).getUTCFullYear() - 1970);
        el.innerHTML = age + " years old";

        // NEW LOGIC: Update the slider min to be the current age
        const slider = document.getElementById(`qa_${pfx}_retireAge_range`);
        if (slider) {
            // Set min to current age
            slider.min = age;
            
            // If current value is now impossible (below age), bump it up
            if (parseInt(slider.value) < age) {
                slider.value = age;
                // Also update the state and the text label
                this.state.inputs[`${pfx}_retireAge`] = age;
                const label = document.getElementById(`qa_${pfx}_retireAge_val`);
                if(label) label.innerText = age;
                this.debouncedRun();
            }
        }
    }

    toggleSidebar() {
        const ex = document.getElementById('sidebarExpanded'), co = document.getElementById('sidebarCollapsed'), col = document.getElementById('sidebarCol');
        if(ex.style.display==='none'){ ex.style.display='block'; co.style.display='none'; col.style.width='320px'; } else { ex.style.display='none'; co.style.display='block'; col.style.width='50px'; }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }

    renderExpenseRows() {
        const tb = document.getElementById('expenseTableBody'), th = document.getElementById('expenseTableHeader'), t = document.documentElement.getAttribute('data-bs-theme')||'dark', rB=t==='light'?'bg-white':'bg-body-tertiary', rT=t==='light'?'text-dark':'text-white', rBd=t==='light'?'border-dark-subtle':'border-secondary', ab=t==='light'?'text-secondary':'text-white', ic=t==='light'?'bg-white text-dark':'bg-transparent text-white', hc=t==='light'?'bg-white text-dark border-bottom border-dark-subtle':'bg-transparent text-muted border-secondary';
        const gLim=parseInt(this.getRaw('exp_gogo_age'))||75, sLim=parseInt(this.getRaw('exp_slow_age'))||85;
        th.innerHTML = this.state.expenseMode==='Simple' ? `<th class="text-uppercase small ps-3 ${hc}" style="width: 40%;">Category / Item</th><th class="text-uppercase small ${hc}" style="width: 30%;">Current</th><th class="text-uppercase small ${hc}" style="width: 30%;">Retirement</th>` : `<th class="text-uppercase small ps-3 ${hc}" style="width: 20%;">Item</th><th class="text-uppercase small ${hc}" style="width: 16%;">Current</th><th class="text-uppercase small ${hc}" style="width: 16%;">Trans</th><th class="text-uppercase small ${hc}" style="width: 16%;">Go-Go <span style="font-size:0.6rem">(&lt;${gLim})</span></th><th class="text-uppercase small ${hc}" style="width: 16%;">Slow-Go <span style="font-size:0.6rem">(&lt;${sLim})</span></th><th class="text-uppercase small ${hc}" style="width: 16%;">No-Go <span style="font-size:0.6rem">(${sLim}+)</span></th>`;
        let h='', m={"Housing":{i:"bi-house-door-fill",c:"text-primary"},"Living":{i:"bi-basket2-fill",c:"text-success"},"Kids":{i:"bi-balloon-heart-fill",c:"text-warning"},"Lifestyle":{i:"bi-airplane-engines-fill",c:"text-info"}};
        const rI = (i,f,x,c,cls) => `<div class="input-group input-group-sm mb-1" style="flex-wrap:nowrap;"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${cls}" style="min-width:60px;" value="${(i[f]||0).toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="${f}"></div>`;
        Object.entries(this.expensesByCategory).forEach(([c, d]) => {
            const mt=m[c]||{i:"bi-tag-fill",c:"text-white"}, cs=this.state.expenseMode==='Simple'?3:6;
            h+=`<tr class="expense-category-row"><td colspan="${cs}" class="py-3 ps-3 border-bottom ${rBd} ${rB} ${rT}"><div class="d-flex align-items-center justify-content-between"><div class="d-flex align-items-center"><i class="bi ${mt.i} ${mt.c} me-2 fs-6"></i><span class="text-uppercase fw-bold ${mt.c} small" style="letter-spacing:1px;">${c}</span></div><button type="button" class="btn btn-sm btn-link ${ab} p-0 me-3" onclick="app.addExpense('${c}')"><i class="bi bi-plus-circle-fill text-success fs-5"></i></button></div></td></tr>`;
            d.items.forEach((i, x) => {
                h+=`<tr class="expense-row"><td class="ps-3 align-middle border-bottom border-secondary ${rB} ${rT}"><input type="text" class="form-control form-control-sm border-0 expense-update ${ic}" value="${i.name}" data-cat="${c}" data-idx="${x}" data-field="name"></td>`;
                if(this.state.expenseMode==='Simple'){
                    h+=`<td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="width:100px;flex-grow:1;" value="${i.curr.toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="curr"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div></td><td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="d-flex align-items-center"><div class="input-group input-group-sm flex-grow-1"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="width:100px;flex-grow:1;" value="${i.ret.toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="ret"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div><button type="button" class="btn btn-sm btn-link text-danger p-0 ms-3 me-2" onclick="app.removeExpense('${c}', ${x})"><i class="bi bi-trash"></i></button></div></td>`;
                } else {
                    h+=`<td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="input-group input-group-sm mb-1" style="flex-wrap:nowrap;"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num expense-update ${ic}" style="min-width:60px;" value="${(i.curr||0).toLocaleString()}" data-cat="${c}" data-idx="${x}" data-field="curr"><select class="form-select border-secondary expense-update ${ic}" style="width:auto;flex-grow:0;min-width:85px;" data-cat="${c}" data-idx="${x}" data-field="freq"><option value="12" ${i.freq===12?'selected':''}>/mo</option><option value="1" ${i.freq===1?'selected':''}>/yr</option></select></div></td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'trans',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'gogo',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}">${rI(i,'slow',x,c,ic)}</td><td class="align-middle border-bottom border-secondary ${rB} ${rT}"><div class="d-flex align-items-center justify-content-between">${rI(i,'nogo',x,c,ic)}<button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="app.removeExpense('${c}', ${x})"><i class="bi bi-trash"></i></button></div></td>`;
                } h+=`</tr>`;
            });
        }); tb.innerHTML = h;
        document.querySelectorAll('.expense-update.formatted-num').forEach(el => el.addEventListener('input', e => this.formatInput(e.target)));
    }

    addExpense(c) { this.expensesByCategory[c].items.push({ name: "New Expense", curr: 0, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }); this.renderExpenseRows(); this.calcExpenses(); this.run(); }
    removeExpense(c, i) { this.showConfirm('Delete expense?', () => { this.expensesByCategory[c].items.splice(i, 1); this.renderExpenseRows(); this.calcExpenses(); this.run(); }); }

    addDebtRow() {
        const c = document.getElementById('debt-container'), div = document.createElement('div'); div.className = 'row g-3 mb-2 align-items-center debt-row';
        div.innerHTML = `<div class="col-12 col-md-5"><input type="text" class="form-control form-control-sm" placeholder="Debt Name"></div><div class="col-8 col-md-4"><div class="input-group input-group-sm"><span class="input-group-text">$</span><input type="text" class="form-control formatted-num live-calc debt-amount" value="0"></div></div><div class="col-4 col-md-3"><button type="button" class="btn btn-outline-danger btn-sm w-100"><i class="bi bi-trash"></i></button></div>`;
        c.appendChild(div); div.querySelector('.debt-amount').addEventListener('input', e => { this.formatInput(e.target); this.debouncedRun(); });
        div.querySelector('.btn-outline-danger').addEventListener('click', () => { div.remove(); this.debouncedRun(); });
    }

    renderStrategy() {
        this.renderList('strat-accum-list', this.state.strategies.accum, 'accum', document.getElementById('strat-accum-container'));
        const d = document.getElementById('strat-decumulation'); d.innerHTML = `<div class="card border-secondary mb-3 strategy-opt-box surface-card"><div class="card-header border-secondary text-uppercase small fw-bold text-muted"><i class="bi bi-stars text-warning me-2"></i>Optimization Strategies</div><div class="card-body p-3"><div class="form-check form-switch"><input class="form-check-input live-calc" type="checkbox" role="switch" id="strat_rrsp_topup" ${this.state.inputs['strat_rrsp_topup']?'checked':''}><label class="form-check-label small fw-bold" for="strat_rrsp_topup">RRSP Low-Income Top-Up<div class="text-muted fw-normal mt-1" style="font-size:0.75rem; line-height:1.2;">Withdraws RRSP to fill the lowest tax bracket (~$55k) in years with low income.</div></label></div></div></div><h6 class="small fw-bold mb-3 text-uppercase text-muted">Withdrawal Order (Drag to Reorder)</h6>`;
        this.renderList('strat-decum-list', this.state.strategies.decum, 'decum', d);
    }

    renderList(id, arr, type, cont) {
        let ul = document.getElementById(id); if(!ul) { ul = document.createElement('ul'); ul.id=id; ul.className='strategy-list p-0 m-0'; ul.style.listStyle='none'; cont.appendChild(ul); } else ul.innerHTML='';
        arr.forEach((k, i) => {
            const li = document.createElement('li'); li.className='strat-item shadow-sm'; li.draggable=true; li.setAttribute('data-key', k);
            li.innerHTML = `<span class="fw-bold small"><span class="badge bg-secondary me-2 rounded-circle">${i+1}</span> ${this.strategyLabels[k] || k.toUpperCase()}</span> <i class="bi bi-grip-vertical grip-icon fs-5"></i>`;
            li.addEventListener('dragstart', () => { li.classList.add('dragging'); li.style.opacity='0.5'; });
            li.addEventListener('dragend', () => { li.classList.remove('dragging'); li.style.opacity='1'; this.updateArrayOrder(id, type); this.run(); }); ul.appendChild(li);
        });
        ul.addEventListener('dragover', e => {
            e.preventDefault(); const aE = [...ul.querySelectorAll('.strat-item:not(.dragging)')].reduce((c, ch) => { const b=ch.getBoundingClientRect(), o=e.clientY-b.top-b.height/2; return o<0&&o>c.offset ? {offset:o, e:ch} : c; }, {offset:Number.NEGATIVE_INFINITY}).e, drg=document.querySelector('.dragging');
            aE==null ? ul.appendChild(drg) : ul.insertBefore(drg, aE);
        });
    }

    updateArrayOrder(id, type) {
        const o = []; document.getElementById(id).querySelectorAll('.strat-item').forEach(i => o.push(i.getAttribute('data-key')));
        type==='accum' ? this.state.strategies.accum=o : this.state.strategies.decum=o; this.renderStrategy();
    }

    getDiscountFactor(y) { return !document.getElementById('useRealDollars').checked ? 1 : Math.pow(1 + this.getVal('inflation_rate')/100, y); }
    formatInput(el) { const v = el.value.replace(/,/g, ''); if(!isNaN(v) && v!=='') el.value = Number(v).toLocaleString('en-US'); }
    toggleGroup(t) { const b = document.querySelector(`span[data-type="${t}"]`); document.body.classList.toggle(`show-${t}`); b.innerText = document.body.classList.contains(`show-${t}`) ? '[-]' : '[+]'; }
    
    findOptimal() {
        const findFor = (pfx) => {
            const cppOn=this.state.inputs[`${pfx}_cpp_enabled`], oasOn=this.state.inputs[`${pfx}_oas_enabled`];
            if(cppOn||oasOn) {
                const oC=document.getElementById(`${pfx}_cpp_start`).value, oO=document.getElementById(`${pfx}_oas_start`).value;
                let mx=-Infinity, bC=65, bO=65;
                for(let c=60; c<=70; c++){ 
                    for(let o=65; o<=70; o++){ 
                        if(cppOn) this.state.inputs[`${pfx}_cpp_start`]=c; 
                        if(oasOn) this.state.inputs[`${pfx}_oas_start`]=o; 
                        const nw=this.generateProjectionTable(true); 
                        if(nw>mx){ mx=nw; bC=c; bO=o; } 
                    } 
                }
                if(cppOn) this.optimalAges[`${pfx}_cpp`]=bC; 
                if(oasOn) this.optimalAges[`${pfx}_oas`]=bO;
                this.state.inputs[`${pfx}_cpp_start`]=oC; 
                this.state.inputs[`${pfx}_oas_start`]=oO;
            }
            document.getElementById(`${pfx}_cpp_opt`).innerHTML = cppOn ? `Optimal: Age ${this.optimalAges[`${pfx}_cpp`]} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="${pfx}_cpp">Apply</a>)` : `Optimization Disabled`;
            document.getElementById(`${pfx}_oas_opt`).innerHTML = oasOn ? `Optimal: Age ${this.optimalAges[`${pfx}_oas`]} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="${pfx}_oas">Apply</a>)` : `Optimization Disabled`;
        };
        findFor('p1'); if(this.state.mode==='Couple') findFor('p2');
    }

    applyOpt(t) { 
        if(document.getElementById(`${t}_start`)) document.getElementById(`${t}_start`).value = this.optimalAges[t]; 
        if(document.getElementById(`${t}_start_val`)) document.getElementById(`${t}_start_val`).innerText = this.optimalAges[t]; 
        this.state.inputs[`${t}_start`] = this.optimalAges[t]; 
        this.run(); 
    }

    estimateCPPOAS() {
        ['p1','p2'].forEach(p => {
            const rA=this.getVal(`${p}_retireAge`);
            const cS=parseInt(this.getRaw(`${p}_cpp_start`));
            const oS=parseInt(this.getRaw(`${p}_oas_start`));
            const cE=this.state.inputs[`${p}_cpp_enabled`];
            const oE=this.state.inputs[`${p}_oas_enabled`];
            
            let cppBase = this.getVal(`${p}_cpp_est_base`);
            let md = (cS - 65) * 12; 
            let cV = cppBase;
            cV *= md < 0 ? (1 - (Math.abs(md) * 0.006)) : (1 + (md * 0.007)); 
            if(rA < 60) cV *= Math.max(0, (39 - Math.max(0, (65 - rA) - 8)) / 39); 
            
            const eC = document.getElementById(`${p}_cpp_est`); 
            if(eC){ 
                eC.innerText = cE ? `$${Math.round(cV).toLocaleString()}/yr` : "Disabled"; 
                cE ? eC.classList.remove('text-danger') : eC.classList.add('text-danger'); 
            }
            
            let oasYears = Math.max(0, Math.min(40, this.getVal(`${p}_oas_years`)));
            let oV = this.CONSTANTS.MAX_OAS_2026 * (oasYears / 40);
            let od = (oS - 65) * 12; 
            if(od > 0) oV *= (1 + (od * 0.006)); 
            
            const eO = document.getElementById(`${p}_oas_est`); 
            if(eO){ 
                eO.innerText = oE ? `$${Math.round(oV).toLocaleString()}/yr` : "Disabled"; 
                oE ? eO.classList.remove('text-danger') : eO.classList.add('text-danger'); 
            }
        });
    }

    updateIncomeDisplay() {
        const prov=this.getRaw('tax_province'), cY=new Date().getFullYear();
        let add = { p1T:0, p1N:0, p2T:0, p2N:0 };
        this.state.additionalIncome.forEach(s => {
            let sY, eY;
            if(s.startMode === 'ret_relative'){
                const dob = new Date(this.getRaw(`${s.owner}_dob`) + "-01").getFullYear();
                const retAge = this.getVal(`${s.owner}_retireAge`);
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
                // Growth from start year
                let baseYear = s.startMode === 'ret_relative' ? sY : new Date(s.start+"-01").getFullYear();
                let a = s.amount * Math.pow(1+(s.growth/100), cY-baseYear) * (s.freq==='month'?12:1);
                
                // Partial year logic
                if (s.startMode === 'date' && cY===sY) a *= (12-new Date(s.start+"-01").getMonth())/12;
                if (s.endMode === 'date' && s.end && cY===eY) a *= Math.min(1, (new Date(s.end+"-01").getMonth()+1)/12);

                if(a>0){ if(s.owner==='p1'){ s.taxable?add.p1T+=a:add.p1N+=a; } else { s.taxable?add.p2T+=a:add.p2N+=a; } }
            }
        });
        const p1G=this.getVal('p1_income')+add.p1T, p2G=this.getVal('p2_income')+add.p2T, hhG=p1G+add.p1N+(this.state.mode==='Couple'?p2G+add.p2N:0);
        if(document.getElementById('household_gross_display')) document.getElementById('household_gross_display').innerHTML = `$${hhG.toLocaleString()} <span class="monthly-sub">($${Math.round(hhG/12).toLocaleString()}/mo)</span>`;
        const p1D=this.calculateTaxDetailed(p1G, prov), p2D=this.calculateTaxDetailed(p2G, prov);
        this.renderTaxDetails('p1', p1G, p1D); this.renderTaxDetails('p2', p2G, p2D);
        const hhN = (p1G-p1D.totalTax)+add.p1N+(this.state.mode==='Couple'?(p2G-p2D.totalTax)+add.p2N:0);
        if(document.getElementById('household_net_display')) document.getElementById('household_net_display').innerHTML = `$${Math.round(hhN).toLocaleString()} <span class="monthly-sub">($${Math.round(hhN/12).toLocaleString()}/mo)</span>`;
        return hhN;
    }

    renderTaxDetails(pfx, g, d) {
        const c=document.getElementById(`${pfx}_tax_details`); if(!c) return;
        c.innerHTML = g>0 ? `<div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Federal</span> <span>($${Math.round(d.fed).toLocaleString()}) ${((d.fed/g)*100).toFixed(1)}%</span></div><div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">Provincial</span> <span>($${Math.round(d.prov).toLocaleString()}) ${((d.prov/g)*100).toFixed(1)}%</span></div><div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-1"><span class="text-muted">CPP/EI</span> <span>($${Math.round(d.cpp_ei).toLocaleString()})</span></div><div class="d-flex justify-content-between mt-2"><span class="text-warning fw-bold">Total Tax</span> <span class="text-warning fw-bold">($${Math.round(d.totalTax).toLocaleString()})</span></div><div class="d-flex justify-content-between"><span class="text-muted">Marginal Rate</span> <span>${(d.margRate*100).toFixed(2)}%</span></div><div class="d-flex justify-content-between mt-2 pt-2 border-top border-secondary"><span class="text-success fw-bold">After-Tax</span> <span class="text-success fw-bold">$${Math.round(g-d.totalTax).toLocaleString()}</span></div>` : `<span class="text-muted text-center d-block small">No Income Entered</span>`;
    }

    getTotalDebt() { let t=0; document.querySelectorAll('.debt-amount').forEach(el=>t+=Number(el.value.replace(/,/g,''))||0); return t; }

    calcExpenses() {
        const uR = document.getElementById('useRealDollars')?.checked, inf = this.getVal('inflation_rate')/100, cA = Math.abs(new Date(Date.now() - new Date(this.getRaw('p1_dob')+"-01").getTime()).getUTCFullYear() - 1970), p1R = this.getVal('p1_retireAge'), p2R = this.state.mode==='Couple'?this.getVal('p2_retireAge'):999, gLim=parseInt(this.getRaw('exp_gogo_age'))||75, sLim=parseInt(this.getRaw('exp_slow_age'))||85;
        const gF = y => uR?1:Math.pow(1+inf, y), fT=gF(Math.max(0, Math.min(p1R,p2R)-cA)), fG=gF(Math.max(0, Math.max(p1R,this.state.mode==='Couple'?p2R:0)-cA)), fS=gF(Math.max(0, gLim-cA)), fN=gF(Math.max(0, sLim-cA));
        let t={curr:0,ret:0,trans:0,gogo:0,slow:0,nogo:0}; Object.values(this.expensesByCategory).forEach(c=>c.items.forEach(i=>{ const f=i.freq; t.curr+=(i.curr||0)*f; t.ret+=(i.ret||0)*f; t.trans+=(i.trans||0)*f; t.gogo+=(i.gogo||0)*f; t.slow+=(i.slow||0)*f; t.nogo+=(i.nogo||0)*f; }));
        const fmt = n => '$'+Math.round(n).toLocaleString(), cS="border:none;border-left:1px solid var(--border-color);padding-left:12px;", lS="border:none;text-align:right;padding-right:12px;color:var(--text-muted);font-weight:bold;font-size:0.75rem;text-transform:uppercase;";
        document.getElementById('expenseFooter').innerHTML = this.state.expenseMode==='Simple' ? `<table class="table table-sm table-borderless mb-0 bg-transparent" style="table-layout:fixed;"><tr><td width="40%" style="${lS}">Total Annual</td><td width="30%" style="${cS}"><span class="text-danger fw-bold fs-6">${fmt(t.curr)}</span></td><td width="30%" style="${cS}"><span class="text-warning fw-bold fs-6">${fmt(t.ret*(uR?1:fG))}</span></td></tr></table>` : `<table class="table table-sm table-borderless mb-0 bg-transparent" style="table-layout:fixed;"><tr><td width="20%" style="${lS}">Total</td><td width="16%" style="${cS}"><div class="text-danger fw-bold">${fmt(t.curr)}</div><div class="small text-muted" style="font-size:0.7rem">Now</div></td><td width="16%" style="${cS}"><div class="text-warning fw-bold">${fmt(t.trans*fT)}</div><div class="small text-muted" style="font-size:0.7rem">Trans</div></td><td width="16%" style="${cS}"><div class="text-info fw-bold">${fmt(t.gogo*fG)}</div><div class="small text-muted" style="font-size:0.7rem">Go-Go (&lt;${gLim})</div></td><td width="16%" style="${cS}"><div class="text-primary fw-bold">${fmt(t.slow*fS)}</div><div class="small text-muted" style="font-size:0.7rem">Slow (&lt;${sLim})</div></td><td width="16%" style="${cS}"><div class="text-secondary fw-bold">${fmt(t.nogo*fN)}</div><div class="small text-muted" style="font-size:0.7rem">No-Go (${sLim}+)</div></td></tr></table>`;
    }

    initSidebar() {
        const b = (sId, iId, lId, sfx='') => { const s=document.getElementById(sId); if(s) { s.value=this.getRaw(iId)||s.value; if(document.getElementById(lId)) document.getElementById(lId).innerText=s.value+sfx; s.addEventListener('input', e => { const i=document.getElementById(iId); if(i){ i.value=e.target.value; this.state.inputs[iId]=e.target.value; if(lId) document.getElementById(lId).innerText=e.target.value+sfx; this.debouncedRun(); } }); } };
        b('qa_p1_retireAge_range', 'p1_retireAge', 'qa_p1_retireAge_val'); b('qa_p2_retireAge_range', 'p2_retireAge', 'qa_p2_retireAge_val'); b('qa_inflation_range', 'inflation_rate', 'qa_inflation_val', '%'); b('qa_return_range', 'p1_tfsa_ret', 'qa_return_val', '%');
    }

    populateAgeSelects() {
        document.querySelectorAll('.cpp-age-select').forEach(s => { let h=''; for(let i=60;i<=70;i++) h+=`<option value="${i}" ${i===65?'selected':''}>${i}</option>`; s.innerHTML=h; });
        document.querySelectorAll('.oas-age-select').forEach(s => { let h=''; for(let i=65;i<=70;i++) h+=`<option value="${i}" ${i===65?'selected':''}>${i}</option>`; s.innerHTML=h; });
    }

    saveScenarioFromModal() {
        const nm = document.getElementById('modalScenarioName').value;
        if(!nm) { alert("Please enter a plan name."); return; }
        this.saveScenarioData(nm);
        if(this.saveModalInstance) { this.saveModalInstance.hide(); }
        document.getElementById('modalScenarioName').value = '';
    }

    saveScenarioData(name) {
        let sc=JSON.parse(localStorage.getItem('rp_scenarios')||'[]'); 
        sc.push({name: name, data: this.getCurrentSnapshot()}); 
        localStorage.setItem('rp_scenarios', JSON.stringify(sc)); 
        this.loadScenariosList(); 
        this.updateScenarioBadge(name);
        alert(`"${name}" has been saved.`);
    }

    loadScenariosList() {
        const lst = document.getElementById('scenarioList');
        const cmp = document.getElementById('compareSelectionArea');
        const headerLst = document.getElementById('headerScenarioList');
        const sc = JSON.parse(localStorage.getItem('rp_scenarios')||'[]');
        
        if(lst) lst.innerHTML = ''; 
        if(headerLst) headerLst.innerHTML = '';

        let cH = `<div class="d-flex align-items-center mb-2 p-2 rounded surface-card border border-secondary"><div class="form-check form-switch mb-0"><input class="form-check-input mt-1" type="checkbox" role="switch" value="current" id="comp_current" checked><label class="form-check-label fw-medium ms-2" for="comp_current">Current Unsaved Plan</label></div></div>`;
        
        if (sc.length === 0) {
            if(headerLst) headerLst.innerHTML = `<li><span class="dropdown-item-text text-muted small">No saved plans</span></li>`;
            if(lst) lst.innerHTML = `<li class="list-group-item bg-transparent text-muted small border-0">No saved scenarios yet.</li>`;
        } else {
            sc.forEach((s, idx) => {
                if(lst) {
                    lst.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center surface-card border-secondary mb-2 rounded-3">${s.name}<div><button class="btn btn-sm btn-outline-success me-2" onclick="app.loadScenario(${idx})" title="Load"><i class="bi bi-arrow-clockwise"></i></button><button class="btn btn-sm btn-outline-info me-2" onclick="app.exportScenario(${idx})" title="Export"><i class="bi bi-download"></i></button><button class="btn btn-sm btn-outline-danger" onclick="app.deleteScenario(${idx})"><i class="bi bi-trash"></i></button></div></li>`;
                }
                if(headerLst) {
                    headerLst.innerHTML += `<li><a class="dropdown-item" href="javascript:void(0)" onclick="app.loadScenario(${idx})"><i class="bi bi-file-earmark-check me-2 text-success"></i>${s.name}</a></li>`;
                }
                cH += `<div class="d-flex align-items-center mb-2 p-2 rounded surface-card border border-secondary"><div class="form-check form-switch mb-0"><input class="form-check-input mt-1" type="checkbox" role="switch" value="${idx}" id="comp_${idx}"><label class="form-check-label fw-medium ms-2" for="comp_${idx}">${s.name}</label></div></div>`;
            });
        }
        if(cmp) cmp.innerHTML = cH;
        this.renderComparisonChart();
    }

    loadScenario(idx) { 
        const s = JSON.parse(localStorage.getItem('rp_scenarios')||'[]')[idx]; 
        if(!s) return; 
        this.loadStateToDOM(s.data); 
        this.run(); 
        this.updateScenarioBadge(s.name);
        alert(`Loaded plan: "${s.name}"`); 
    }

    exportScenario(idx) { 
        const s = JSON.parse(localStorage.getItem('rp_scenarios')||'[]')[idx]; 
        if(!s) return; 
        const a = document.createElement('a'); 
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(s.data, null, 2)); 
        a.download = s.name.replace(/\s+/g, '_').toLowerCase() + ".json"; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
    }

    deleteScenario(idx) { 
        this.showConfirm("Delete this scenario?", () => { 
            let sc=JSON.parse(localStorage.getItem('rp_scenarios')||'[]'); 
            sc.splice(idx, 1); 
            localStorage.setItem('rp_scenarios', JSON.stringify(sc)); 
            this.loadScenariosList(); 
        }); 
    }

    renderComparisonChart() {
        if (!document.getElementById('chartNW') || typeof Chart === 'undefined') return;

        const checkboxes = document.querySelectorAll('#compareSelectionArea input[type="checkbox"]:checked');
        const scenarios = JSON.parse(localStorage.getItem('rp_scenarios') || '[]');

        const datasets = [];
        let labels = [];
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

        checkboxes.forEach((cb, i) => {
            const color = colors[i % colors.length];
            if (cb.value === 'current') {
                if (this.state.projectionData.length > 0) {
                    if (labels.length === 0) labels = this.state.projectionData.map(d => d.year);
                    datasets.push({
                        label: 'Current Plan',
                        data: this.state.projectionData.map(d => Math.round(d.debugNW)),
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
                    if (labels.length === 0) labels = s.data.years || s.data.nwTrajectory.map((_, idx) => new Date().getFullYear() + idx);
                    datasets.push({
                        label: s.name,
                        data: s.data.nwTrajectory,
                        borderColor: color,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.3
                    });
                }
            }
        });

        if (this.charts.nw) this.charts.nw.destroy();

        const ctx = document.getElementById('chartNW').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        this.charts.nw = new Chart(ctx, {
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

    loadStateToDOM(d) {
        if(!d) return;
        if(d.version !== this.APP_VERSION) console.warn(`Updating save data from v${d.version||'old'} to v${this.APP_VERSION}`);
        this.state.inputs = {...(d.inputs||{})}; this.state.strategies = {...(d.strategies||{ accum: ['tfsa', 'rrsp', 'nreg', 'cash', 'crypto'], decum: ['rrsp', 'crypto', 'nreg', 'tfsa', 'cash'] })};
        Object.entries(this.state.inputs).forEach(([id, val]) => { if(id.startsWith('comp_')) return; const el=document.getElementById(id); if(el) el.type==='checkbox'||el.type==='radio'?el.checked=val:el.value=val; });
        ['p1_retireAge','p2_retireAge','inflation_rate'].forEach(k => { if(this.state.inputs[k]) this.updateSidebarSync(k, this.state.inputs[k]); });
        if(this.state.inputs['p1_tfsa_ret']) this.updateSidebarSync('p1_tfsa_ret', this.state.inputs['p1_tfsa_ret']);
        
        const assetAdvM = document.getElementById('asset_mode_advanced')?.checked;
        if(document.getElementById('asset_mode_advanced')) {
            document.querySelectorAll('.asset-bal-col').forEach(el => el.className = assetAdvM ? 'col-3 asset-bal-col' : 'col-5 asset-bal-col');
            document.querySelectorAll('.asset-ret-col').forEach(el => el.className = assetAdvM ? 'col-3 asset-ret-col' : 'col-4 asset-ret-col');
            document.querySelectorAll('.adv-asset-col').forEach(el => el.style.display = assetAdvM ? 'block' : 'none');
            document.querySelectorAll('.lbl-ret').forEach(el => el.innerText = assetAdvM ? 'Pre-Ret(%)' : 'Return (%)');
        }

        if(d.expensesData) { Object.keys(this.expensesByCategory).forEach(c => { if(!d.expensesData[c]) d.expensesData[c] = this.expensesByCategory[c]; }); this.expensesByCategory = d.expensesData; } this.renderExpenseRows();
        if(d.properties) { d.properties.forEach(p => { if(p.includeInNW === undefined) p.includeInNW = false; }); this.state.properties = d.properties; } this.renderProperties();
        this.state.windfalls = d.windfalls || []; this.renderWindfalls();
        this.state.additionalIncome = d.additionalIncome || []; this.renderAdditionalIncome();
        const dC = document.getElementById('debt-container'); dC.innerHTML = ''; if(d.debt) d.debt.forEach(a => { this.addDebtRow(); const ins = dC.querySelectorAll('.debt-amount'); ins[ins.length-1].value = a; });
        this.toggleModeDisplay(); this.renderStrategy();
        if(document.getElementById('exp_gogo_val')) document.getElementById('exp_gogo_val').innerText = this.getRaw('exp_gogo_age')||75;
        if(document.getElementById('exp_slow_val')) document.getElementById('exp_slow_val').innerText = this.getRaw('exp_slow_age')||85;
        const advM = document.getElementById('expense_mode_advanced')?.checked; if(document.getElementById('expense-phase-controls')) document.getElementById('expense-phase-controls').style.display = advM?'flex':'none';
        
        if(document.getElementById('p1_db_lifetime_start_val')) document.getElementById('p1_db_lifetime_start_val').innerText = this.getRaw('p1_db_lifetime_start')||'60';
        if(document.getElementById('p1_db_bridge_start_val')) document.getElementById('p1_db_bridge_start_val').innerText = this.getRaw('p1_db_bridge_start')||'60';
        if(document.getElementById('p2_db_lifetime_start_val')) document.getElementById('p2_db_lifetime_start_val').innerText = '60';
        if(document.getElementById('p2_db_bridge_start_val')) document.getElementById('p2_db_bridge_start_val').innerText = '60';
        
        if(document.getElementById('p1_oas_years_val')) document.getElementById('p1_oas_years_val').innerText = '40';
        if(document.getElementById('p2_oas_years_val')) document.getElementById('p2_oas_years_val').innerText = '40';
        if(document.getElementById('p1_cpp_start_val')) document.getElementById('p1_cpp_start_val').innerText = this.getRaw('p1_cpp_start')||'65';
        if(document.getElementById('p1_oas_start_val')) document.getElementById('p1_oas_start_val').innerText = this.getRaw('p1_oas_start')||'65';
        if(document.getElementById('p2_cpp_start_val')) document.getElementById('p2_cpp_start_val').innerText = this.getRaw('p2_cpp_start')||'65';
        if(document.getElementById('p2_oas_start_val')) document.getElementById('p2_oas_start_val').innerText = this.getRaw('p2_oas_start')||'65';
        
        if(document.getElementById('cfg_tfsa_limit')) document.getElementById('cfg_tfsa_limit').value = (this.getVal('cfg_tfsa_limit') || 7000).toLocaleString();
        if(document.getElementById('cfg_rrsp_limit')) document.getElementById('cfg_rrsp_limit').value = (this.getVal('cfg_rrsp_limit') || 32960).toLocaleString();

        this.updateBenefitVisibility();
    }
    
    getCurrentSnapshot() { 
        const s = { 
            version: this.APP_VERSION, inputs: {...this.state.inputs}, strategies: {...this.state.strategies}, 
            debt: [], properties: JSON.parse(JSON.stringify(this.state.properties)), 
            expensesData: JSON.parse(JSON.stringify(this.expensesByCategory)), 
            windfalls: JSON.parse(JSON.stringify(this.state.windfalls)), 
            additionalIncome: JSON.parse(JSON.stringify(this.state.additionalIncome)),
            nwTrajectory: this.state.projectionData.map(d => Math.round(d.debugNW)),
            years: this.state.projectionData.map(d => d.year)
        }; 
        document.querySelectorAll('.debt-amount').forEach(el=>s.debt.push(el.value)); 
        return s; 
    }
}

const app = new RetirementPlanner();
