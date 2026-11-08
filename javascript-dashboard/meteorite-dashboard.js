// Meteorite Dashboard JavaScript
class MeteoriteDashboard {
    constructor() {
        this.data = null;
        this.filteredData = null;
        this.selectedCountry = null;
        this.map = null;
        this.markers = null;
        this.charts = {};
        this.classOptionsInitialized = false;
        this.worker = null;
        // Handle "two letter" country codes
        this.regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

        this.init();
    }

    async init() {
        try {
            this.showLoading(true);
            await this.loadData();
            this.populateClassOptions();
            
            // Initialize Worker
            try {
                this.worker = new Worker('meteorite-worker.js');
                this.worker.onmessage = (e) => {
                    if (e.data && e.data.type === 'charts') {
                        this.updateChartsFromPayload(e.data.payload);
                    }
                };
                this.worker.onerror = (e) => {
                    console.warn('Worker error:', e);
                    this.worker = null; // Disable worker on error
                };
            } catch (err) {
                console.warn('Web Worker not available:', err);
                this.worker = null;
            }

            this.setupEventListeners();
            this.initializeMap();
            this.initializeCharts();
            this.updateFilters();
            this.showLoading(false);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showLoading(false);
        }
    }

    async loadData() {
        return new Promise((resolve, reject) => {
            Papa.parse('Meteorite_Landings_Processed.csv', {
                download: true,
                header: true,
                dynamicTyping: true,
                complete: (results) => {
                    // Filter invalid coordinates and bad years
                    this.data = results.data.filter(row =>
                        row.reclat && row.reclong &&
                        row.reclat !== 0 && row.reclong !== 0 &&
                        row.year >= 860 && row.year <= 2020
                    );

                    // Pre-process: Kg, Country Code, and Name Normalization
                    this.data.forEach(row => {
                        row.mass_kg = row['mass (g)'] / 1000;
                        
                        // Clean Country Code
                        if (row.country_code) {
                            row.country_code = row.country_code.toString().trim().toUpperCase();
                        }

                    });

                    console.log(`Loaded ${this.data.length} meteorite records`);
                    resolve();
                },
                error: reject
            });
        });
    }

