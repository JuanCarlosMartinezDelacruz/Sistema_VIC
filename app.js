// ==========================================
// VARIABLES GLOBALES
// ==========================================
let allDataGlobal = [];
let filteredDataGlobal = [];
let electricityRate = 0.595;
let powerChart = null;
let sensorChart = null;

// Sistema de colores dinámicos por sensor
const sensorColorMap = new Map();
const availableColors = [
    '#01c3a8', '#1890ff', '#ffb741', '#ff6b6b', '#8a2be2', 
    '#00bcd4', '#e91e63', '#8bc34a', '#ffc107', '#3f51b5'
];
let colorIndex = 0;

function getSensorColor(sensorName) {
    if (!sensorColorMap.has(sensorName)) {
        const color = availableColors[colorIndex % availableColors.length];
        sensorColorMap.set(sensorName, color);
        colorIndex++;
        console.log(`🎨 Asignando color ${color} a sensor ${sensorName}`);
    }
    return sensorColorMap.get(sensorName);
}

// ==========================================
// INICIO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

function initializeApp() {
    console.log("Iniciando Sistema VIC...");
    loadSettings();
    setupNavigation();
    setupEventListeners();
    initializeCharts();
    loadEnergyData();
    setInterval(loadEnergyData, 30000);
}

function parseDateSystem(dateStr) {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        console.error("Fecha inválida recibida:", dateStr);
        return null;
    }
    return d;
}

async function loadEnergyData() {
    try {
        const raw = await window.fetchMenuData();
        if (!raw || raw.length === 0) return;

        allDataGlobal = raw.map(item => {
            return {
                ...item,
                dateObj: parseDateSystem(item.timestamp),
                valP: parseFloat(item.potencia) || 0,
                valV: parseFloat(item.voltaje) || 0,
                valI: parseFloat(item.corriente) || 0,
                sensor: item.sensor || "SCT013"
            };
        }).filter(item => item.dateObj !== null);

        allDataGlobal.sort((a, b) => a.dateObj - b.dateObj);
        
        console.log(`✅ Cargados ${allDataGlobal.length} registros`);
        console.log(`📊 Sensores detectados:`, [...new Set(allDataGlobal.map(d => d.sensor))]);
        
        applyFilters();
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function applyFilters() {
    const range = document.getElementById('time-range').value;
    const sensorFilter = document.getElementById('sensor-filter').value;
    const dFrom = document.getElementById('date-from').value;
    const dTo = document.getElementById('date-to').value;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filteredDataGlobal = allDataGlobal.filter(item => {
        const d = item.dateObj;
        
        // Filtro por sensor
        if (sensorFilter !== 'all' && item.sensor !== sensorFilter) {
            return false;
        }
        
        // Filtro por tiempo
        if (range === 'today') {
            return d >= startOfToday;
        } else if (range === 'yesterday') {
            const yesterday = new Date(startOfToday);
            yesterday.setDate(yesterday.getDate() - 1);
            const endYesterday = new Date(startOfToday);
            return d >= yesterday && d < endYesterday;
        } else if (range === 'week') {
            const weekAgo = new Date(startOfToday);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return d >= weekAgo;
        } else if (range === 'month') {
            const monthAgo = new Date(startOfToday);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return d >= monthAgo;
        } else if (range === 'custom' && dFrom && dTo) {
            const fromD = new Date(dFrom);
            const toD = new Date(dTo);
            toD.setHours(23, 59, 59);
            return d >= fromD && d <= toD;
        }
        return true;
    });

    console.log(`🔍 Filtrados: ${filteredDataGlobal.length} registros`);
    updateSensorFilter();
    updateUI();
}

// Actualizar dinámicamente el filtro de sensores
function updateSensorFilter() {
    const sensors = new Set(allDataGlobal.map(d => d.sensor));
    const filterSelect = document.getElementById('sensor-filter');
    const currentValue = filterSelect.value;
    
    filterSelect.innerHTML = '<option value="all">Todos los sensores</option>';
    sensors.forEach(sensor => {
        const option = document.createElement('option');
        option.value = sensor;
        option.textContent = sensor;
        filterSelect.appendChild(option);
    });
    
    if (Array.from(sensors).includes(currentValue)) {
        filterSelect.value = currentValue;
    }
}

function updateUI() {
    calculateStats();
    updateCharts();
    const recentFirst = [...filteredDataGlobal].reverse();
    renderCards(recentFirst);
}

function calculateStats() {
    if (filteredDataGlobal.length === 0) {
        document.getElementById('current-power').textContent = "0 W";
        document.getElementById('total-energy').textContent = "0 kWh";
        document.getElementById('estimated-cost').textContent = "$0.00";
        document.getElementById('total-co2').textContent = "0 kg";
        return;
    }

    const last = filteredDataGlobal[filteredDataGlobal.length - 1];
    document.getElementById('current-power').textContent = `${last.valP.toFixed(2)} W`;

    let totalKWh = 0;
    for (let i = 1; i < filteredDataGlobal.length; i++) {
        const prev = filteredDataGlobal[i-1];
        const curr = filteredDataGlobal[i];
        const msDiff = curr.dateObj - prev.dateObj;
        const hDiff = msDiff / (1000 * 60 * 60);

        if (hDiff > 0 && hDiff < 1) {
            const avgW = (prev.valP + curr.valP) / 2;
            const avgKW = avgW / 1000;
            totalKWh += avgKW * hDiff;
        }
    }

    const cost = totalKWh * electricityRate;
    const co2Emissions = totalKWh * 0.45;

    document.getElementById('total-energy').textContent = `${totalKWh.toFixed(4)} kWh`;
    document.getElementById('estimated-cost').textContent = `$${cost.toFixed(2)}`;
    document.getElementById('total-co2').textContent = `${co2Emissions.toFixed(3)} kg`;

    calculatePrediction();
}

function calculatePrediction() {
    if (allDataGlobal.length < 10) {
        document.getElementById('cost-prediction').textContent = "Recopilando datos...";
        return;
    }

    const weeklyCosts = {};
    for (let i = 1; i < allDataGlobal.length; i++) {
        const prev = allDataGlobal[i-1];
        const curr = allDataGlobal[i];
        const weekKey = getWeekKey(curr.dateObj);
        const msDiff = curr.dateObj - prev.dateObj;
        const hDiff = msDiff / (1000 * 60 * 60);

        if (hDiff > 0 && hDiff < 1) {
            const avgW = (prev.valP + curr.valP) / 2;
            const kwh = (avgW / 1000) * hDiff;
            const cost = kwh * electricityRate;

            if (!weeklyCosts[weekKey]) weeklyCosts[weekKey] = 0;
            weeklyCosts[weekKey] += cost;
        }
    }

    const weeks = Object.keys(weeklyCosts).sort();
    const yValues = weeks.map(w => weeklyCosts[w]);
    const xValues = weeks.map((_, i) => i + 1);

    if (xValues.length < 2) {
        const currentTotal = yValues.reduce((a,b)=>a+b, 0);
        document.getElementById('cost-prediction').textContent = `~ $${currentTotal.toFixed(2)} (Faltan datos)`;
        return;
    }

    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, xi, i) => sum + xi * yValues[i], 0);
    const sumXX = xValues.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const nextWeekIndex = n + 1;
    let predictedCost = (slope * nextWeekIndex) + intercept;

    if (predictedCost < 0) predictedCost = 0;
    document.getElementById('cost-prediction').textContent = `$${predictedCost.toFixed(2)} MXN`;
}

