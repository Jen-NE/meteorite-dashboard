// Web Worker for precomputing chart datasets
self.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.cmd !== 'compute') return;
    const rows = msg.rows || [];
    const selectedCountry = msg.selectedCountry || null;

    const targetCountry = selectedCountry ? String(selectedCountry).trim().toUpperCase() : null;

    // Filter rows by country if a country is selected
    const filteredRows = targetCountry 
        ? rows.filter(r => {
            const code = r.country_code ? String(r.country_code).trim().toUpperCase() : '';
            return code === targetCountry;
          })
        : rows;

    const yearCounts = {};
    const classMasses = {}; // general_class -> [mass_kg]
    const classCountsRec = {}; 
    const generalCounts = {}; 
    const countryCounts = {};
    const scatterByClass = {};

    // Compute stats from filtered rows (country-specific if selected, otherwise global)
    for (let i = 0; i < filteredRows.length; i++) {
        const r = filteredRows[i];
        
        const year = Math.floor(r.year);
        yearCounts[year] = (yearCounts[year] || 0) + 1;

        const g = r.general_class || 'Unknown';
        const rec = r.recclass || 'Unknown';
        const mkg = Number(r.mass_kg) || 0;

        if (!classMasses[g]) classMasses[g] = [];
        if (Number.isFinite(mkg) && mkg > 0) classMasses[g].push(mkg);

        classCountsRec[rec] = (classCountsRec[rec] || 0) + 1;
        generalCounts[g] = (generalCounts[g] || 0) + 1;

        if (!scatterByClass[g]) scatterByClass[g] = [];
        if (Number.isFinite(mkg) && mkg > 0 && Number.isFinite(r.year)) {
            scatterByClass[g].push({ x: r.year, y: mkg });
        }
    }

    // Always compute countryCounts from ALL rows (not filtered) for Chart 6
    for (let i = 0; i < rows.length; i++) {
        const country = rows[i].country_code || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    }

    // Heavy Data Sampling for Violin Plot
    Object.keys(classMasses).forEach(key => {
        if (classMasses[key].length > 2000) {
            let arr = classMasses[key];
            let sampled = [];
            const step = Math.ceil(arr.length / 2000);
            for (let i = 0; i < arr.length; i += step) {
                sampled.push(arr[i]);
            }
            classMasses[key] = sampled;
        }
    });

    const years = Object.keys(yearCounts).map(y => parseInt(y)).sort((a,b)=>a-b);
    const cumulative = [];
    let csum = 0;
    for (let i=0;i<years.length;i++){ csum += yearCounts[years[i]]; cumulative.push({year: years[i], cumulative: csum}); }

    const topRec = Object.entries(classCountsRec).sort((a,b)=>b[1]-a[1]).slice(0,15);
    const topCountries = Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);

    // Compute classMap for sunburst chart (when country is selected)
    let classMap = null;
    if (targetCountry) {
        classMap = {};
        for (let i = 0; i < filteredRows.length; i++) {
            const r = filteredRows[i];
            const g = r.general_class || 'Unknown';
            const sub = r.recclass || 'Unknown';
            if (!classMap[g]) classMap[g] = {};
            classMap[g][sub] = (classMap[g][sub] || 0) + 1;
        }
    }

    self.postMessage({
        type: 'charts', 
        payload: {
            yearCounts,
            cumulative,
            classMasses,
            topRec,
            generalCounts,
            topCountries,
            scatterDatasets: scatterByClass,
            classMap,
            processedCountry: selectedCountry 
        }
    });
});