    setupEventListeners() {
        document.getElementById('year-min').addEventListener('input', () => this.updateYearRange());
        document.getElementById('year-max').addEventListener('input', () => this.updateYearRange());

        document.querySelectorAll('input[id^="mass-"]').forEach(el => {
            el.addEventListener('change', () => this.scheduleFilterUpdate());
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('reset-country').addEventListener('click', () => this.resetCountrySelection());
    }

    scheduleFilterUpdate(delay = 180) {
        if (this._filterTimer) clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => { this.updateFilters(); }, delay);
    }

    scheduleChartUpdate(delay = 120) {
        if (this._chartTimer) clearTimeout(this._chartTimer);
        this._chartTimer = setTimeout(() => { this.requestChartData(); }, delay);
    }

    requestChartData() {
        // Try to use the worker first
        if (this.worker) {
            try {
                // Pass ALL filtered data to worker along with selectedCountry
                // Worker will compute both global stats and country-specific stats
                this.worker.postMessage({ 
                    cmd: 'compute', 
                    rows: this.filteredData || [],
                    selectedCountry: this.selectedCountry
                });
                return;
            } catch (e) {
                console.warn('Worker messaging failed', e);
            }
        }
        // Fallback if worker fails or is null
        this.updateCharts();
    }

    // --- WORKER RESPONSE HANDLER ---
    updateChartsFromPayload(payload) {
        // Worker has computed all chart data correctly based on selectedCountry
        // Just render everything from the payload
        this.renderCommonCharts(payload);
        this.renderViolinPlot(payload.classMasses);
        this.renderChart6(payload.classMap, payload.topCountries, payload.processedCountry);
    }

    computeTimeSeriesPayload(rows) {
        const yearCounts = {};
        (rows || []).forEach(r => {
            const y = Math.floor(r.year);
            if (!Number.isFinite(y)) return;
            yearCounts[y] = (yearCounts[y] || 0) + 1;
        });
        const years = Object.keys(yearCounts).sort();
        const cumulative = [];
        let sum = 0;
        years.forEach(y => {
            sum += yearCounts[y];
            cumulative.push({ year: y, cumulative: sum });
        });
        return { yearCounts, cumulative };
    }

    // --- MAIN THREAD FALLBACK (Runs if Worker fails) ---
    updateCharts() { 
        console.log("Worker unavailable/failed. Running calculation on Main Thread.");
        
        const rows = this.selectedCountry ? 
            this.filteredData.filter(r => r.country_code === this.selectedCountry) : 
            this.filteredData;

        // 1. Compute Aggregates Locally
        const yearCounts = {};
        const classMasses = {};
        const countryCounts = {};
        const classCountsRec = {};
        const scatterDatasets = {};
        let classMap = null;

        if (this.selectedCountry) classMap = {};

        rows.forEach(r => {
            // Year
            const y = Math.floor(r.year);
            yearCounts[y] = (yearCounts[y] || 0) + 1;

            // Counts
            const g = r.general_class || 'Unknown';
            const rec = r.recclass || 'Unknown';
            const country = r.country_code || 'Unknown';
            
            countryCounts[country] = (countryCounts[country] || 0) + 1;
            classCountsRec[rec] = (classCountsRec[rec] || 0) + 1;

            // Mass (Violin) - filter out meteorites under 1 gram (0.001 kg)
            const mkg = r.mass_kg;
            if (mkg >= 0.001) {
                if (!classMasses[g]) classMasses[g] = [];
                classMasses[g].push(mkg);
            }

            // Scatter
            if (!scatterDatasets[g]) scatterDatasets[g] = [];
            if (mkg > 0 && r.year) scatterDatasets[g].push({x: r.year, y: mkg});

            // Class Map (Sunburst)
            if (this.selectedCountry) {
                if (!classMap[g]) classMap[g] = {};
                classMap[g][rec] = (classMap[g][rec] || 0) + 1;
            }
        });

        // 2. Prepare Cumulative
        const years = Object.keys(yearCounts).sort();
        const cumulative = [];
        let sum = 0;
        years.forEach(y => {
            sum += yearCounts[y];
            cumulative.push({year: y, cumulative: sum});
        });

        // 3. Prepare Top Lists
        const topRec = Object.entries(classCountsRec).sort((a,b)=>b[1]-a[1]).slice(0,15);
        const topCountries = Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);

        // 4. Sample Violin (Important for performance)
        Object.keys(classMasses).forEach(k => {
             if (classMasses[k].length > 1000) classMasses[k] = classMasses[k].slice(0, 1000);
        });

        // 5. Render
        const payload = { yearCounts, cumulative, topRec, scatterDatasets };
        this.renderCommonCharts(payload);
        this.renderViolinPlot(classMasses);
        this.renderChart6(classMap, topCountries, this.selectedCountry);
    }

    // --- SHARED RENDERING LOGIC ---