function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

function renderCards(data) {
    const container = document.getElementById('energy-data-container');
    container.innerHTML = "";

    const show = data.slice(0, 50);
    if (show.length === 0) {
        container.innerHTML = '<p style="padding:20px;color:white;">No hay datos.</p>';
        return;
    }

    show.forEach((item) => {
        const color = getSensorColor(item.sensor);
        
        const card = document.createElement('div');
        card.className = 'card';
        card.style.background = `linear-gradient(135deg, ${color}40 0%, ${color}10 100%)`;
        card.style.border = `2px solid ${color}`;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="date">${item.timestamp}</div>
            </div>
            <div class="card-body">
                <h2 style="color: ${color};">${item.sensor}</h2>
                <div class="card-values">
                    <div class="value-container">
                        <div class="value-label">Voltaje</div>
                        <div class="value">${item.valV.toFixed(2)}V</div>
                    </div>
                    <div class="value-container">
                        <div class="value-label">Corriente</div>
                        <div class="value">${item.valI.toFixed(2)}A</div>
                    </div>
                    <div class="value-container">
                        <div class="value-label">Potencia</div>
                        <div class="value" style="color: ${color};">${item.valP.toFixed(2)}W</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    
    console.log(`🎨 Renderizadas ${show.length} tarjetas con colores por sensor`);
}

function initializeCharts() {
    const ctx1 = document.getElementById('power-chart').getContext('2d');
    powerChart = new Chart(ctx1, {
        type: 'line',
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { 
                mode: 'index', 
                intersect: false 
            },
            plugins: { 
                legend: { 
                    display: true, 
                    labels: { 
                        color: '#fff',
                        font: { size: 12 }
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#01c3a8',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} W`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'category',
                    ticks: { 
                        color: '#aaa',
                        maxRotation: 45,
                        minRotation: 0
                    }, 
                    grid: { color: 'rgba(255,255,255,0.1)' } 
                },
                y: { 
                    ticks: { 
                        color: '#aaa',
                        callback: function(value) {
                            return value.toFixed(0) + ' W';
                        }
                    }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { 
                        display: true, 
                        text: 'Potencia (W)', 
                        color: '#aaa' 
                    }
                }
            }
        }
    });

    const ctx2 = document.getElementById('sensor-chart').getContext('2d');
    sensorChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 3,
                borderColor: '#010525'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#fff', 
                        padding: 15, 
                        font: { size: 12 } 
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#01c3a8',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(2)} W (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateCharts() {
    if (!powerChart || filteredDataGlobal.length === 0) return;
    
    console.log("📊 Actualizando gráficas...");
    
    // Agrupar datos por sensor
    const sensorGroups = {};
    filteredDataGlobal.forEach(d => {
        if (!sensorGroups[d.sensor]) {
            sensorGroups[d.sensor] = [];
        }
        sensorGroups[d.sensor].push(d);
    });

    console.log("📊 Grupos de sensores:", Object.keys(sensorGroups));

    // Actualizar gráfica de líneas
    const datasets = Object.keys(sensorGroups).map(sensor => {
        const color = getSensorColor(sensor);
        let data = sensorGroups[sensor];
        
        // Decidir tamaño de puntos y muestreo según cantidad de datos
        let pointRadius = 3;
        let pointHoverRadius = 6;
        
        if (data.length > 100) {
            pointRadius = 2;
            pointHoverRadius = 5;
        }
        
        if (data.length > 500) {
            // Solo muestrear si hay MUCHOS datos
            const step = Math.ceil(data.length / 300);
            data = data.filter((_, i) => i % step === 0);
            pointRadius = 1.5;
        }

        // Crear puntos con timestamp completo
        const points = data.map(d => {
            const hours = d.dateObj.getHours().toString().padStart(2, '0');
            const minutes = d.dateObj.getMinutes().toString().padStart(2, '0');
            const seconds = d.dateObj.getSeconds().toString().padStart(2, '0');
            return {
                x: `${hours}:${minutes}:${seconds}`,
                y: d.valP
            };
        });

        return {
            label: sensor,
            data: points,
            borderColor: color,
            backgroundColor: color + '30',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: pointRadius,
            pointHoverRadius: pointHoverRadius,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: color,
            pointHoverBorderWidth: 2
        };
    });

    powerChart.data.datasets = datasets;
    powerChart.update('none');

    // Actualizar gráfica de dona
    const sensorTotals = {};
    filteredDataGlobal.forEach(d => {
        if (!sensorTotals[d.sensor]) {
            sensorTotals[d.sensor] = 0;
        }
        sensorTotals[d.sensor] += d.valP;
    });

    console.log("🍩 Totales por sensor:", sensorTotals);

    const sensorLabels = Object.keys(sensorTotals);
    const sensorValues = Object.values(sensorTotals);
    const sensorColors = sensorLabels.map(s => getSensorColor(s));

    sensorChart.data.labels = sensorLabels;
    sensorChart.data.datasets[0].data = sensorValues;
    sensorChart.data.datasets[0].backgroundColor = sensorColors;
    sensorChart.update('none');
    
    console.log("✅ Gráficas actualizadas");
}

function generatePDF(typeOrData, customTitle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let reportData = [];
    let title = "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (Array.isArray(typeOrData)) {
        reportData = typeOrData;
        title = customTitle || "Reporte Personalizado";
    } else {
        if (typeOrData === 'today') {
            reportData = allDataGlobal.filter(d => d.dateObj >= startOfToday);
            title = "Reporte Diario";
        } else if (typeOrData === 'week') {
            const weekAgo = new Date(startOfToday);
            weekAgo.setDate(weekAgo.getDate() - 7);
            reportData = allDataGlobal.filter(d => d.dateObj >= weekAgo);
            title = "Reporte Semanal";
        } else if (typeOrData === 'month') {
            const monthAgo = new Date(startOfToday);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            reportData = allDataGlobal.filter(d => d.dateObj >= monthAgo);
            title = "Reporte Mensual";
        } else {
            reportData = [...allDataGlobal];
            title = "Reporte Histórico";
        }
    }

    if(reportData.length === 0) {
        alert("No hay datos disponibles.");
        return;
    }

    let sumKWh = 0;
    let maxP = 0;
    for (let i = 1; i < reportData.length; i++) {
        let hDiff = (reportData[i].dateObj - reportData[i-1].dateObj) / 3600000;
        if(hDiff > 0 && hDiff < 1) {
            sumKWh += ((reportData[i].valP + reportData[i-1].valP)/2000) * hDiff;
        }
        if(reportData[i].valP > maxP) maxP = reportData[i].valP;
    }
    const totalCost = sumKWh * electricityRate;

    doc.setFillColor(10, 25, 50); 
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(1, 195, 168);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Sistema VIC", 15, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(title, 15, 30);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${now.toLocaleDateString()}`, 160, 20);
    doc.text(`Tarifa: $${electricityRate.toFixed(3)}`, 160, 26);

    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, 50, 180, 20, 3, 3, 'FD');
    
    doc.setTextColor(50);
    doc.setFontSize(11);
    doc.text("TOTAL CONSUMO", 20, 62);
    doc.text("COSTO TOTAL", 80, 62);
    doc.text("PICO MAXIMO", 145, 62);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 144, 255);
    doc.text(`${sumKWh.toFixed(4)} kWh`, 20, 57);
    doc.setTextColor(0, 150, 0);
    doc.text(`$${totalCost.toFixed(2)} MXN`, 80, 57);
    doc.setTextColor(200, 50, 50);
    doc.text(`${maxP.toFixed(2)} W`, 145, 57);

    let y = 85;
    doc.setFillColor(24, 144, 255);
    doc.rect(15, 78, 180, 8, 'F');
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.text("FECHA / HORA", 18, 83);
    doc.text("SENSOR", 70, 83);
    doc.text("VOLTAJE", 100, 83);
    doc.text("CORRIENTE", 130, 83);
    doc.text("POTENCIA", 165, 83);

    const tableData = [...reportData].reverse();
    doc.setTextColor(0);
    doc.setFont("courier", "normal");

    tableData.forEach((row, i) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
            doc.setFillColor(24, 144, 255);
            doc.rect(15, y-6, 180, 8, 'F');
            doc.setTextColor(255);
            doc.setFont("helvetica", "bold");
            doc.text("FECHA / HORA", 18, y-1);
            doc.text("SENSOR", 70, y-1);
            doc.text("VOLTAJE", 100, y-1);
            doc.text("CORRIENTE", 130, y-1);
            doc.text("POTENCIA", 165, y-1);
            y += 5;
            doc.setTextColor(0);
            doc.setFont("courier", "normal");
        }

        if (i % 2 === 0) {
            doc.setFillColor(245, 248, 255);
            doc.rect(15, y-4, 180, 6, 'F');
        }

        doc.text(row.timestamp, 18, y);
        doc.text(row.sensor, 70, y);
        doc.text(row.valV.toFixed(2), 100, y);
        doc.text(row.valI.toFixed(2), 130, y);
        doc.text(row.valP.toFixed(2), 165, y);
        y += 6;
    });

    doc.save(`SistemaVIC_${title}.pdf`);
}

