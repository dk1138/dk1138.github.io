/**
 * Retirement Planner Pro - Core Application Controller
 * Version 10.14.4 (Performance & UX Optimizations)
 */

import { FINANCIAL_CONSTANTS } from './config.js';

class RetirementPlanner {
    constructor() {
        try {
            this.APP_VERSION = "10.14.4";
            this.state = {
                inputs: {},
                debt: [],
                properties: [{ name: "Primary Home", value: 1000000, mortgage: 430000, growth: 3.0, rate: 3.29, payment: 0, manual: false, includeInNW: false, sellEnabled: false, sellAge: 65, replacementValue: 0 }],
                windfalls: [],
                additionalIncome: [],
                leaves: [],
                dependents: [], 
                strategies: { 
                    accum: ['tfsa', 'fhsa', 'resp', 'rrsp', 'nreg', 'cash', 'crypto', 'rrif_acct'], 
                    decum: ['rrif_acct', 'lif', 'rrsp', 'lirf', 'crypto', 'nreg', 'tfsa', 'fhsa', 'resp', 'cash'] 
                },
                mode: 'Couple',
                projectionData: [],
                expenseMode: 'Simple'
            };

            this.AUTO_SAVE_KEY = 'rp_autosave_v1';
            this.THEME_KEY = 'rp_theme';
            
            // Assign Constants from the ES6 Module Import
            this.CONSTANTS = FINANCIAL_CONSTANTS;
            this.SP500_HISTORICAL = FINANCIAL_CONSTANTS.SP500_HISTORICAL;

            this.charts = { nw: null, sankey: null, mc: null }; 
            this.confirmModal = null; 
            this.saveModalInstance = null;
            this.loadModalInstance = null;
            this.sliderTimeout = null;

            this.expensesByCategory = {
                "Housing": { items: [ { name: "Property Tax", curr: 6000, ret: 6000, trans: 6000, gogo: 6000, slow: 6000, nogo: 6000, freq: 1 }, { name: "Enbridge (Gas)", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Enercare (HWT)", curr: 45, ret: 45, trans: 45, gogo: 45, slow: 45, nogo: 45, freq: 12 }, { name: "Alectra (Hydro)", curr: 150, ret: 150, trans: 150, gogo: 150, slow: 150, nogo: 150, freq: 12 }, { name: "RH Water", curr: 80, ret: 80, trans: 80, gogo: 80, slow: 80, nogo: 80, freq: 12 } ] },
                "Living": { items: [ { name: "Grocery", curr: 800, ret: 800, trans: 800, gogo: 800, slow: 700, nogo: 600, freq: 12 }, { name: "Costco", curr: 400, ret: 400, trans: 400, gogo: 400, slow: 350, nogo: 300, freq: 12 }, { name: "Restaurants", curr: 400, ret: 300, trans: 350, gogo: 350, slow: 200, nogo: 100, freq: 12 }, { name: "Cellphone", curr: 120, ret: 120, trans: 120, gogo: 120, slow: 120, nogo: 120, freq: 12 }, { name: "Internet", curr: 90, ret: 90, trans: 90, gogo: 90, slow: 90, nogo: 90, freq: 12 } ] },
                "Kids": { items: [ { name: "Daycare", curr: 1200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Activities", curr: 200, ret: 0, trans: 0, gogo: 0, slow: 0, nogo: 0, freq: 12 }, { name: "Clothing/Toys", curr: 100, ret: 50, trans: 50, gogo: 50, slow: 0, nogo: 0, freq: 12 } ] },
                "Lifestyle": { items: [ { name: "Travel", curr: 5000, ret: 15000, trans: 10000, gogo: 15000, slow: 5000, nogo: 0, freq: 1 }, { name: "Electronic", curr: 500, ret: 500, trans: 500, gogo: 500, slow: 500, nogo: 200, freq: 1 }, { name: "Health Insurance", curr: 50, ret: 300, trans: 150, gogo: 300, slow: 500, nogo: 1000, freq: 12 }, { name: "Other", curr: 300, ret: 300, trans: 300, gogo: 300, slow: 200, nogo: 100, freq: 12 } ] }
            };
            
            this.optimalAges = { p1_cpp: 65, p1_oas: 65, p2_cpp: 65, p2_oas: 65 };
            
            this.strategyLabels = { 
                'tfsa': 'TFSA', 
                'fhsa': 'FHSA',
                'resp': 'RESP',
                'rrsp': 'RRSP', 
                'rrif_acct': 'RRIF', 
                'lif': 'LIF', 
                'lirf': 'LIRF (LIRA)', 
                'nreg': 'Non-Reg', 
                'cash': 'Cash', 
                'crypto': 'Crypto' 
            };

            if (typeof UIController === 'undefined') throw new Error("UIController is missing!");
            if (typeof DataController === 'undefined') throw new Error("DataController is missing!");
            if (typeof Optimizers === 'undefined') throw new Error("Optimizers module is missing!");

            this.ui = new UIController(this);
            this.data = new DataController(this);
            this.optimizers = new Optimizers(this);

            if(typeof google !== 'undefined' && google.charts) google.charts.load('current', {'packages':['sankey']});
            
            this.debouncedRun = this.debounce(() => this.run(), 300);
            this.debouncedPayoffUpdate = this.debounce((idx) => {
                 this.data.updatePropPayoffDisplay(idx);
                 this.run(); 
            }, 500);

            this.init();
        } catch (e) {
            this.displayCrash(e);
        }
    }

    displayCrash(e) {
        console.error("FATAL ERROR ON INIT:", e);
        document.body.innerHTML = `
            <div style="padding:40px; font-family:sans-serif;">
                <div style="background-color:#ffebe9; border:2px solid #dc3545; border-radius:8px; padding:20px; color:#842029; max-width:800px; margin:auto; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
                    <h2 style="margin-top:0; font-weight:bold;">⚠️ Application Failed to Load</h2>
                    <p style="font-size:16px;">The application crashed during startup. This is almost always caused by a missing file, a file naming typo, or corrupted auto-save data.</p>
                    <div style="background-color:#212529; color:#f8f9fa; padding:15px; border-radius:5px; font-family:monospace; overflow-x:auto; margin-bottom:20px;">
                        ${e.stack || e.message || e}
                    </div>
                    <button style="background-color:#dc3545; color:white; border:none; padding:10px 20px; font-size:16px; border-radius:5px; cursor:pointer; font-weight:bold;" onclick="localStorage.removeItem('rp_autosave_v1'); location.reload();">Clear Save Data & Reload</button>
                </div>
            </div>
        `;
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    isVersionTooOld(saveVersion, minVersion) {
        if (!saveVersion) return true;
        const s = saveVersion.split('.').map(Number);
        const m = minVersion.split('.').map(Number);
        for (let i = 0; i < m.length; i++) {
            if ((s[i] || 0) < m[i]) return true;
            if ((s[i] || 0) > m[i]) return false;
        }
        return false;
    }

    getEngineData() {
        return {
            inputs: { ...this.state.inputs },
            properties: structuredClone(this.state.properties || []),
            windfalls: structuredClone(this.state.windfalls || []),
            additionalIncome: structuredClone(this.state.additionalIncome || []),
            leaves: structuredClone(this.state.leaves || []),
            dependents: structuredClone(this.state.dependents || []),
            debt: structuredClone(this.state.debt || []),
            strategies: { 
                accum: [...(this.state.strategies?.accum || ['tfsa', 'fhsa', 'resp', 'rrsp', 'nreg', 'cash', 'crypto', 'rrif_acct'])].filter(x => x !== 'lif' && x !== 'lirf'), 
                decum: [...(this.state.strategies?.decum || ['rrif_acct', 'lif', 'rrsp', 'lirf', 'crypto', 'nreg', 'tfsa', 'fhsa', 'resp', 'cash'])] 
            },
            mode: this.state.mode || 'Couple',
            expenseMode: this.state.expenseMode || 'Simple',
            expensesByCategory: structuredClone(this.expensesByCategory || {}),
            constants: this.CONSTANTS,
            strategyLabels: this.strategyLabels
        };
    }

    init() {
        const setup = () => {
            try {
                const selectors = ['#app-title', '.navbar-brand', 'h1', '.h1', 'h2', 'h4'];
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

                if(document.getElementById('confirmationModal')) {
                    this.confirmModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
                }
                if(document.getElementById('saveScenarioModal')) {
                    this.saveModalInstance = new bootstrap.Modal(document.getElementById('saveScenarioModal'));
                }
                if(document.getElementById('loadScenarioModal')) {
                    this.loadModalInstance = new bootstrap.Modal(document.getElementById('loadScenarioModal'));
                }
                
                this.ui.populateAgeSelects();
                
                const MIN_VERSION = "10.0.0"; 
                const savedData = localStorage.getItem(this.AUTO_SAVE_KEY);
                
                if (savedData) {
                    try { 
                        let parsed = JSON.parse(savedData);
                        if (this.isVersionTooOld(parsed.version, MIN_VERSION)) {
                            console.warn(`Save file (v${parsed.version || 'unknown'}) is too old. Minimum required is v${MIN_VERSION}. Loading defaults.`);
                            localStorage.removeItem(this.AUTO_SAVE_KEY);
                            this.renderDefaults();
                        } else {
                            this.loadStateToDOM(parsed); 
                        }
                    } catch(e) { 
                        console.error("Corrupted Save Found, resetting...", e); 
                        localStorage.removeItem(this.AUTO_SAVE_KEY);
                        this.renderDefaults(); 
                    }
                } else {
                    this.renderDefaults();
                }

                this.ui.initTheme(); 
                this.loadScenariosList(); 
                this.syncStateFromDOM(); 
                this.ui.toggleModeDisplay(); 
                this.ui.updateBenefitVisibility();
                this.ui.updateAgeDisplay('p1'); 
                this.ui.updateAgeDisplay('p2');
                this.data.updateAllMortgages(); 
                this.findOptimal(); 
                this.bindEvents(); 
                this.ui.initSidebar();
                try { this.ui.initPopovers(); } catch(e) { console.warn("Popover init skip", e); }

                setTimeout(() => { this.syncStateFromDOM(); this.updateStrategyVisuals(); this.run(); }, 300); 
            } catch (e) {
                this.displayCrash(e);
            }
        };
        
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
        else setup(); 
    }

    renderDefaults() {
        this.data.renderExpenseRows(); 
        this.data.renderProperties(); 
        if(this.state.debt.length === 0) this.data.addDebtRow(); 
        this.data.renderWindfalls(); 
        this.data.renderAdditionalIncome(); 
        this.data.renderLeaves();
        this.data.renderDependents();
        this.data.renderStrategy();
    }

    showConfirm(message, onConfirm) {
        const modalEl = document.getElementById('confirmationModal');
        if(!modalEl) return onConfirm(); 

        modalEl.querySelector('.modal-body').textContent = message;
        const btn = document.getElementById('btnConfirmAction');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => { 
            try { onConfirm(); } 
            catch (e) { console.error("Error executing confirmation:", e); } 
            finally { if(this.confirmModal) this.confirmModal.hide(); }
        });
        
        if(this.confirmModal) this.confirmModal.show();
    }

    syncStateFromDOM() {
        document.querySelectorAll('input, select').forEach(el => {
            if (el.id && !el.id.startsWith('comp_') && !el.className.includes('-update') && !el.classList.contains('debt-update')) {
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

    getRaw(id) { 
        return this.state.inputs[id] !== undefined ? this.state.inputs[id] : document.getElementById(id)?.value; 
    }

    getDiscountFactor(y) { 
        const ud = document.getElementById('useRealDollars');
        return (!ud || !ud.checked) ? 1 : Math.pow(1 + this.getVal('inflation_rate')/100, y); 
    }

    formatInput(el) { 
        const start = el.selectionStart;
        const oldValLength = el.value.length;

        const v = String(el.value).replace(/,/g, ''); 
        if(!isNaN(v) && v !== '') {
            const newVal = Number(v).toLocaleString('en-US');
            el.value = newVal;

            if (document.activeElement === el) {
                const diff = newVal.length - oldValLength;
                const newPos = Math.max(0, start + diff);
                el.setSelectionRange(newPos, newPos);
            }
        }
    }

    bindEvents() {
        const $ = id => document.getElementById(id);
        
        if($('btnThemeToggle')) $('btnThemeToggle').addEventListener('click', () => this.ui.toggleTheme());
        if($('useRealDollars')) $('useRealDollars').addEventListener('change', () => { this.data.calcExpenses(); this.run(); });

        const fabBtn = $('fabQuickAdjust');
        const widgetCard = $('quickAdjustWidget');
        const closeWidgetBtn = $('closeWidgetBtn');
        
        if (fabBtn && widgetCard) {
            fabBtn.addEventListener('click', () => widgetCard.classList.toggle('active'));
        }
        if (closeWidgetBtn && widgetCard) {
            closeWidgetBtn.addEventListener('click', () => widgetCard.classList.remove('active'));
        }

        document.body.addEventListener('change', (e) => {
            if (e.target.id === 'expense_mode_advanced') {
                this.state.expenseMode = e.target.checked ? 'Advanced' : 'Simple';
                if($('expense-phase-controls')) $('expense-phase-controls').style.display = e.target.checked ? 'flex' : 'none';
                this.data.renderExpenseRows(); this.data.calcExpenses(); this.run();
            }
            if (e.target.id === 'asset_mode_advanced') {
                const isAdv = e.target.checked;
                document.querySelectorAll('.asset-bal-col').forEach(el => el.className = isAdv ? 'col-3 asset-bal-col' : 'col-5 asset-bal-col');
                document.querySelectorAll('.asset-ret-col').forEach(el => el.className = isAdv ? 'col-3 asset-ret-col' : 'col-4 asset-ret-col');
                document.querySelectorAll('.adv-asset-col').forEach(el => el.style.display = isAdv ? 'block' : 'none');
                document.querySelectorAll('.lbl-ret').forEach(el => el.innerText = isAdv ? 'Pre-Ret(%)' : 'Return (%)');
                this.run();
            }
            if (e.target.classList.contains('live-calc') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'radio')) {
                if(e.target.id && !e.target.id.startsWith('comp_')) this.state.inputs[e.target.id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                if(e.target.id && e.target.id.includes('_enabled')) this.ui.updateBenefitVisibility();
                if(e.target.id === 'fully_optimize_tax') this.updateStrategyVisuals();
                this.findOptimal(); this.run(); this.data.calcExpenses(); 
            }
        });

        const gogoS = $('exp_gogo_age'), slowS = $('exp_slow_age');
        if (gogoS && slowS) {
            gogoS.addEventListener('input', e => {
                let v = parseInt(e.target.value), sV = parseInt(slowS.value);
                if($('exp_gogo_val')) $('exp_gogo_val').innerText = v; this.state.inputs['exp_gogo_age'] = v;
                if(v > sV) { slowS.value = v; if($('exp_slow_val')) $('exp_slow_val').innerText = v; this.state.inputs['exp_slow_age'] = v; }
                this.data.renderExpenseRows(); this.data.calcExpenses(); this.debouncedRun();
            });
            slowS.addEventListener('input', e => {
                let v = parseInt(e.target.value), gV = parseInt(gogoS.value);
                if($('exp_slow_val')) $('exp_slow_val').innerText = v; this.state.inputs['exp_slow_age'] = v;
                if(v < gV) { gogoS.value = v; if($('exp_gogo_val')) $('exp_gogo_val').innerText = v; this.state.inputs['exp_gogo_age'] = v; }
                this.data.renderExpenseRows(); this.data.calcExpenses(); this.debouncedRun();
            });
        }

        if($('btnClearAll')) $('btnClearAll').addEventListener('click', () => this.showConfirm("Clear all data? This will wipe your current unsaved plan.", () => this.resetAllData()));
        if($('btnAddProperty')) $('btnAddProperty').addEventListener('click', () => this.data.addProperty());
        if($('btnAddWindfall')) $('btnAddWindfall').addEventListener('click', () => this.data.addWindfall());
        if($('btnAddChild')) $('btnAddChild').addEventListener('click', () => this.data.addDependent());
        if ($('btnAddIncomeP1')) $('btnAddIncomeP1').addEventListener('click', () => this.data.addAdditionalIncome('p1'));
        if ($('btnAddIncomeP2')) $('btnAddIncomeP2').addEventListener('click', () => this.data.addAdditionalIncome('p2'));
        
        if($('btnExportCSV')) $('btnExportCSV').addEventListener('click', () => this.exportToCSV());
        if($('btnExportPDF')) $('btnExportPDF').addEventListener('click', () => this.exportToPDF());
        
        if($('btnExportJSON')) $('btnExportJSON').addEventListener('click', () => this.exportCurrentToJSON());
        if($('fileUpload')) $('fileUpload').addEventListener('change', e => this.handleFileUpload(e));
        
        document.body.addEventListener('input', e => {
            const cl = e.target.classList;
            if (cl.contains('live-calc')) {
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                if (e.target.id && !e.target.id.startsWith('comp_') && e.target.id !== 'exp_gogo_age' && e.target.id !== 'exp_slow_age' && !cl.contains('property-update') && !cl.contains('windfall-update') && !cl.contains('debt-update') && !cl.contains('income-stream-update') && !cl.contains('leave-update') && !cl.contains('dependent-update')) {
                    this.state.inputs[e.target.id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    this.ui.updateSidebarSync(e.target.id, e.target.value);
                }
                this.debouncedRun();
            }
            if (cl.contains('expense-update')) {
                const { cat, idx, field } = e.target.dataset;
                let val = ['curr', 'ret', 'trans', 'gogo', 'slow', 'nogo'].includes(field) ? Number(e.target.value.replace(/,/g, '')) || 0 : (field === 'freq' ? parseInt(e.target.value) : e.target.value);
                if (this.expensesByCategory[cat]?.items[idx]) this.expensesByCategory[cat].items[idx][field] = val;
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun(); this.data.calcExpenses(); 
            }
            if (cl.contains('property-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                if (['value', 'mortgage', 'payment', 'sellAge', 'replacementValue'].includes(field)) val = Number(String(val).replace(/,/g, '')) || 0;
                else if (['growth', 'rate'].includes(field)) val = parseFloat(val) || 0;
                if (this.state.properties[idx]) {
                    this.state.properties[idx][field] = val;
                    if(field === 'payment') this.state.properties[idx].manual = true;
                    if(!['payment', 'name', 'includeInNW', 'sellEnabled', 'sellAge', 'replacementValue'].includes(field)) { this.state.properties[idx].manual = false; this.data.calculateSingleMortgage(idx); }
                    if(field === 'payment') this.debouncedPayoffUpdate(idx);
                }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                if(field !== 'payment') this.debouncedRun();
            }
            if (cl.contains('windfall-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : (field === 'amount' ? Number(e.target.value.replace(/,/g, '')) || 0 : e.target.value);
                if (this.state.windfalls[idx]) { this.state.windfalls[idx][field] = val; if(field === 'freq') this.data.renderWindfalls(); }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.debouncedRun();
            }
            if (cl.contains('income-stream-update')) {
                const { idx, field } = e.target.dataset;
                let val = e.target.type === 'checkbox' ? e.target.checked : (['amount', 'growth', 'startRel', 'duration'].includes(field) ? Number(e.target.value.replace(/,/g, '')) || 0 : e.target.value);
                if (this.state.additionalIncome[idx]) {
                    this.state.additionalIncome[idx][field] = val;
                    if (field === 'startMode' || field === 'endMode') {
                        this.data.renderAdditionalIncome();
                    }
                }
                if (cl.contains('formatted-num')) this.formatInput(e.target);
                this.data.updateIncomeDisplay(); this.debouncedRun();
            }
        });

        if($('p1_dob')) $('p1_dob').addEventListener('change', () => this.ui.updateAgeDisplay('p1'));
        if($('p2_dob')) $('p2_dob').addEventListener('change', () => this.ui.updateAgeDisplay('p2'));
        document.getElementsByName('planMode').forEach(r => r.addEventListener('change', () => { 
            if($('modeCouple')) this.state.mode = $('modeCouple').checked ? 'Couple' : 'Single';
            this.ui.toggleModeDisplay(); this.run(); this.data.calcExpenses();
        }));

        if($('yearSlider')) $('yearSlider').addEventListener('input', e => {
            const index = parseInt(e.target.value);
            if (this.state.projectionData && this.state.projectionData[index]) {
                const d = this.state.projectionData[index];
                if($('sliderYearDisplay')) $('sliderYearDisplay').innerText = d.year;
                if($('cfAgeDisplay')) $('cfAgeDisplay').innerText = this.state.mode === 'Couple' ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                document.querySelectorAll('.grid-row-group').forEach(r => r.style.backgroundColor = ''); 
                if(document.querySelectorAll('.grid-row-group')[index]) {
                    document.querySelectorAll('.grid-row-group')[index].style.backgroundColor = 'rgba(255,193,7,0.1)';
                    document.querySelectorAll('.grid-row-group')[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                clearTimeout(this.sliderTimeout);
                this.sliderTimeout = setTimeout(() => this.ui.drawSankey(index), 50);
            }
        });

        if(document.querySelector('button[data-bs-target="#cashflow-pane"]')) {
            document.querySelector('button[data-bs-target="#cashflow-pane"]').addEventListener('shown.bs.tab', () => {
                if($('yearSlider')) this.ui.drawSankey(parseInt($('yearSlider').value));
            });
        }
        
        const compareTabBtn = document.querySelector('button[data-bs-target="#compare-pane"]');
        if (compareTabBtn) {
            compareTabBtn.addEventListener('shown.bs.tab', () => { if(this.charts.nw) this.charts.nw.resize(); this.ui.renderComparisonChart(); });
        }

        if($('compareSelectionArea')) {
            $('compareSelectionArea').addEventListener('change', () => this.ui.renderComparisonChart());
        }

        if($('btnAddDebt')) $('btnAddDebt').addEventListener('click', () => this.data.addDebtRow());
        
        if($('btnModalSaveScenario')) {
            $('btnModalSaveScenario').addEventListener('click', () => this.saveScenarioFromModal());
        }

        document.body.addEventListener('click', e => {
            if(e.target.classList.contains('toggle-btn')) this.ui.toggleGroup(e.target.dataset.type);
            if(e.target.classList.contains('opt-apply')) this.applyOpt(e.target.dataset.target);
        });
    }

    findOptimal() {
        const findFor = (pfx) => {
            const cppOn=this.state.inputs[`${pfx}_cpp_enabled`], oasOn=this.state.inputs[`${pfx}_oas_enabled`];
            if(cppOn||oasOn) {
                const oC=document.getElementById(`${pfx}_cpp_start`)?.value, oO=document.getElementById(`${pfx}_oas_start`)?.value;
                let mx=-Infinity, bC=65, bO=65;
                const engine = new FinanceEngine(this.getEngineData());
                for(let c=60; c<=70; c++){ 
                    for(let o=65; o<=70; o++){ 
                        if(cppOn) engine.inputs[`${pfx}_cpp_start`] = c; 
                        if(oasOn) engine.inputs[`${pfx}_oas_start`] = o; 
                        const nw = engine.runSimulation(true); 
                        if(nw > mx){ mx = nw; bC = c; bO = o; } 
                    } 
                }
                if(cppOn) this.optimalAges[`${pfx}_cpp`]=bC; 
                if(oasOn) this.optimalAges[`${pfx}_oas`]=bO;
            }
            if(document.getElementById(`${pfx}_cpp_opt`)) document.getElementById(`${pfx}_cpp_opt`).innerHTML = cppOn ? `Optimal: Age ${this.optimalAges[`${pfx}_cpp`]} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="${pfx}_cpp">Apply</a>)` : `Optimization Disabled`;
            if(document.getElementById(`${pfx}_oas_opt`)) document.getElementById(`${pfx}_oas_opt`).innerHTML = oasOn ? `Optimal: Age ${this.optimalAges[`${pfx}_oas`]} (<a href="javascript:void(0)" class="text-success text-decoration-none fw-bold opt-apply" data-target="${pfx}_oas">Apply</a>)` : `Optimization Disabled`;
        };
        findFor('p1'); if(this.state.mode==='Couple') findFor('p2');
    }

    applyOpt(t) { 
        if(document.getElementById(`${t}_start`)) document.getElementById(`${t}_start`).value = this.optimalAges[t]; 
        if(document.getElementById(`${t}_start_val`)) document.getElementById(`${t}_start_val`).innerText = this.optimalAges[t]; 
        this.state.inputs[`${t}_start`] = this.optimalAges[t]; 
        this.run(); 
    }

    updateAssetTotals() {
        const sumAssets = (pfx) => {
            let total = 0;
            const accounts = ['tfsa', 'fhsa', 'resp', 'rrsp', 'lirf', 'lif', 'rrif_acct', 'nonreg', 'crypto', 'cash'];
            accounts.forEach(act => {
                total += this.getVal(`${pfx}_${act}`);
            });
            return total;
        };

        const p1Total = sumAssets('p1');
        const p2Total = this.state.mode === 'Couple' ? sumAssets('p2') : 0;
        const hhTotal = p1Total + p2Total;

        const fmt = n => '$' + Math.round(n).toLocaleString();

        if (document.getElementById('p1_total_assets_display')) document.getElementById('p1_total_assets_display').innerText = fmt(p1Total);
        if (document.getElementById('p2_total_assets_display')) document.getElementById('p2_total_assets_display').innerText = fmt(p2Total);
        if (document.getElementById('hh_total_assets_display')) document.getElementById('hh_total_assets_display').innerText = fmt(hhTotal);
    }

    updateStrategyVisuals() {
        const optimizeOn = document.getElementById('fully_optimize_tax')?.checked;
        const decumContainer = document.getElementById('strat-decumulation');
        if (decumContainer) {
            if (optimizeOn) {
                decumContainer.style.opacity = '0.4';
                decumContainer.style.pointerEvents = 'none';
                decumContainer.style.filter = 'grayscale(100%)';
            } else {
                decumContainer.style.opacity = '1';
                decumContainer.style.pointerEvents = 'auto';
                decumContainer.style.filter = 'none';
            }
        }
    }

    run() {
        try {
            this.updateAssetTotals();
            this.data.estimateCPPOAS(); 
            this.data.updateIncomeDisplay(); 
            this.data.calcExpenses(); 
            
            const engine = new FinanceEngine(this.getEngineData());
            this.state.projectionData = engine.runSimulation(true, null);

            const slider = document.getElementById('yearSlider');
            if (this.state.projectionData && this.state.projectionData.length && slider) {
                let cur = parseInt(slider.value), max = this.state.projectionData.length - 1;
                slider.max = max; if(cur > max) { slider.value = 0; cur = 0; }
                const d = this.state.projectionData[cur];
                if(document.getElementById('sliderYearDisplay')) document.getElementById('sliderYearDisplay').innerText = d.year;
                if(document.getElementById('cfAgeDisplay')) document.getElementById('cfAgeDisplay').innerText = this.state.mode === 'Couple' ? `(P1: ${d.p1Age} / P2: ${d.p2Age})` : `(Age: ${d.p1Age})`;
                clearTimeout(this.sliderTimeout); this.sliderTimeout = setTimeout(() => this.ui.drawSankey(cur), 50);
            }
            this.ui.renderProjectionGrid();
            this.ui.renderComparisonChart();
            this.saveToLocalStorage();
        } catch (e) { console.error("Error running calculation loop:", e); }
    }

    saveToLocalStorage() { 
        try {
            localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(this.getCurrentSnapshot())); 
        } catch(e) { console.warn("Save failed", e); }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        const MIN_VERSION = "10.0.0"; 

        reader.onload = event => {
            try { 
                let parsed = JSON.parse(event.target.result);
                
                if (this.isVersionTooOld(parsed.version, MIN_VERSION)) {
                    alert('This save file is too old and is no longer compatible with this version of the planner.');
                    return; 
                }
                
                this.loadStateToDOM(parsed); 
                this.run(); 
                this.ui.updateScenarioBadge(file.name.replace('.json',''));
                alert('Plan loaded successfully.'); 
            } 
            catch(err) { alert('Error parsing JSON.'); console.error(err); }
        };
        reader.readAsText(file); e.target.value = '';
    }

    exportCurrentToJSON() {
        const data = this.getCurrentSnapshot();
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const planNameEl = document.getElementById('currentScenarioName');
        const planName = planNameEl && planNameEl.innerText ? planNameEl.innerText : 'retirement_plan_export';
        a.download = planName.replace(/\s+/g, '_').toLowerCase() + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    resetAllData() {
        this.state.properties = [];
        this.state.windfalls = [];
        this.state.additionalIncome = [];
        this.state.leaves = [];
        this.state.dependents = [];
        this.state.debt = [];
        for (const cat in this.expensesByCategory) this.expensesByCategory[cat].items = [];

        this.state.mode = 'Couple';
        if(document.getElementById('modeCouple')) document.getElementById('modeCouple').checked = true;
        if(document.getElementById('modeSingle')) document.getElementById('modeSingle').checked = false;

        document.querySelectorAll('input, select').forEach(el => {
            if(el.id && !el.id.startsWith('comp_') && !el.classList.contains('property-update') && !el.classList.contains('windfall-update') && !el.classList.contains('income-stream-update') && !el.classList.contains('expense-update') && !el.classList.contains('debt-update') && !el.classList.contains('leave-update') && !el.classList.contains('dependent-update')) {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    if (el.name !== 'planMode') el.checked = false;
                } else if (el.type === 'range') {
                    el.value = el.defaultValue || el.min || 0;
                } else if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else {
                    el.value = ''; 
                }
                this.state.inputs[el.id] = el.type === 'checkbox' ? el.checked : el.value;
            }
        });

        const currentYear = new Date().getFullYear();
        const age30Dob = `${currentYear - 30}-01`;

        const safeDefaults = {
            'tax_province': 'ON', 'inflation_rate': '2.5', 'p1_dob': age30Dob, 'p2_dob': age30Dob, 
            'p1_retireAge': '60', 'p2_retireAge': '60', 'p1_lifeExp': '90', 'p2_lifeExp': '95', 
            'exp_gogo_age': '75', 'exp_slow_age': '85', 'cfg_tfsa_limit': '7,000', 'cfg_rrsp_limit': '32,960', 
            'cfg_fhsa_limit': '8,000', 'cfg_resp_limit': '2,500', 'cfg_crypto_limit': '5,000',
            'p1_tfsa_ret': '6.0', 'p2_tfsa_ret': '6.0', 'p1_rrsp_ret': '6.0', 'p2_rrsp_ret': '6.0', 
            'p1_nonreg_ret': '6.0', 'p2_nonreg_ret': '6.0', 'p1_crypto_ret': '6.0', 'p2_crypto_ret': '6.0', 
            'p1_nonreg_acb': '10,000', 'p2_nonreg_acb': '5,000', 'p1_crypto_acb': '5,000', 'p2_crypto_acb': '2,000',
            'p1_cash_ret': '2.0', 'p2_cash_ret': '2.0', 'p1_income_growth': '2.0', 'p2_income_growth': '2.0', 
            'p1_rrsp_match': '0.0', 'p2_rrsp_match': '0.0', 'p1_rrsp_match_tier': '100', 'p2_rrsp_match_tier': '100',
            'p1_cpp_start': '65', 'p2_cpp_start': '65', 'p1_oas_start': '65', 'p2_oas_start': '65', 
            'p1_oas_years': '40', 'p2_oas_years': '40'
        };

        for (const [id, val] of Object.entries(safeDefaults)) {
            const el = document.getElementById(id);
            if (el) { el.value = val; this.state.inputs[id] = val; }
        }

        const safeDefaultsCheckboxes = {
            'p1_cpp_enabled': false, 'p1_oas_enabled': false, 'p1_db_enabled': false,  
            'p2_cpp_enabled': false, 'p2_oas_enabled': false, 'p2_db_enabled': false,
            'oas_clawback_optimize': false, 'fully_optimize_tax': false
        };

        for (const [id, val] of Object.entries(safeDefaultsCheckboxes)) {
            const el = document.getElementById(id);
            if (el) { el.checked = val; this.state.inputs[id] = val; }
        }

        ['real-estate-container', 'windfall-container', 'p1-additional-income-container', 'p2-additional-income-container', 'p1-leaves-container', 'p2-leaves-container', 'dependents-container', 'debt-container'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).innerHTML = '';
        });

        this.ui.updateSidebarSync('p1_retireAge', '60');
        this.ui.updateSidebarSync('p2_retireAge', '60');
        this.ui.updateSidebarSync('inflation_rate', '2.5'); 
        this.ui.updateSidebarSync('p1_tfsa_ret', '6.0'); 

        if(document.getElementById('exp_gogo_val')) document.getElementById('exp_gogo_val').innerText = '75';
        if(document.getElementById('exp_slow_val')) document.getElementById('exp_slow_val').innerText = '85';
        
        ['p1', 'p2'].forEach(pfx => {
            ['cpp_start', 'oas_start', 'db_lifetime_start', 'db_bridge_start'].forEach(sfx => {
                const el = document.getElementById(`${pfx}_${sfx}_val`);
                if(el) el.innerText = document.getElementById(`${pfx}_${sfx}`)?.value || '65';
            });
            const oasY = document.getElementById(`${pfx}_oas_years_val`);
            if(oasY) oasY.innerText = '40';
        });

        localStorage.removeItem(this.AUTO_SAVE_KEY);

        this.ui.updateScenarioBadge(null);
        this.ui.updateBenefitVisibility();
        this.ui.updateAgeDisplay('p1');
        this.ui.updateAgeDisplay('p2');
        this.data.renderExpenseRows();
        this.data.renderDependents();
        this.data.renderStrategy();
        this.ui.toggleModeDisplay();

        this.run();
        this.updateStrategyVisuals();
    }

    exportToCSV() {
        if (!this.state.projectionData.length) return alert("No data available.");
        const mode = this.state.mode, d = this.state.projectionData;
        
        const h = [
            "Year", "P1 Age", mode==="Couple"?"P2 Age":null, 
            "P1 Base Income", "P1 Employer Match", mode==="Couple"?"P2 Base Income":null, mode==="Couple"?"P2 Employer Match":null,
            "P1 Post-Ret Inc", mode==="Couple"?"P2 Post-Ret Inc":null, 
            "P1 Benefits", mode==="Couple"?"P2 Benefits":null, 
            "P1 DB Pension", mode==="Couple"?"P2 DB Pension":null, 
            "P1 RRSP Refund", mode==="Couple"?"P2 RRSP Refund":null,
            "Windfall", 
            "P1 Taxes", mode==="Couple"?"P2 Taxes":null, 
            "Total Expenses", "Mortgage Payment", "Future Exp/Debt Pmt", "Surplus/Deficit", 
            "P1 TFSA", "P1 RRSP", "P1 Non-Reg", "P1 Cash", "P1 Crypto", "P1 LIRF", "P1 LIF", "P1 RRIF", 
            mode==="Couple"?"P2 TFSA":null, mode==="Couple"?"P2 RRSP":null, mode==="Couple"?"P2 Non-Reg":null, mode==="Couple"?"P2 Cash":null, mode==="Couple"?"P2 Crypto":null, mode==="Couple"?"P2 LIRF":null, mode==="Couple"?"P2 LIF":null, mode==="Couple"?"P2 RRIF":null, 
            "Liquid Net Worth", "Home Equity", "Total Net Worth"
        ].filter(x=>x!==null);
        
        const rows = d.map(r => [
            r.year, r.p1Age, mode==="Couple"?(r.p2Age||""):null, 
            Math.round(r.incomeP1), Math.round(r.rrspMatchP1 || 0), mode==="Couple"?Math.round(r.incomeP2):null, mode==="Couple"?Math.round(r.rrspMatchP2 || 0):null,
            Math.round(r.postRetP1||0), mode==="Couple"?Math.round(r.postRetP2||0):null, 
            Math.round(r.benefitsP1), mode==="Couple"?Math.round(r.benefitsP2):null, 
            Math.round(r.dbP1), mode==="Couple"?Math.round(r.dbP2):null, 
            Math.round(r.rrspRefundP1 || 0), mode==="Couple"?Math.round(r.rrspRefundP2 || 0):null,
            Math.round(r.windfall), 
            Math.round(r.taxP1), mode==="Couple"?Math.round(r.taxP2):null, 
            Math.round(r.expenses), Math.round(r.mortgagePay), Math.round(r.debtPay || r.debtRepayment || 0), Math.round(r.surplus), 
            Math.round(r.assetsP1.tfsa), Math.round(r.assetsP1.rrsp), Math.round(r.assetsP1.nreg), Math.round(r.assetsP1.cash), Math.round(r.assetsP1.crypto), Math.round(r.assetsP1.lirf), Math.round(r.assetsP1.lif), Math.round(r.assetsP1.rrif_acct), 
            mode==="Couple"?Math.round(r.assetsP2.tfsa):null, mode==="Couple"?Math.round(r.assetsP2.rrsp):null, mode==="Couple"?Math.round(r.assetsP2.nreg):null, mode==="Couple"?Math.round(r.assetsP2.cash):null, mode==="Couple"?Math.round(r.assetsP2.crypto):null, mode==="Couple"?Math.round(r.assetsP2.lirf):null, mode==="Couple"?Math.round(r.assetsP2.lif):null, mode==="Couple"?Math.round(r.assetsP2.rrif_acct):null, 
            Math.round(r.liquidNW), Math.round(r.homeValue-r.mortgage), Math.round(r.debugNW)
        ].filter(x=>x!==null).join(","));
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + [h.join(","), ...rows].join("\n"))); 
        link.setAttribute("download", "retirement_plan_pro.csv");
        document.body.appendChild(link); link.click(); link.remove();
    }

    exportToPDF() {
        if (!this.state.projectionData.length) return alert("No data available.");
        if (typeof window.jspdf === 'undefined') {
            alert("PDF library is still loading. Please try again in a few seconds.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        const mode = this.state.mode;
        const d = this.state.projectionData;

        // Create a focused, high-level summary suitable for a PDF page
        const head = [[
            "Year", "Age (P1" + (mode === 'Couple' ? '/P2)' : ')'), "Gross Inflow", "Total Taxes", "Living Exp & Debt", "Surplus/Deficit", "Liquid Portfolio", "Total Net Worth"
        ]];

        const body = d.map(r => {
            // FIX: Removed "this.app." and correctly called the internal method
            const df = this.getDiscountFactor(r.year - new Date().getFullYear());
            const fmtK = n => '$' + Math.round(n / df).toLocaleString();
            
            let ages = r.p1Age;
            if (mode === 'Couple') ages += ` / ${r.p2Age || '†'}`;
            
            return [
                r.year,
                ages,
                fmtK(r.grossInflow),
                fmtK(r.taxP1 + (r.taxP2 || 0)),
                fmtK(r.expenses + r.mortgagePay + r.debtRepayment),
                fmtK(r.surplus),
                fmtK(r.liquidNW),
                fmtK(r.debugNW)
            ];
        });

        doc.autoTable({
            head: head,
            body: body,
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
            margin: { top: 20 },
            didDrawPage: function (data) {
                doc.setFontSize(14);
                doc.setTextColor(40);
                doc.text('Retirement Projection Summary', data.settings.margin.left, 12);
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text('* For a granular breakdown of individual accounts, please use the Export to Excel (CSV) tool.', data.settings.margin.left, 17);
            }
        });

        const planNameEl = document.getElementById('currentScenarioName');
        const planName = planNameEl && planNameEl.innerText ? planNameEl.innerText.replace(/\s+/g, '_').toLowerCase() : 'retirement_plan';
        doc.save(`${planName}_summary.pdf`);
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
        this.ui.updateScenarioBadge(name);
        alert(`"${name}" has been saved.`);
    }

    loadScenariosList() {
        const lst = document.getElementById('scenarioList');
        const cmp = document.getElementById('compareSelectionArea');
        const sc = JSON.parse(localStorage.getItem('rp_scenarios')||'[]');
        
        if(lst) lst.innerHTML = ''; 

        let cH = `<div class="d-flex align-items-center mb-2 p-2 rounded surface-card border border-secondary"><div class="form-check form-switch mb-0"><input class="form-check-input mt-1" type="checkbox" role="switch" value="current" id="comp_current" checked><label class="form-check-label fw-medium ms-2" for="comp_current">Current Unsaved Plan</label></div></div>`;
        
        if (sc.length === 0) {
            if(lst) lst.innerHTML = `<li class="list-group-item bg-transparent text-muted small border-0 py-4 text-center">No saved plans found in local storage.</li>`;
        } else {
            sc.forEach((s, idx) => {
                if(lst) {
                    lst.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent border-secondary mb-2 rounded-3">${s.name}<div><button class="btn btn-sm btn-outline-success me-2" onclick="app.loadScenario(${idx})" title="Load"><i class="bi bi-arrow-clockwise"></i> Load</button><button class="btn btn-sm btn-outline-info me-2" onclick="app.exportScenario(${idx})" title="Export"><i class="bi bi-download"></i></button><button class="btn btn-sm btn-outline-danger" onclick="app.deleteScenario(${idx})"><i class="bi bi-trash"></i></button></div></li>`;
                }
                cH += `<div class="d-flex align-items-center mb-2 p-2 rounded surface-card border border-secondary"><div class="form-check form-switch mb-0"><input class="form-check-input mt-1" type="checkbox" role="switch" value="${idx}" id="comp_${idx}"><label class="form-check-label fw-medium ms-2" for="comp_${idx}">${s.name}</label></div></div>`;
            });
        }
        if(cmp) cmp.innerHTML = cH;
        this.ui.renderComparisonChart();
    }

    loadStateToDOM(d) {
        if(!d) return;

        this.state.inputs = {...(d.inputs||{})}; 
        
        this.state.strategies = {
            accum: d.strategies?.accum || ['tfsa', 'fhsa', 'resp', 'rrsp', 'nreg', 'cash', 'crypto', 'rrif_acct'],
            decum: d.strategies?.decum || ['rrif_acct', 'lif', 'rrsp', 'lirf', 'crypto', 'nreg', 'tfsa', 'fhsa', 'resp', 'cash']
        };

        const allItems = ['tfsa', 'fhsa', 'resp', 'rrsp', 'rrif_acct', 'lif', 'lirf', 'nreg', 'cash', 'crypto'];
        
        // Force remove lif and lirf if they exist in a loaded save file
        this.state.strategies.accum = this.state.strategies.accum.filter(x => x !== 'lif' && x !== 'lirf');

        allItems.forEach(item => {
            // Prevent lif and lirf from being pushed back into the array
            if (!['lif', 'lirf'].includes(item) && !this.state.strategies.accum.includes(item)) {
                this.state.strategies.accum.push(item);
            }
            if (!this.state.strategies.decum.includes(item)) this.state.strategies.decum.push(item);
        });

        Object.entries(this.state.inputs).forEach(([id, val]) => { if(id.startsWith('comp_')) return; const el=document.getElementById(id); if(el) el.type==='checkbox'||el.type==='radio'?el.checked=val:el.value=val; });
        ['p1_retireAge','p2_retireAge','inflation_rate'].forEach(k => { if(this.state.inputs[k]) this.ui.updateSidebarSync(k, this.state.inputs[k]); });
        if(this.state.inputs['p1_tfsa_ret']) this.ui.updateSidebarSync('p1_tfsa_ret', this.state.inputs['p1_tfsa_ret']);
        
        const assetAdvM = document.getElementById('asset_mode_advanced')?.checked;
        if(document.getElementById('asset_mode_advanced')) {
            document.querySelectorAll('.asset-bal-col').forEach(el => el.className = assetAdvM ? 'col-3 asset-bal-col' : 'col-5 asset-bal-col');
            document.querySelectorAll('.asset-ret-col').forEach(el => el.className = assetAdvM ? 'col-3 asset-ret-col' : 'col-4 asset-ret-col');
            document.querySelectorAll('.adv-asset-col').forEach(el => el.style.display = assetAdvM ? 'block' : 'none');
            document.querySelectorAll('.lbl-ret').forEach(el => el.innerText = assetAdvM ? 'Pre-Ret(%)' : 'Return (%)');
        }

        if(d.expensesData) { Object.keys(this.expensesByCategory).forEach(c => { if(!d.expensesData[c]) d.expensesData[c] = this.expensesByCategory[c]; }); this.expensesByCategory = d.expensesData; } this.data.renderExpenseRows();
        if(d.properties) { d.properties.forEach(p => { if(p.includeInNW === undefined) p.includeInNW = false; }); this.state.properties = d.properties; } this.data.renderProperties();
        this.state.windfalls = d.windfalls || []; this.data.renderWindfalls();
        this.state.additionalIncome = d.additionalIncome || []; this.data.renderAdditionalIncome();
        this.state.leaves = d.leaves || []; this.data.renderLeaves();
        this.state.dependents = d.dependents || []; this.data.renderDependents();
        
        // Load debts correctly using the new object format
        if (d.debt && d.debt.length > 0) {
            if (typeof d.debt[0] === 'string' || typeof d.debt[0] === 'number') {
                this.state.debt = d.debt.map(v => ({ name: "Legacy Debt", amount: Number(String(v).replace(/,/g,'')) || 0, start: new Date().toISOString().slice(0, 7) }));
            } else {
                this.state.debt = d.debt;
            }
        } else {
            this.state.debt = [];
        }
        this.data.renderDebts();

        this.ui.toggleModeDisplay(); this.data.renderStrategy();
        
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
        
        const setLim = (id, def) => {
            if(document.getElementById(id)) {
                let v = this.state.inputs[id] !== undefined ? this.getVal(id) : def;
                document.getElementById(id).value = v.toLocaleString();
            }
        };
        setLim('cfg_tfsa_limit', 7000);
        setLim('cfg_rrsp_limit', 32960);
        setLim('cfg_fhsa_limit', 8000);
        setLim('cfg_resp_limit', 2500);
        setLim('cfg_crypto_limit', 5000);

        this.ui.updateBenefitVisibility();
        this.updateStrategyVisuals();
    }
    
    getCurrentSnapshot() { 
        const s = { 
            version: this.APP_VERSION, inputs: {...this.state.inputs}, strategies: {...this.state.strategies}, 
            properties: structuredClone(this.state.properties || []), 
            expensesData: structuredClone(this.expensesByCategory || {}), 
            windfalls: structuredClone(this.state.windfalls || []), 
            additionalIncome: structuredClone(this.state.additionalIncome || []),
            leaves: structuredClone(this.state.leaves || []),
            dependents: structuredClone(this.state.dependents || []),
            debt: structuredClone(this.state.debt || []),
            nwTrajectory: (this.state.projectionData || []).map(d => Math.round(d.debugNW)),
            years: (this.state.projectionData || []).map(d => d.year)
        }; 
        return s; 
    }
}

window.app = new RetirementPlanner();