    renderCommonCharts(payload) {
        // Chart 1 (Year)
        const years1 = Object.keys(payload.yearCounts).sort();
        this.charts.chart1.data = {
            labels: years1,
            datasets: [{
                label: 'Meteorites',
                data: years1.map(y => payload.yearCounts[y]),
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        };
        this.charts.chart1.update();

        // Chart 2 (Cumulative)
        const years2 = payload.cumulative.map(d => d.year);
        this.charts.chart2.data = {
            labels: years2,
            datasets: [{
                label: 'Cumulative Count',
                data: payload.cumulative.map(d => d.cumulative),
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                fill: true,
                tension: 0.1
            }]
        };
        this.charts.chart2.update();

        // Chart 4 (Top Classes)
        const topClasses = payload.topRec;
        this.charts.chart4.data = {
            labels: topClasses.map(d => d[0]),
            datasets: [{
                label: 'Count',
                data: topClasses.map(d => d[1]),
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        };
        this.charts.chart4.update();

        // Chart 5 (Scatter)
        const datasets = [];
        Object.entries(payload.scatterDatasets).forEach(([cls, pts]) => {
             datasets.push({
                label: cls,
                data: pts,
                backgroundColor: this.getColorForClass(cls),
                borderColor: this.getColorForClass(cls, true),
                borderWidth: 1,
                pointRadius: 2
             });
        });
        this.charts.chart5.data = { datasets: datasets };
        this.charts.chart5.update();
    }

    renderChart6(classMap, topCountries, processedCountry) {
        const sunDiv = document.getElementById('chart6_sunburst');
        const canvas = document.getElementById('chart6');

        if (processedCountry && classMap) {
            // --- SUNBURST MODE ---
            if (canvas) canvas.style.display = 'none';
            if (sunDiv) sunDiv.style.display = 'block';

            const ids = [];
            const labels = [];
            const parents = [];
            const values = [];
            const colors = [];

            const countryName = this.getCountryName(processedCountry);
            const rootId = processedCountry; 
            let totalCount = 0;
            
            // Build Hierarchy with UNIQUE IDs
            Object.entries(classMap).forEach(([g, subs]) => {
                // g is the general class, e.g. "Iron"
                const gId = `${rootId}-${g}`;
                const classTotal = Object.values(subs).reduce((a, b) => a + b, 0);
                totalCount += classTotal;

                ids.push(gId);
                labels.push(g);
                parents.push(rootId);
                values.push(classTotal);
                colors.push(this.getColorForClass(g));


                Object.entries(subs).forEach(([sub, count]) => {
                    const subId = `${gId}-${sub}`;
                    ids.push(subId);
                    labels.push(sub);
                    parents.push(gId);
                    values.push(count);
                    // Shade within the parent class color so subclasses are related visually
                    colors.push(this.shadeColor(this.getColorForClass(g), this.hashToUnit(sub) * 0.35 - 0.10));
                });
            });

            // Add Root Node
            ids.unshift(rootId);
            labels.unshift(countryName);
            parents.unshift('');
            values.unshift(totalCount);
            colors.unshift('#808080');

            try {
                const trace = [{
                    type: 'sunburst',
                    ids: ids, // UNIQUE IDs prevent ambiguity
                    labels: labels, // Display names
                    parents: parents,
                    values: values,
                    branchvalues: 'total',
                    maxdepth: 3,
                    marker: { 
                        // Use explicit per-slice colors (Plotly will otherwise auto-assign a colorscale)
                        color: colors,
                        line: { color: 'rgba(255,255,255,0.8)', width: 1 }
                    },
                    // Prevent Plotly from mixing our explicit colors with its own palette logic
                    insidetextorientation: 'radial'
                }];
                const layout = { 
                    margin: { l: 0, r: 0, t: 30, b: 0 }, 
                    title: `Class Breakdown: ${countryName}`,
                    extendpiecolors: false
                };
                Plotly.newPlot('chart6_sunburst', trace, layout, {responsive: true});
            } catch (e) {
                console.error('Sunburst render error', e);
            }

        } else {
            // --- BAR CHART MODE (Global) ---
            if (sunDiv) sunDiv.style.display = 'none';
            if (canvas) canvas.style.display = 'block';

            if (topCountries) {
                this.charts.chart6.data = {
                    labels: topCountries.map(([code,]) => this.getCountryName(code)),
                    datasets: [{
                        label: 'Meteorites',
                        data: topCountries.map(([,count]) => count),
                        backgroundColor: '#3498db',
                        borderColor: '#2980b9',
                        borderWidth: 1
                    }]
                };
                this.charts.chart6.update();
            }
        }
    }

    renderViolinPlot(classMasses) {
        const entries = Object.entries(classMasses || {})
            .map(([k, v]) => ({ k, v }))
            .filter(e => Array.isArray(e.v) && e.v.length > 0);

        // Pick top 8 classes by sample size (more stable distributions)
        entries.sort((a, b) => b.v.length - a.v.length);
        const top = entries.slice(0, 8);

        // Render inside container
        const container = document.querySelector('#tab-3 .chart-container');
        const canvas = document.getElementById('chart3');
        if (canvas) canvas.style.display = 'none';

        let plotDiv = document.getElementById('chart3_plot');
        if (!plotDiv && container) {
            plotDiv = document.createElement('div');
            plotDiv.id = 'chart3_plot';
            plotDiv.style.width = '100%';
            plotDiv.style.height = '100%';
            container.appendChild(plotDiv);
        }

        if (!plotDiv) return;
        if (top.length === 0) {
            try { Plotly.purge('chart3_plot'); } catch (e) {}
            return;
        }

        // Smart sampling: keep extremes and use stratified sampling for the rest
        const smartSample = (arr, maxN = 1500) => {
            if (!arr || arr.length <= maxN) return arr;
            const sorted = [...arr].sort((a, b) => a - b);
            
            // Keep min/max and use uniform sampling for the rest
            const sampled = [sorted[0]];
            const step = (sorted.length - 1) / (maxN - 2);
            for (let i = 1; i < maxN - 1; i++) {
                sampled.push(sorted[Math.round(i * step)]);
            }
            sampled.push(sorted[sorted.length - 1]);
            return sampled;
        };

        const traces = top.map((item, idx) => {
            const rawData = item.v.filter(x => Number.isFinite(x) && x > 0);
            const y = smartSample(rawData);
            const base = this.getColorForClass(item.k);
            const border = this.getColorForClass(item.k, true);
            
            // Calculate statistics for better hover info
            const sorted = [...rawData].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const mean = rawData.reduce((a, b) => a + b, 0) / rawData.length;
            
            return {
                type: 'violin',
                name: `${item.k}<br><sub>n=${rawData.length.toLocaleString()}</sub>`,
                y,
                box: { 
                    visible: true,
                    fillcolor: this.hexToRgba(base, 0.4),
                    line: { color: border, width: 1.5 }
                },
                meanline: { 
                    visible: true,
                    color: border,
                    width: 2
                },
                quartilemethod: 'linear',
                points: rawData.length <= 500 ? 'all' : 'outliers',
                jitter: 0.3,
                pointpos: -0.5,
                marker: { 
                    size: 2.5, 
                    color: base, 
                    opacity: 0.4, 
                    line: { color: border, width: 0.3 } 
                },
                line: { color: border, width: 1.5 },
                fillcolor: this.hexToRgba(base, 0.3),
                spanmode: 'hard',
                bandwidth: rawData.length > 100 ? undefined : 0.5,
                hovertemplate: 
                    '<b>%{fullData.name}</b><br>' +
                    'Value: %{y:.3f} kg<br>' +
                    '<extra></extra>',
                hoveron: 'points+violins',
                scalemode: 'width',
                width: 0.8
            };
        });

        const layout = {
            margin: { l: 70, r: 30, t: 60, b: 80 },
            title: {
                text: 'Mass Distribution by Meteorite Class (Log Scale)',
                font: { size: 16, color: '#2c3e50' }
            },
            xaxis: { 
                title: { 
                    text: 'Meteorite Class', 
                    font: { size: 13 }
                },
                type: 'category',
                tickangle: -25,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: { 
                    text: 'Mass (kg)', 
                    font: { size: 13 }
                },
                type: 'log',
                gridcolor: 'rgba(0,0,0,0.1)',
                gridwidth: 1,
                zeroline: false
            },
            showlegend: false,
            violingap: 0.15,
            violinmode: 'group',
            plot_bgcolor: '#fafafa',
            paper_bgcolor: '#ffffff',
            hovermode: 'closest',
            font: { family: 'Arial, sans-serif' }
        };

        const config = { 
            responsive: true, 
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false
        };

        try {
            Plotly.newPlot('chart3_plot', traces, layout, config);
        } catch (e) {
            console.error('Violin plot error:', e);
        }
    }

    hexToRgba(hex, alpha = 1.0) {
        // Accepts #RGB or #RRGGBB
        if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
        let h = hex.trim();
        if (h[0] === '#') h = h.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    gaussianKDE(x, sample, bandwidth) {
        if (!sample || sample.length === 0) return 0;
        const bw = bandwidth || 1.0;
        const invSqrt2pi = 1 / Math.sqrt(2*Math.PI);
        let sum = 0;
        for (let i=0;i<sample.length;i++) {
            const u = (x - sample[i]) / bw;
            sum += Math.exp(-0.5*u*u) * invSqrt2pi;
        }
        return sum / (sample.length * bw);
    }

    getColorForClass(cls, border = false) {
        // Known categories (hand-picked)
        const fixed = {
            'Chondrite': border ? '#2980b9' : '#3498db',
            'Achondrite': border ? '#c0392b' : '#e74c3c',
            'Iron': border ? '#e67e22' : '#f39c12'
        };
        if (fixed[cls]) return fixed[cls];

        // Deterministic fallback palette so "Unknown" doesn't make everything grey
        const h = this.hashToUnit(String(cls || 'Unknown'));
        const hue = Math.round(h * 360);
        const sat = 62;
        const light = border ? 38 : 52;
        return `hsl(${hue} ${sat}% ${light}%)`;
    }

    // --- Color helpers (for sunburst shading) ---
    shadeColor(hex, amount = 0) {
        // amount in [-1, 1]; positive -> lighten, negative -> darken
        if (!hex || typeof hex !== 'string' || hex[0] !== '#') return hex;
        const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
        let h = hex.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length !== 6) return hex;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const t = amount >= 0 ? 255 : 0;
        const p = Math.abs(amount);
        const rr = Math.round((t - r) * p + r);
        const gg = Math.round((t - g) * p + g);
        const bb = Math.round((t - b) * p + b);
        const toHex = (x) => clamp(x, 0, 255).toString(16).padStart(2, '0');
        return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
    }

    hashToUnit(str) {
        // stable pseudo-random in [0,1)
        if (!str) return 0;
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        // >>> 0 forces unsigned
        return ((h >>> 0) % 100000) / 100000;
    }

    getCountryName(code) {
        if (!code) return 'Unknown';
        try {
            return this.regionNames.of(code.trim().toUpperCase());
        } catch (e) {
            return code;
        }
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'tab-3') Plotly.Plots.resize('chart3_plot');
        if (tabId === 'tab-6' && this.selectedCountry) Plotly.Plots.resize('chart6_sunburst');
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
    
    updateMap() {
        if (!this.markers) return;
        // A newer update cancels batches still pending from an older one
        const run = this._mapRun = (this._mapRun || 0) + 1;
        this.markers.clearLayers();
        const rows = this.filteredData || [];
        if (rows.length === 0) {
            this.updateVisibleCount();
            return;
        }

        const batchSize = 1000;
        let idx = 0;
        const addBatch = () => {
            if (run !== this._mapRun) return;
            const end = Math.min(idx + batchSize, rows.length);
            const layers = [];
            for (let i = idx; i < end; i++) {
                const row = rows[i];
                try {
                    const marker = L.marker([row.reclat, row.reclong]);
                    const countryName = this.getCountryName(row.country_code);
                    const popupContent = `<b>${row.name}</b><br>Country: ${countryName}<br>Mass: ${row.mass_kg.toFixed(3)}kg<br>Year: ${Math.floor(row.year)}<br>Class: ${row.recclass}`;
                    marker.bindPopup(popupContent);
                    marker.on('click', () => { this.selectCountry(row.country_code); });
                    layers.push(marker);
                } catch (e) { }
            }
            if (layers.length) this.markers.addLayers(layers);
            idx = end;
            this.updateVisibleCount();
            if (idx < rows.length) setTimeout(addBatch, 40);
        };
        addBatch();
    }
    
    updateVisibleCount() {
        try {
            const count = this.markers ? this.markers.getLayers().length : 0;
            const el = document.getElementById('visible-count');
            if (el) el.textContent = `Visible: ${count}`;
        } catch (e) {}
    }

    selectCountry(countryCode) {
        this.selectedCountry = countryCode;
        const name = this.getCountryName(countryCode);
        document.getElementById('selected-country-display').textContent = `Selected Country: ${name}`;
        document.getElementById('info-subtitle').textContent = `Showing data for ${name}`;
        this.requestChartData();
    }

    resetCountrySelection() {
        this.selectedCountry = null;
        document.getElementById('selected-country-display').textContent = 'Click on a meteorite to view country data';
        document.getElementById('info-subtitle').textContent = 'Showing global data';
        this.requestChartData();
    }

    populateClassOptions() {
        if (this.classOptionsInitialized) return;
        const classFilterDiv = document.getElementById('class-filter');
        if (!classFilterDiv) return;
        const classes = [...new Set(this.data.map(row => row.general_class))].filter(Boolean).sort();
        classes.forEach(cls => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.innerHTML = `<input type="checkbox" value="${cls}" checked> ${cls}`;
            classFilterDiv.appendChild(label);
        });
        classFilterDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => this.scheduleFilterUpdate());
        });
        this.classOptionsInitialized = true;
    }

