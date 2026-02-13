/**
 * Retirement Planner Pro - Logic v10.24 (Final: Complete & Unabridged)
 * Includes CPP/OAS Math fixes, Optimal Age Button fix, and Compare Chart Integration.
 */
class RetirementPlanner {
    constructor() {
        this.APP_VERSION = "10.24";
        this.state = {
            inputs: {}, debt: [],
            properties: [{ name: "Primary Home", value: 1000000, mortgage: 430000, growth: 3.0, rate: 3.29, payment: 0, manual: false, includeInNW: false }],
            windfalls: [], additionalIncome: [],
            strategies: { accum: ['tfsa', 'rrsp', 'nreg', 'cash', 'crypto'], decum: ['rrsp', 'crypto', 'nreg', 'tfsa', 'cash'] },
            mode: 'Couple', projectionData: [], expenseMode: 'Simple'
        };
        this.AUTO_SAVE_KEY = 'rp_autosave_v1';
        this.THEME_KEY = 'rp_theme';
        this.CONSTANTS = {
            MAX_CPP_2026: 18092, MAX_OAS_2026: 8908, RRIF_START_AGE: 72, 
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
        this.expensesByCategory = {
            "Housing": { items: [ { name: "Property Tax", curr: 6000, ret: 6000, trans: 6000, gogo: 6000, slow: 6000, nogo: 6000, freq: 1 }, { name: "Enbridge (Gas)", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Enercare (HWT)", curr: 45, ret: 45, trans: 45, gogo: 45, slow: 45, nogo: 45, freq: 12 }, { name: "Alectra (Hydro)", curr: 150, ret: 150, trans: 150, gogo: 150, slow: 150, nogo: 150, freq: 12 }, { name: "RH Water", curr: 80, ret: 80, trans: 80, gogo: 80, slow: 80, nogo: 80, freq: 12 } ], colorClass: 'cat-header-housing' },
            "Living": { items: [ { name: "Grocery", curr: 800, ret: 800, trans: 800, gogo: 800, slow: 700, nogo: 600, freq: 12 }, { name: "Costco", curr: 400, ret: 400, trans: 400, gogo: 400, slow: 350, nogo: 300, freq: 12 }, { name: "Restaurants", curr: 400, ret: 300, trans: 350, gogo: 350, slow: 200, nogo: 100, freq: 12 }, { name: "Cellphone", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Internet", curr: 90, ret: 90, trans: 90, gogo: 90, slow: 90, nogo: 90, freq: 12 } ], colorClass: 'cat-header-living' },
            "Kids": { items: [ { name: "Daycare", curr: 1200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Activities", curr: 200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "RESP Contribution", curr: 208, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Clothing/Toys", curr: 100, ret: 50, trans: 50, gogo: 50, slow: 0, nogo: 0, freq: 12 } ], colorClass: 'cat-header-kids' },
            "Lifestyle": { items: [ { name: "Travel", curr: 5000, ret: 15000, trans: 10000, gogo: 15000, slow: 5000, nogo: 0, freq: 1 }, { name: "Electronic", curr: 500, ret: 500, trans: 500, gogo: 500, slow: 500, nogo: 200, freq: 1 }, { name: "Health Insurance", curr: 50, ret: 300, trans: 150, gogo: 300, slow: 500, nogo: 1000, freq: 12 }, { name: "Other", curr: 300, ret: 300, trans: 300, gogo: 300, slow: 200, nogo: 100, freq: 12 } ], colorClass: 'cat-header-lifestyle' }
        };
        this.optimalAges = { p1_cpp: 65, p1_oas: 65, p2_cpp: 65, p2_oas: 65 };
        this.strategyLabels = { 'tfsa': 'TFSA', 'rrsp': 'RRSP', 'nreg': 'Non-Reg', 'cash': 'Cash', 'crypto': 'Crypto' };
        this.iconDefs = {
            "P1 Retires": { icon: 'bi-cup-hot-fill', color: 'text-warning', title: "P1 Retires" }, "P2 Retires": { icon: 'bi-cup-hot', color: 'text-purple', title: "P2 Retires" },
            "Mortgage Paid": { icon: 'bi-house-check-fill', color: 'text-success', title: "Mortgage Paid" }, "Crash": { icon: 'bi-graph-down-arrow', color: 'text-danger', title: "Stress Test: Market Crash (-15%)" },
            "P1 CPP": { icon: 'bi-file-earmark-text-fill', color: 'text-info', title: "P1 Starts CPP" }, "P1 OAS": { icon: 'bi-cash-stack', color: 'text-info', title: "P1 Starts OAS" },
            "P2 CPP": { icon: 'bi-file-earmark-text', color: 'text-purple', title: "P2 Starts CPP" }, "P2 OAS": { icon: 'bi-cash', color: 'text-purple', title: "P2 Starts OAS" },
            "P1 Dies": { icon: 'bi-heartbreak-fill', color: 'text-white', title: "P1 Deceased" }, "P2 Dies": { icon: 'bi-heartbreak', color: 'text-white', title: "P2 Deceased" },
            "Windfall": { icon: 'bi-gift-fill', color: 'text-success', title: "Inheritance/Bonus Received" }
        };

        if(typeof google !== 'undefined' && google.charts) google.charts.load('current', {'packages':['sankey']});
        this.debouncedRun = this.debounce(() => this.run(), 300);
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
            this.updatePostRetIncomeVisibility(); 
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
            if (e.target.id === 'enable_post_ret_income_p1' || e.target.id === 'enable_post_ret_income_p2') this.updatePostRetIncomeVisibility();
            if (e.target.classList.contains('live-calc') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'radio')) {
                if(e.target.id && !e.target.id.startsWith('comp_')) this.state.inputs[e.target.id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
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
                }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun();
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
                let val = e.target.type === 'checkbox' ? e.target.checked : (['amount', 'growth'].includes(field) ? Number(e.target.value.replace(/,/g, '')) || 0 : e.target.value);
                if (this.state.additionalIncome[idx]) this.state.additionalIncome[idx][field] = val;
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
            // FIXED: Use dataset.target instead of target attribute for the apply button
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

    updatePostRetIncomeVisibility() {
        const $ = id => document.getElementById(id);
        if($('p1-post-ret-card')) $('p1-post-ret-card').style.display = ($('enable_post_ret_income_p1')?.checked) ? 'block' : 'none';
        if($('p2-post-ret-card')) $('p2-post-ret-card').style.display = ($('enable_post_ret_income_p2')?.checked) ? 'block' : 'none';
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
            p1_crypto_ret: '8.0', p1_crypto_ret_retire: '8.0', p2_crypto_ret: '8.0', p2_crypto_ret_retire: '8.0',
            p1_lirf_ret: '6.0', p1_lirf_ret_retire: '6.0', p2_lirf_ret: '6.0', p2_lirf_ret_retire: '6.0',
            p1_lif_ret: '5.0', p1_lif_ret_retire: '5.0', p2_lif_ret: '5.0', p2_lif_ret_retire: '5.0',
            p1_rrif_acct_ret: '5.0', p1_rrif_acct_ret_retire: '5.0', p2_rrif_acct_ret: '5.0', p2_rrif_acct_ret_retire: '5.0',
            
            p1_cpp_est_base: '10,000', p2_cpp_est_base: '10,000',
            p1_oas_years: '40', p2_oas_years: '40',
            
            p1_income_growth: '2.0', p2_income_growth: '2.0', p1_db_pension: '0', p2_db_pension: '0', p1_db_start_age: '60', p2_db_start_age: '60', p1_cpp_enabled: true, p1_oas_enabled: true, p2_cpp_enabled: true, p2_oas_enabled: true, exp_gogo_age: '75', exp_slow_age: '85', enable_post_ret_income_p1: false, enable_post_ret_income_p2: false, p1_post_inc: '0', p1_post_growth: '2.0', p2_post_inc: '0', p2_post_growth: '2.0' 
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
        document.getElementById('exp_gogo_val').innerText = '75'; document.getElementById('exp_slow_val').innerText = '85'; document.getElementById('p1_db_start_val').innerText = '60'; document.getElementById('p2_db_start_val').innerText = '60';
        
        if(document.getElementById('p1_oas_years_val')) document.getElementById('p1_oas_years_val').innerText = '40';
        if(document.getElementById('p2_oas_years_val')) document.getElementById('p2_oas_years_val').innerText = '40';
        
        this.updatePostRetIncomeVisibility(); this.updateAgeDisplay('p1'); this.updateAgeDisplay('p2'); 
        this.updateScenarioBadge(null);
        this.run();
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
            div.innerHTML = `<div class="d-flex justify-content-between mb-3"><input type="text" class="form-control form-control-sm bg-transparent border-0 fw-bold text-info fs-6 income-stream-update px-0" placeholder="Stream Name" value="${w.name}" data-idx="${idx}" data-field="name"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="app.removeAdditionalIncome(${idx})"><i class="bi bi-x-lg"></i></button></div><div class="row g-3 align-items-center mb-2"><div class="col-6"><label class="form-label small text-muted mb-1">Amount</label><div class="input-group input-group-sm"><span class="input-group-text border-secondary text-muted">$</span><input type="text" class="form-control border-secondary formatted-num income-stream-update" value="${w.amount.toLocaleString()}" data-idx="${idx}" data-field="amount"></div></div><div class="col-6"><label class="form-label small text-muted mb-1">Frequency</label><select class="form-select form-select-sm border-secondary income-stream-update" data-idx="${idx}" data-field="freq"><option value="month" ${w.freq==='month'?'selected':''}>/ Month</option><option value="year" ${w.freq==='year'?'selected':''}>/ Year</option></select></div></div><div class="row g-3 align-items-end"><div class="col-4"><label class="form-label small text-muted mb-1">Growth %</label><div class="input-group input-group-sm"><input type="number" step="0.1" class="form-control border-secondary income-stream-update" value="${w.growth}" data-idx="${idx}" data-field="growth"><span class="input-group-text border-secondary text-muted">%</span></div></div><div class="col-4"><label class="form-label small text-muted mb-1">Start Date</label><input type="month" class="form-control form-control-sm border-secondary income-stream-update" value="${w.start || new Date().toISOString().slice(0, 7)}" data-idx="${idx}" data-field="start"></div><div class="col-4"><label class="form-label small text-muted mb-1">End Date</label><input type="month" class="form-control form-control-sm border-secondary income-stream-update" value="${w.end}" data-idx="${idx}" data-field="end"></div></div><div class="row mt-3 pt-2 border-top border-secondary"><div class="col-12 d-flex justify-content-end"><div class="form-check"><input class="form-check-input income-stream-update" type="checkbox" id="inc_tax_${idx}" ${w.taxable?'checked':''} data-idx="${idx}" data-field="taxable"><label class="form-check-label text-muted small" for="inc_tax_${idx}">Is Taxable?</label></div></div></div>`;
            tgt.appendChild(div); div.querySelectorAll('.formatted-num').forEach(el => el.addEventListener('input', e => this.formatInput(e.target)));
        });
    }

    addAdditionalIncome(owner) { this.state.additionalIncome.push({ name: "Side Hustle", amount: 0, freq: 'month', owner, taxable: true, start: new Date().toISOString().slice(0, 7), end: '', growth: 2.0 }); this.renderAdditionalIncome(); this.updateIncomeDisplay(); this.run(); }
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
        const potName = `Available Cash\n${fmt(d.debugTotalInflow)}`;
        
        [['incomeP1','Employment P1'], ['incomeP2','Employment P2'], ['benefitsP1','Gov Benefits P1'], ['benefitsP2','Gov Benefits P2'], ['dbP1','DB Pension P1'], ['dbP2','DB Pension P2'], ['windfall','Inheritance/Bonus'], ['postRetP1','Post-Ret Work P1'], ['postRetP2','Post-Ret Work P2']].forEach(([k,n]) => { if(d[k]>0) rows.push([`${n}\n${fmt(d[k])}`, potName, Math.round(d[k])]); });
        if(d.flows?.withdrawals) Object.entries(d.flows.withdrawals).forEach(([s,a]) => { if(a>0) rows.push([`${s}\n${fmt(a)}`, potName, Math.round(a)]); });
        
        const tTax = d.taxP1 + d.taxP2, tDebt = d.mortgagePay + d.debtPay;
        if(tTax>0) rows.push([potName, `Taxes\n${fmt(tTax)}`, Math.round(tTax)]);
        if(d.expenses>0) rows.push([potName, `Living Exp.\n${fmt(d.expenses)}`, Math.round(d.expenses)]);
        if(tDebt>0) rows.push([potName, `Mortgage/Debt\n${fmt(tDebt)}`, Math.round(tDebt)]);
        if(d.flows?.contributions) Object.entries(d.flows.contributions).forEach(([t,a]) => { if(a>0) rows.push([potName, `To ${this.strategyLabels[t]||t}\n${fmt(a)}`, Math.round(a)]); });

        const unq = new Set(); rows.forEach(r => { unq.add(r[0]); unq.add(r[1]); });
        const nodesCfg = Array.from(unq).map(n => {
            let c='#a8a29e'; if(n.includes("Cash")) c='#f59e0b'; else if(n.includes("Emp")||n.includes("Post")) c='#10b981'; else if(n.includes("Gov")||n.includes("DB")) c='#06b6d4'; else if(n.includes("Inh")) c='#22c55e'; else if(n.includes("Taxes")) c='#ef4444'; else if(n.includes("Exp")) c='#f97316'; else if(n.includes("Mort")||n.includes("Debt")) c='#dc2626'; else if(["RRIF","TFSA","RRSP","Non-Reg","Crypto","Cash"].some(x=>n.includes(x))) c=n.startsWith("To ")?'#3b82f6':'#8b5cf6';
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

    /** FIXED: Accurate separation of CPP and OAS growth math */
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
        const mode = this.state.mode, prov = this.getRaw('tax_province'), infl = this.getVal('inflation_rate')/100, stress = this.state.inputs['stressTestEnabled'], rrspM = this.state.inputs['strat_rrsp_topup'], expM = this.state.expenseMode, assetAdv = this.state.inputs['asset_mode_advanced'], gLim = parseInt(this.getRaw('exp_gogo_age'))||75, sLim = parseInt(this.getRaw('exp_slow_age'))||85;
        
        let p1 = { tfsa: this.getVal('p1_tfsa'), rrsp: this.getVal('p1_rrsp'), cash: this.getVal('p1_cash'), nreg: this.getVal('p1_nonreg'), crypto: this.getVal('p1_crypto'), lirf: this.getVal('p1_lirf'), lif: this.getVal('p1_lif'), rrif_acct: this.getVal('p1_rrif_acct'), inc: this.getVal('p1_income'), dob: new Date(this.getRaw('p1_dob')), retAge: this.getVal('p1_retireAge'), lifeExp: this.getVal('p1_lifeExp') };
        let p2 = { tfsa: this.getVal('p2_tfsa'), rrsp: this.getVal('p2_rrsp'), cash: this.getVal('p2_cash'), nreg: this.getVal('p2_nonreg'), crypto: this.getVal('p2_crypto'), lirf: this.getVal('p2_lirf'), lif: this.getVal('p2_lif'), rrif_acct: this.getVal('p2_rrif_acct'), inc: this.getVal('p2_income'), dob: new Date(this.getRaw('p2_dob')), retAge: this.getVal('p2_retireAge'), lifeExp: this.getVal('p2_lifeExp') };
        
        const gR = id => this.getVal(id)/100;
        
        const bR1 = { tfsa:gR('p1_tfsa_ret'), rrsp:gR('p1_rrsp_ret'), cash:gR('p1_cash_ret'), nreg:gR('p1_nonreg_ret'), cryp:gR('p1_crypto_ret'), lirf:gR('p1_lirf_ret'), lif:gR('p1_lif_ret'), rrif_acct:gR('p1_rrif_acct_ret'), inc:gR('p1_income_growth') };
        const bR2 = { tfsa:gR('p2_tfsa_ret'), rrsp:gR('p2_rrsp_ret'), cash:gR('p2_cash_ret'), nreg:gR('p2_nonreg_ret'), cryp:gR('p2_crypto_ret'), lirf:gR('p2_lirf_ret'), lif:gR('p2_lif_ret'), rrif_acct:gR('p2_rrif_acct_ret'), inc:gR('p2_income_growth') };
        
        const bR1_ret = { tfsa:gR('p1_tfsa_ret_retire'), rrsp:gR('p1_rrsp_ret_retire'), cash:gR('p1_cash_ret_retire'), nreg:gR('p1_nonreg_ret_retire'), cryp:gR('p1_crypto_ret_retire'), lirf:gR('p1_lirf_ret_retire'), lif:gR('p1_lif_ret_retire'), rrif_acct:gR('p1_rrif_acct_ret_retire'), inc:gR('p1_income_growth') };
        const bR2_ret = { tfsa:gR('p2_tfsa_ret_retire'), rrsp:gR('p2_rrsp_ret_retire'), cash:gR('p2_cash_ret_retire'), nreg:gR('p2_nonreg_ret_retire'), cryp:gR('p2_crypto_ret_retire'), lirf:gR('p2_lirf_ret_retire'), lif:gR('p2_lif_ret_retire'), rrif_acct:gR('p2_rrif_acct_ret_retire'), inc:gR('p2_income_growth') };
        
        let p1DB = this.getVal('p1_db_pension')*12, p2DB = this.getVal('p2_db_pension')*12;
        let extVals = {
            p1PI: this.getVal('p1_post_inc'), p1PG: gR('p1_post_growth'), p1PS: new Date((this.getRaw('p1_post_start')||'2100-01')+"-01"), p1PE: new Date((this.getRaw('p1_post_end')||'2100-01')+"-01"),
            p2PI: this.getVal('p2_post_inc'), p2PG: gR('p2_post_growth'), p2PS: new Date((this.getRaw('p2_post_start')||'2100-01')+"-01"), p2PE: new Date((this.getRaw('p2_post_end')||'2100-01')+"-01")
        };
        
        let expTotals = { curr:0, ret:0, trans:0, gogo:0, slow:0, nogo:0 };
        Object.values(this.expensesByCategory).forEach(c => c.items.forEach(i => { const f=i.freq; expTotals.curr+=(i.curr||0)*f; expTotals.ret+=(i.ret||0)*f; if(expM==='Advanced'){ expTotals.trans+=(i.trans||0)*f; expTotals.gogo+=(i.gogo||0)*f; expTotals.slow+=(i.slow||0)*f; expTotals.nogo+=(i.nogo||0)*f; } }));
        
        let simP = JSON.parse(JSON.stringify(this.state.properties)), othD = this.getTotalDebt(), eC = expTotals.curr, eR = expTotals.ret, eT = expTotals.trans, eG = expTotals.gogo, eS = expTotals.slow, eN = expTotals.nogo;
        const curY = new Date().getFullYear(), p1SA = curY - p1.dob.getFullYear(), p2SA = curY - p2.dob.getFullYear(), eA = Math.max(p1.lifeExp, mode==='Couple'?p2.lifeExp:0), yrR = eA - Math.min(p1SA, mode==='Couple'?p2SA:p1SA);
        
        let trg = new Set();
        
        let cMax1 = this.getVal('p1_cpp_est_base');
        let oMax1 = this.CONSTANTS.MAX_OAS_2026 * (Math.max(0, Math.min(40, this.getVal('p1_oas_years'))) / 40);
        let cMax2 = this.getVal('p2_cpp_est_base');
        let oMax2 = this.CONSTANTS.MAX_OAS_2026 * (Math.max(0, Math.min(40, this.getVal('p2_oas_years'))) / 40);
        let fNW = 0;

        for (let i=0; i<=yrR; i++) {
            const yr = curY+i, a1 = p1SA+i, a2 = p2SA+i, al1 = a1<=p1.lifeExp, al2 = mode==='Couple'?a2<=p2.lifeExp:false;
            if(!al1 && !al2) break;
            
            const bInf = Math.pow(1+infl, i), tDat = JSON.parse(JSON.stringify(this.CONSTANTS.TAX_DATA));
            Object.values(tDat).forEach(d => { if(d.brackets) d.brackets = d.brackets.map(b=>b*bInf); if(d.surtax){ if(d.surtax.t1) d.surtax.t1*=bInf; if(d.surtax.t2) d.surtax.t2*=bInf; } });
            
            const p1R = a1>=p1.retAge, p2R = mode==='Couple'?a2>=p2.retAge:true, fRet = (al1?p1R:true) && (al2?p2R:true);
            let cR1 = {...(assetAdv && p1R ? bR1_ret : bR1)}, cR2 = {...(assetAdv && p2R ? bR2_ret : bR2)}, cYr = false;
            
            if(stress && a1>=p1.retAge && a1<p1.retAge+2) { 
                cYr=true; 
                ['tfsa','rrsp','nreg','cash','lirf','lif','rrif_acct'].forEach(k=>{ cR1[k]=-0.15; cR2[k]=-0.15; }); 
                cR1.cryp=-0.40; cR2.cryp=-0.40; 
            }
            
            let yCont = {tfsa:0,rrsp:0,nreg:0,cash:0,crypto:0}, yWd = {}, wDBrk = {p1:{},p2:{}}, evt = [];
            if(al1){ if(p1R && !trg.has('P1 Retires')){ evt.push('P1 Retires'); trg.add('P1 Retires'); } if(a1===parseInt(this.getRaw('p1_cpp_start')) && this.state.inputs['p1_cpp_enabled']) evt.push('P1 CPP'); if(a1===parseInt(this.getRaw('p1_oas_start')) && this.state.inputs['p1_oas_enabled']) evt.push('P1 OAS'); } else if(!trg.has('P1 Dies')){ evt.push('P1 Dies'); trg.add('P1 Dies'); }
            if(mode==='Couple'){ if(al2){ if(p2R && !trg.has('P2 Retires')){ evt.push('P2 Retires'); trg.add('P2 Retires'); } if(a2===parseInt(this.getRaw('p2_cpp_start')) && this.state.inputs['p2_cpp_enabled']) evt.push('P2 CPP'); if(a2===parseInt(this.getRaw('p2_oas_start')) && this.state.inputs['p2_oas_enabled']) evt.push('P2 OAS'); } else if(!trg.has('P2 Dies')){ evt.push('P2 Dies'); trg.add('P2 Dies'); } }
            if(simP.reduce((s,p)=>s+p.mortgage,0)<=0 && !trg.has('Mortgage Paid')){ evt.push('Mortgage Paid'); trg.add('Mortgage Paid'); } if(cYr) evt.push('Crash');

            let g1=0, g2=0, c1=0, o1=0, c2=0, o2=0, db1=0, db2=0, pst1=0, pst2=0;

            const calcPost = (on, base, start, end, grw) => {
                if(!on || base<=0) return 0; const sY=start.getFullYear(), eY=end.getFullYear();
                if(yr>=sY && yr<=eY) { let f=1; if(yr===sY) f=(12-start.getMonth())/12; if(yr===eY) f=Math.min(f, (end.getMonth()+1)/12); return base*Math.pow(1+grw, i)*f; } return 0;
            };

            // FIXED: Passing 'cpp' or 'oas' explicitly to correctly apply specific math rules.
            if(al1){ if(!p1R){ g1+=p1.inc; p1.inc*=(1+cR1.inc); } if(a1>=parseInt(this.getRaw('p1_db_start_age')||60)) db1=p1DB*bInf; pst1=calcPost(this.state.inputs['enable_post_ret_income_p1'], extVals.p1PI, extVals.p1PS, extVals.p1PE, extVals.p1PG); if(this.state.inputs['p1_cpp_enabled'] && a1>=parseInt(this.getRaw('p1_cpp_start'))) c1=this.calcBen(cMax1, parseInt(this.getRaw('p1_cpp_start')), 1, p1.retAge, 'cpp'); if(this.state.inputs['p1_oas_enabled'] && a1>=parseInt(this.getRaw('p1_oas_start'))) o1=this.calcBen(oMax1, parseInt(this.getRaw('p1_oas_start')), 1, 65, 'oas'); }
            if(mode==='Couple' && al2){ if(!p2R){ g2+=p2.inc; p2.inc*=(1+cR2.inc); } if(a2>=parseInt(this.getRaw('p2_db_start_age')||60)) db2=p2DB*bInf; pst2=calcPost(this.state.inputs['enable_post_ret_income_p2'], extVals.p2PI, extVals.p2PS, extVals.p2PE, extVals.p2PG); if(this.state.inputs['p2_cpp_enabled'] && a2>=parseInt(this.getRaw('p2_cpp_start'))) c2=this.calcBen(cMax2, parseInt(this.getRaw('p2_cpp_start')), 1, p2.retAge, 'cpp'); if(this.state.inputs['p2_oas_enabled'] && a2>=parseInt(this.getRaw('p2_oas_start'))) o2=this.calcBen(oMax2, parseInt(this.getRaw('p2_oas_start')), 1, 65, 'oas'); }
            cMax1*=(1+infl); oMax1*=(1+infl); cMax2*=(1+infl); oMax2*=(1+infl);

            // RRIF Logic
            let rrif1=0; if(al1 && p1.rrsp>0 && a1>=this.CONSTANTS.RRIF_START_AGE){ rrif1=p1.rrsp*this.getRrifFactor(a1); p1.rrsp-=rrif1; if(rrif1>0){ yWd['P1 RRIF']=(yWd['P1 RRIF']||0)+rrif1; wDBrk.p1.RRIF=rrif1; } }
            let rrif2=0; if(al2 && p2.rrsp>0 && a2>=this.CONSTANTS.RRIF_START_AGE){ rrif2=p2.rrsp*this.getRrifFactor(a2); p2.rrsp-=rrif2; if(rrif2>0){ yWd['P2 RRIF']=(yWd['P2 RRIF']||0)+rrif2; wDBrk.p2.RRIF=rrif2; } }

            let wfT1=0, wfT2=0, wfN1=0, wfN2=0;
            this.state.windfalls.forEach(w => {
                let act=false, amt=0, sY=new Date(w.start+"-01").getFullYear();
                if(w.freq==='one'){ if(sY===yr) { act=true; amt=w.amount; } }
                else { let eY=(w.end?new Date(w.end+"-01"):new Date("2100-01-01")).getFullYear(); if(yr>=sY && yr<=eY) { act=true; amt=w.amount*(w.freq==='month'?(yr===sY?12-new Date(w.start+"-01").getMonth():(yr===eY?new Date(w.end+"-01").getMonth()+1:12)):1); } }
                if(act && amt>0){ if(w.freq==='one') evt.push('Windfall'); if(w.taxable) { if(w.owner==='p2' && mode==='Couple') wfT2+=amt; else wfT1+=amt; } else { if(w.owner==='p2' && mode==='Couple') wfN2+=amt; else wfN1+=amt; } }
            });

            this.state.additionalIncome.forEach(s => {
                let sY=new Date(s.start+"-01").getFullYear(), eY=(s.end?new Date(s.end+"-01"):new Date("2100-01-01")).getFullYear();
                if(yr>=sY && yr<=eY) {
                    let amt = s.amount * Math.pow(1+(s.growth/100), yr-sY) * (s.freq==='month'?12:1) * (yr===sY?(12-new Date(s.start+"-01").getMonth())/12:(yr===eY?Math.min(1, (new Date(s.end+"-01").getMonth()+1)/12):1));
                    if(amt>0) { if(s.taxable){ if(s.owner==='p1') g1+=amt; else g2+=amt; } else { if(s.owner==='p1') wfN1+=amt; else wfN2+=amt; } }
                }
            });

            let tTx1=g1+c1+o1+rrif1+db1+wfT1+pst1, tTx2=g2+c2+o2+rrif2+db2+wfT2+pst2;
            if(rrspM) {
                const brk = tDat.FED.brackets[0];
                if(al1 && p1.rrsp>0 && tTx1<brk) { let d=Math.min(brk-tTx1, p1.rrsp); if(d>0){ p1.rrsp-=d; tTx1+=d; yWd['RRSP Top-Up']=(yWd['RRSP Top-Up']||0)+d; wDBrk.p1[a1>=72?'RRIF':'RRSP']=(wDBrk.p1[a1>=72?'RRIF':'RRSP']||0)+d; } }
                if(al2 && p2.rrsp>0 && tTx2<brk) { let d=Math.min(brk-tTx2, p2.rrsp); if(d>0){ p2.rrsp-=d; tTx2+=d; yWd['RRSP Top-Up']=(yWd['RRSP Top-Up']||0)+d; wDBrk.p2[a2>=72?'RRIF':'RRSP']=(wDBrk.p2[a2>=72?'RRIF':'RRSP']||0)+d; } }
            }

            let t1 = al1 ? this.calculateTaxDetailed(tTx1, prov, tDat) : {totalTax:0}, t2 = al2 ? this.calculateTaxDetailed(tTx2, prov, tDat) : {totalTax:0};
            let aExp = expM==='Simple' ? (fRet?eR:eC) : (!fRet?eC:(a1<gLim?eG:(a1<sLim?eS:eN)));
            let dRep = othD>0 ? Math.min(othD, 6000) : 0; othD-=dRep;
            let mOut = 0; simP.forEach(p => { if(p.mortgage>0 && p.payment>0) { let pA=p.payment*12, int=p.mortgage*(p.rate/100), prn=pA-int; if(prn>p.mortgage) { prn=p.mortgage; pA=prn+int; } p.mortgage=Math.max(0, p.mortgage-prn); mOut+=pA; } p.value*=(1+(p.growth/100)); });

            const nI1 = tTx1-t1.totalTax+wfN1, nI2 = al2 ? tTx2-t2.totalTax+wfN2 : 0;
            
            let gr1 = {
                tfsa:p1.tfsa*cR1.tfsa, rrsp:p1.rrsp*cR1.rrsp, nreg:p1.nreg*cR1.nreg, cash:p1.cash*cR1.cash, cryp:p1.crypto*cR1.cryp,
                lirf:p1.lirf*cR1.lirf, lif:p1.lif*cR1.lif, rrif_acct:p1.rrif_acct*cR1.rrif_acct
            }; 
            p1.tfsa+=gr1.tfsa; p1.rrsp+=gr1.rrsp; p1.nreg+=gr1.nreg; p1.cash+=gr1.cash; p1.crypto+=gr1.cryp; p1.lirf+=gr1.lirf; p1.lif+=gr1.lif; p1.rrif_acct+=gr1.rrif_acct;
            
            let gr2 = {tfsa:0,rrsp:0,nreg:0,cash:0,cryp:0,lirf:0,lif:0,rrif_acct:0}; 
            if(al2){ 
                gr2 = {
                    tfsa:p2.tfsa*cR2.tfsa, rrsp:p2.rrsp*cR2.rrsp, nreg:p2.nreg*cR2.nreg, cash:p2.cash*cR2.cash, cryp:p2.crypto*cR2.cryp,
                    lirf:p2.lirf*cR2.lirf, lif:p2.lif*cR2.lif, rrif_acct:p2.rrif_acct*cR2.rrif_acct
                }; 
                p2.tfsa+=gr2.tfsa; p2.rrsp+=gr2.rrsp; p2.nreg+=gr2.nreg; p2.cash+=gr2.cash; p2.crypto+=gr2.cryp; p2.lirf+=gr2.lirf; p2.lif+=gr2.lif; p2.rrif_acct+=gr2.rrif_acct; 
            }

            let surp = (nI1+nI2) - (aExp+mOut+dRep);
            if(surp>0) {
                let r=surp; this.state.strategies.accum.forEach(t => { if(r<=0)return;
                    if(t==='tfsa'){ if(al1&&(!this.state.inputs['skip_first_tfsa_p1']||i>0)){p1.tfsa+=r;yCont.tfsa+=r;r=0;} if(al2&&r>0&&(!this.state.inputs['skip_first_tfsa_p2']||i>0)){p2.tfsa+=r;yCont.tfsa+=r;r=0;} }
                    else if(t==='rrsp'&&al1&&(!this.state.inputs['skip_first_rrsp_p1']||i>0)){p1.rrsp+=r;yCont.rrsp+=r;r=0;} else if(t==='nreg'&&al1){p1.nreg+=r;yCont.nreg+=r;r=0;} else if(t==='cash'&&al1){p1.cash+=r;yCont.cash+=r;r=0;} else if(t==='crypto'&&al1){p1.crypto+=r;yCont.crypto+=r;r=0;}
                });
            } else {
                let df = Math.abs(surp); const wd = (p, t, a) => { if(a<=0)return 0; let tk=Math.min(p[t],a); p[t]-=tk; let k=(p===p1?"P1 ":"P2 ")+this.strategyLabels[t]; yWd[k]=(yWd[k]||0)+tk; wDBrk[p===p1?'p1':'p2'][this.strategyLabels[t]]=(wDBrk[p===p1?'p1':'p2'][this.strategyLabels[t]]||0)+tk; return a-tk; };
                this.state.strategies.decum.forEach(t => { if(df>0.1) { if(al1) df=wd(p1,t,df); if(al2&&df>0) df=wd(p2,t,df); } });
            }

            const getWd = pfix => ['TFSA','Cash','Non-Reg','Crypto'].reduce((s,k)=>s+(yWd[`${pfix} ${k}`]||0), 0);
            let fN1 = al1 ? nI1+getWd('P1') : 0, fN2 = al2 ? nI2+getWd('P2') : 0;
            
            const iTot = p1.tfsa+p1.rrsp+p1.crypto+p1.nreg+p1.cash+p1.lirf+p1.lif+p1.rrif_acct + (al2 ? p2.tfsa+p2.rrsp+p2.crypto+p2.nreg+p2.cash+p2.lirf+p2.lif+p2.rrif_acct : 0);
            const lNW = iTot-othD;
            let iRE = 0, iRM = 0, tRE = 0, tRM = 0; simP.forEach(p => { tRE+=p.value; tRM+=p.mortgage; if(p.includeInNW){ iRE+=p.value; iRM+=p.mortgage; } });
            fNW = lNW+(iRE-iRM);

            if(!onlyCalcNW) {
                let tWd = Object.values(yWd).reduce((a,b)=>a+b,0), tGr = Object.values(gr1).reduce((a,b)=>a+b,0)+Object.values(gr2).reduce((a,b)=>a+b,0);
                this.state.projectionData.push({
                    year:yr, p1Age:a1, p2Age:al2?a2:null, p1Alive:al1, p2Alive:al2, incomeP1:g1, incomeP2:g2, benefitsP1:c1+o1, benefitsP2:c2+o2, cppP1:c1, cppP2:c2, oasP1:o1, oasP2:o2, dbP1:db1, dbP2:db2, taxP1:t1.totalTax, taxP2:t2.totalTax, p1Net:fN1, p2Net:fN2, expenses:aExp, mortgagePay:mOut, debtPay:dRep, surplus:surp, drawdown:surp<0?Math.abs(surp):0, debugNW:fNW, debugTotalInflow:g1+g2+c1+o1+c2+o2+db1+db2+tWd+wfT1+wfT2+wfN1+wfN2+pst1+pst2, assetsP1:{...p1}, assetsP2:{...p2}, wdBreakdown:wDBrk, inv_tfsa:p1.tfsa+p2.tfsa, inv_rrsp:p1.rrsp+p2.rrsp, inv_cash:p1.cash+p2.cash, inv_nreg:p1.nreg+p2.nreg, inv_crypto:p1.crypto+p2.crypto, flows:{contributions:yCont, withdrawals:yWd}, totalGrowth:tGr, growthPct:iTot>0?(tGr/(iTot-tGr-surp))*100:0, events:evt, householdNet:fN1+fN2, visualExpenses:aExp+mOut+dRep+t1.totalTax+t2.totalTax, mortgage:tRM, homeValue:tRE, investTot:iTot, liquidNW:lNW, isCrashYear:cYr, windfall:wfT1+wfT2+wfN1+wfN2, postRetP1:pst1, postRetP2:pst2
                });
            }
            eC*=(1+infl); eR*=(1+infl); eT*=(1+infl); eG*=(1+infl); eS*=(1+infl); eN*=(1+infl);
        }

        if(!onlyCalcNW) {
            const th = document.documentElement.getAttribute('data-bs-theme')||'dark', hC = th==='light'?'bg-white text-dark border-bottom border-dark-subtle':'bg-transparent text-white border-secondary', tT = th==='light'?'text-dark':'text-body';
            let html = `<div class="grid-header ${hC}"><div class="col-start col-timeline ${tT}">Timeline</div><div class="col-start">Status</div><div class="text-body ${tT}">Net Income</div><div class="text-danger">Expenses</div><div class="${tT}">Surplus</div><div class="${tT}">Net Worth</div><div class="text-center ${tT}"><i class="bi bi-chevron-bar-down"></i></div></div>`;
            this.state.projectionData.forEach((d, idx) => {
                const df = this.getDiscountFactor(idx), fmtK = n => { const v=n/df, a=Math.abs(v); if(Math.round(a)===0)return''; const s=v<0?'-':''; return a>=1000000?s+(a/1000000).toFixed(1)+'M':(a>=1000?s+Math.round(a/1000)+'k':s+a.toFixed(0)); };
                const p1A=d.p1Alive?d.p1Age:'†', p2A=mode==='Couple'?(d.p2Alive?d.p2Age:'†'):'', p1R=d.p1Age>=p1.retAge, p2R=mode==='Couple'?d.p2Age>=p2.retAge:true;
                let stat = `<span class="status-pill status-working">Working</span>`;
                if(mode==='Couple') { if(p1R&&p2R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`; else if(p1R||p2R) stat = `<span class="status-pill status-semi">Transition</span>`; }
                else if(p1R) stat = d.p1Age<gLim?`<span class="status-pill status-gogo">Go-go Phase</span>`:d.p1Age<sLim?`<span class="status-pill status-slow">Slow-go Phase</span>`:`<span class="status-pill status-nogo">No-go Phase</span>`;
                
                const ln = (l,v,c='') => (!v||Math.round(v)===0)?'':`<div class="detail-item"><span>${l}</span> <span class="${c}">${fmtK(v)}</span></div>`, sL = (l,v) => (!v||Math.round(v)===0)?'':`<div class="detail-item sub"><span>${l}</span> <span>${fmtK(v)}</span></div>`;
                let iL = ln("Employment P1",d.incomeP1) + (mode==='Couple'?ln("Employment P2",d.incomeP2):'') + sL("Post-Ret Work P1",d.postRetP1) + sL("Post-Ret Work P2",d.postRetP2) + ((d.benefitsP1+d.benefitsP2)>0?sL("CPP/OAS P1",d.cppP1+d.oasP1)+(mode==='Couple'?sL("CPP/OAS P2",d.cppP2+d.oasP2):''):'') + sL("DB Pension P1",d.dbP1) + sL("DB Pension P2",d.dbP2) + ln("Inheritance/Bonus",d.windfall,"text-success fw-bold");
                Object.entries(d.wdBreakdown.p1).forEach(([t,a])=>iL+=sL(`${t} W/D P1`,a)); if(mode==='Couple') Object.entries(d.wdBreakdown.p2).forEach(([t,a])=>iL+=sL(`${t} W/D P2`,a));
                let eL = ln("Living Exp",d.expenses)+ln("Mortgage",d.mortgagePay)+ln("Debt Repayment",d.debtPay)+ln("Tax Paid P1",d.taxP1,"val-negative")+(mode==='Couple'?ln("Tax Paid P2",d.taxP2,"val-negative"):'');
                
                let aL = ln("TFSA P1",d.assetsP1.tfsa)+(mode==='Couple'?ln("TFSA P2",d.assetsP2.tfsa):'')+ln(d.p1Age>=72?'RRIF P1':'RRSP P1',d.assetsP1.rrsp)+(mode==='Couple'?ln(d.p2Age>=72?'RRIF P2':'RRSP P2',d.assetsP2.rrsp):'');
                aL += ln("LIRF P1",d.assetsP1.lirf) + (mode==='Couple'?ln("LIRF P2",d.assetsP2.lirf):'');
                aL += ln("LIF P1",d.assetsP1.lif) + (mode==='Couple'?ln("LIF P2",d.assetsP2.lif):'');
                aL += ln("Manual RRIF P1",d.assetsP1.rrif_acct) + (mode==='Couple'?ln("Manual RRIF P2",d.assetsP2.rrif_acct):'');
                aL += ln("Non-Reg P1",d.assetsP1.nreg)+(mode==='Couple'?ln("Non-Reg P2",d.assetsP2.nreg):'')+ln("Cash P1",d.assetsP1.cash)+(mode==='Couple'?ln("Cash P2",d.assetsP2.cash):'')+ln("Liquid Net Worth",d.liquidNW,"text-info fw-bold")+ln("Total Real Estate Eq.",d.homeValue-d.mortgage);
                
                const rB = th==='light'?'bg-white border-bottom border-dark-subtle':'', rT = th==='light'?'text-dark':'text-white';
                html += `<div class="grid-row-group" style="${th==='light'?'border-bottom:1px solid #ddd;':''}"><div class="grid-summary-row ${rB}" onclick="app.toggleRow(this)"><div class="col-start col-timeline"><div class="d-flex align-items-center"><span class="fw-bold fs-6 me-1 ${rT}">${d.year}</span><span class="event-icons-inline">${d.events.map(k=>this.getIconHTML(k,th)).join('')}</span></div><span class="age-text ${rT}">${p1A} ${mode==='Couple'?'/ '+p2A:''}</span></div><div class="col-start">${stat}</div><div class="val-positive">${fmtK(d.householdNet)}</div><div class="val-neutral text-danger">${fmtK(d.visualExpenses)}</div><div class="${d.surplus<0?'val-negative':'val-positive'}">${d.surplus>0?'+':''}${fmtK(d.surplus)}</div><div class="fw-bold ${rT}">${fmtK(d.debugNW)}</div><div class="text-center toggle-icon ${rT}"><i class="bi bi-chevron-down"></i></div></div><div class="grid-detail-wrapper"><div class="detail-container"><div class="detail-box surface-card"><div class="detail-title">Income Sources</div>${iL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Net</span> <span class="text-success fw-bold">${fmtK(d.householdNet)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">Outflows & Taxes</div>${eL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total Out</span> <span class="text-danger fw-bold">${fmtK(d.visualExpenses)}</span></div></div><div class="detail-box surface-card"><div class="detail-title">Assets (End of Year)</div>${aL}<div class="detail-item mt-auto" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;"><span class="text-white">Total NW</span> <span class="text-info fw-bold">${fmtK(d.debugNW)}</span></div></div></div></div></div>`;
            });
            const grid = document.getElementById('projectionGrid'); if(grid) grid.innerHTML = html;
        }
        return fNW;
    }

    getIconHTML(k, th) {
        const d = this.iconDefs[k]; if(!d) return ''; let c = d.color;
        if(th==='light'){ if(c.includes('text-white')||c.includes('text-warning')) c='text-dark'; if(c.includes('text-info')) c='text-primary'; }
        return `<i class="bi ${d.icon} ${c}" title="${d.title}"></i>`;
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
        el.innerHTML = Math.abs(new Date(Date.now() - new Date(dI+"-01").getTime()).getUTCFullYear() - 1970) + " years old";
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
    restoreDetailsState() { ['inv','inc','exp'].forEach(t => { const b=document.querySelector(`span[data-type="${t}"]`); if(b) b.innerText = document.body.classList.contains(`show-${t}`) ? '[-]' : '[+]'; }); }

    /** FIXED: Correct loop stepping and applying data back to the UI */
    findOptimal() {
        const findFor = (pfx) => {
            const cppOn=this.state.inputs[`${pfx}_cpp_enabled`], oasOn=this.state.inputs[`${pfx}_oas_enabled`];
            if(cppOn||oasOn) {
                const oC=document.getElementById(`${pfx}_cpp_start`).value, oO=document.getElementById(`${pfx}_oas_start`).value;
                let mx=-Infinity, bC=65, bO=65;
                // Checks every single year to find the true peak
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
            let sY=new Date(s.start+"-01").getFullYear(), eY=(s.end?new Date(s.end+"-01"):new Date("2100-01-01")).getFullYear();
            if(cY>=sY && cY<=eY) {
                let a = s.amount * Math.pow(1+(s.growth/100), cY-sY) * (s.freq==='month'?12:1) * (cY===sY?(12-new Date(s.start+"-01").getMonth())/12:(cY===eY?Math.min(1, (new Date(s.end+"-01").getMonth()+1)/12):1));
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

    updateMortgagePayment() {
        if(this.state.manualMortgage) return;
        const P=this.getVal('mortgage_amt'), r=this.getVal('mortgage_rate')/1200;
        let pmt = (P>0&&r>0) ? P*(r*Math.pow(1+r,300))/(Math.pow(1+r,300)-1) : (P>0?P/300:0);
        document.getElementById('mortgage_payment').value = this.state.inputs['mortgage_payment'] = Math.round(pmt).toLocaleString('en-US');
        this.updateMortgagePayoffDate();
    }

    updateMortgagePayoffDate() {
        const P=this.getVal('mortgage_amt'), r=(this.getVal('mortgage_rate')/100)/12, pmt=this.getVal('mortgage_payment'), el=document.getElementById('mortgage_payoff_display');
        if(P<=0) return el.innerHTML=""; if(pmt<=P*r) return el.innerHTML=`<span class="text-danger small fw-bold">Payment too low</span>`;
        const nMonths = -Math.log(1 - (r*P)/pmt) / Math.log(1+r);
        if(isFinite(nMonths)) { const d=new Date(); d.setMonth(d.getMonth()+nMonths); el.innerHTML=`<span class="small text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Payoff: ${d.toLocaleDateString('en-US',{month:'long',year:'numeric'})} (${Math.floor(nMonths/12)}y ${Math.round(nMonths%12)}m)</span>`; } else el.innerHTML="";
    }

    getRawExpenseTotals() { let c=0, r=0; Object.values(this.expensesByCategory).forEach(d=>d.items.forEach(i=>{c+=i.curr*i.freq; r+=i.ret*i.freq;})); return {current:c, retirement:r}; }
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
        if(!nm) {
            alert("Please enter a plan name.");
            return;
        }
        this.saveScenarioData(nm);
        if(this.saveModalInstance) {
            this.saveModalInstance.hide();
        }
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

    /** FIXED: Renders the chart using saved Net Worth Trajectories */
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
        if(document.getElementById('p1_db_start_val')) document.getElementById('p1_db_start_val').innerText = this.getRaw('p1_db_start_age')||'60';
        if(document.getElementById('p2_db_start_val')) document.getElementById('p2_db_start_val').innerText = this.getRaw('p2_db_start_age')||'60';
        
        if(document.getElementById('p1_oas_years_val')) document.getElementById('p1_oas_years_val').innerText = this.getRaw('p1_oas_years')||'40';
        if(document.getElementById('p2_oas_years_val')) document.getElementById('p2_oas_years_val').innerText = this.getRaw('p2_oas_years')||'40';
        if(document.getElementById('p1_cpp_start_val')) document.getElementById('p1_cpp_start_val').innerText = this.getRaw('p1_cpp_start')||'65';
        if(document.getElementById('p1_oas_start_val')) document.getElementById('p1_oas_start_val').innerText = this.getRaw('p1_oas_start')||'65';
        if(document.getElementById('p2_cpp_start_val')) document.getElementById('p2_cpp_start_val').innerText = this.getRaw('p2_cpp_start')||'65';
        if(document.getElementById('p2_oas_start_val')) document.getElementById('p2_oas_start_val').innerText = this.getRaw('p2_oas_start')||'65';
        
        this.updatePostRetIncomeVisibility();
    }
    
    /** FIXED: Adds projected Net Worth and Years arrays so the chart can draw saved states */
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