function exportToExcel(data, title) {
    if (!data || data.length === 0) {
        alert("No hay datos para exportar");
        return;
    }
    
    const cleanData = data.map(i => ({
        "Fecha": i.timestamp,
        "Sensor": i.sensor,
        "Voltaje (V)": i.valV,
        "Corriente (A)": i.valI,
        "Potencia (W)": i.valP
    }));
    
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    
    XLSX.writeFile(wb, `SistemaVIC_${title}.xlsx`);
}

function loadSettings() {
    const s = localStorage.getItem('vicRate');
    if (s) {
        electricityRate = parseFloat(s);
        document.getElementById('electricity-rate').value = electricityRate;
    }
}

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => {
        location.reload();
    });

    const modal = document.getElementById('export-modal');
    document.getElementById('export-btn').addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    
    document.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    document.getElementById('download-pdf-modal').addEventListener('click', () => {
        generatePDF(filteredDataGlobal, "Vista_Exportada");
        modal.style.display = 'none';
    });

    document.getElementById('download-excel-modal').addEventListener('click', () => {
        exportToExcel(filteredDataGlobal, "Vista_Exportada");
        modal.style.display = 'none';
    });

    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    
    document.getElementById('time-range').addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        document.getElementById('custom-date-container').style.display = isCustom ? 'flex' : 'none';
    });

    document.getElementById('save-settings').addEventListener('click', () => {
        const val = document.getElementById('electricity-rate').value;
        electricityRate = parseFloat(val);
        localStorage.setItem('vicRate', electricityRate);
        alert("Tarifa guardada.");
        calculateStats();
    });

    document.getElementById('toggle-view').addEventListener('click', () => {
        const c = document.getElementById('energy-data-container');
        c.classList.toggle('cards-container');
    });

    document.querySelectorAll('.report-card').forEach(btn => {
        btn.addEventListener('click', () => {
            generatePDF(btn.getAttribute('data-report'));
        });
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(link.getAttribute('data-page') + '-page').classList.add('active');
        });
    });
}