    updateYearRange() {
        const minYear = parseInt(document.getElementById('year-min').value);
        const maxYear = parseInt(document.getElementById('year-max').value);
        if (minYear > maxYear) document.getElementById('year-min').value = maxYear;
        document.getElementById('year-range-display').textContent = `${document.getElementById('year-min').value} - ${document.getElementById('year-max').value}`;
        this.scheduleFilterUpdate();
    }

    updateFilters() {
        const minYear = parseInt(document.getElementById('year-min').value);
        const maxYear = parseInt(document.getElementById('year-max').value);
        const massClasses = [];
        document.querySelectorAll('input[id^="mass-"]:checked').forEach(cb => {
            massClasses.push(cb.value);
        });
        const selectedClasses = [];
        document.querySelectorAll('#class-filter input[type="checkbox"]:checked').forEach(cb => {
            selectedClasses.push(cb.value);
        });
        this.filteredData = this.data.filter(row => {
            if (row.year < minYear || row.year > maxYear) return false;
            if (selectedClasses.length > 0 && !selectedClasses.includes(row.general_class)) return false;
            if (massClasses.length === 0) return false;
            const mass = row['mass (g)'];
            // Bins (in grams) cover every mass exactly once
            return massClasses.some(cls => {
                switch (cls) {
                    case '<=100': return mass <= 100;
                    case '100-1000': return mass > 100 && mass < 1000;
                    case '1000-5000': return mass >= 1000 && mass < 5000;
                    case '5000-10000': return mass >= 5000 && mass < 10000;
                    case '10000-20000': return mass >= 10000 && mass < 20000;
                    case '20000<=': return mass >= 20000;
                    default: return false;
                }
            });
        });
        this.updateMap();
        this.requestChartData();
    }
    
    initializeMap() {
        this.map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
        this.markers = L.markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: 200,
            chunkDelay: 50
        });
        this.map.addLayer(this.markers);
    }
    
    initializeCharts() {
        const chartConfigs = [
            { id: 'chart1', type: 'bar', title: 'Meteorite Landings by Year' },
            { id: 'chart2', type: 'line', title: 'Cumulative Meteorite Discoveries' },
            { id: 'chart3', type: 'bar', title: 'Mass Distribution by Class' },
            { id: 'chart4', type: 'bar', title: 'Top Meteorite Classes', indexAxis: 'y' },
            { id: 'chart5', type: 'scatter', title: 'Mass vs Discovery Year' },
            { id: 'chart6', type: 'bar', title: 'Geographic Distribution' }
        ];
        chartConfigs.forEach(config => {
            const ctx = document.getElementById(config.id).getContext('2d');
            const options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: config.title },
                    legend: { display: config.type === 'scatter' }
                },
                scales: {}
            };
            if (config.id === 'chart4' && config.indexAxis === 'y') {
                options.indexAxis = 'y';
                options.scales = { x: { beginAtZero: true }, y: { ticks: { autoSkip: false } } };
            } else if (config.type === 'scatter') {
                options.scales = {
                    x: { title: { display: true, text: 'Year' } },
                    y: { title: { display: true, text: 'Mass (kg)' }, type: 'logarithmic' }
                };
            }
            this.charts[config.id] = new Chart(ctx, {
                type: config.type,
                data: { labels: [], datasets: [] },
                options: options
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MeteoriteDashboard();
});