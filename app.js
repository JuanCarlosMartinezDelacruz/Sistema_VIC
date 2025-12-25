// ==========================================
// VARIABLES GLOBALES
// ==========================================
let allDataGlobal = [];
let filteredDataGlobal = [];
let electricityRate = 0.595; // Precio fijo
let powerChart = null;
let sensorChart = null;

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
    
    // Recargar datos frescos cada 30 segundos
    setInterval(loadEnergyData, 30000);
}

// ==========================================
// CORRECCIÓN EN APP.JS
// ==========================================
// ==========================================
// REEMPLAZAR ESTA FUNCIÓN EN APP.JS
// ==========================================
function parseDateSystem(dateStr) {
    if (!dateStr) return null;

    // Como data.js ya nos manda el formato "YYYY-MM-DDTHH:mm:ss",
    // el navegador lo entiende perfectamente sin trucos.
    let d = new Date(dateStr);

    // Validación extra por seguridad
    if (isNaN(d.getTime())) {
        console.error("Fecha inválida recibida:", dateStr);
        return null;
    }
    return d;
}

async function loadEnergyData() {
    try {
        const raw = await window.fetchMenuData(); // Llama a data.js (versión fresca)
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

        // Orden cronológico (Viejo -> Nuevo) para gráficas y cálculos
        allDataGlobal.sort((a, b) => a.dateObj - b.dateObj);

        applyFilters();

    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

// ==========================================
// 2. FILTROS
// ==========================================
function applyFilters() {
    const range = document.getElementById('time-range').value;
    const dFrom = document.getElementById('date-from').value;
    const dTo = document.getElementById('date-to').value;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filteredDataGlobal = allDataGlobal.filter(item => {
        const d = item.dateObj;
        
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

    updateUI();
}

// ==========================================
// 3. ACTUALIZACIÓN UI
// ==========================================
function updateUI() {
    calculateStats();
    updateCharts();
    
    // Invertir orden para la lista de tarjetas (Lo más nuevo ARRIBA)
    const recentFirst = [...filteredDataGlobal].reverse();
    renderCards(recentFirst);
}

// ==========================================
// MODIFICACIÓN EN calculateStats
// ==========================================
function calculateStats() {
    if (filteredDataGlobal.length === 0) {
        document.getElementById('current-power').textContent = "0 W";
        document.getElementById('total-energy').textContent = "0 kWh";
        document.getElementById('estimated-cost').textContent = "$0.00";
        document.getElementById('total-co2').textContent = "0 kg"; // Reset CO2
        return;
    }

    // A. Potencia Actual
    const last = filteredDataGlobal[filteredDataGlobal.length - 1];
    document.getElementById('current-power').textContent = `${last.valP.toFixed(2)} W`;

    // B. Energía Total (Integral)
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
    
    // --- NUEVO: CÁLCULO DE CO2 ---
    // Factor: 1 kWh ≈ 0.45 kg CO2
    const co2Emissions = totalKWh * 0.45;

    // Actualizar DOM
    document.getElementById('total-energy').textContent = `${totalKWh.toFixed(4)} kWh`;
    document.getElementById('estimated-cost').textContent = `$${cost.toFixed(2)}`;
    document.getElementById('total-co2').textContent = `${co2Emissions.toFixed(3)} kg`;

    // Calcular predicción basada en TODOS los datos históricos
    calculatePrediction(); 
}

// ==========================================
// NUEVA LÓGICA DE REGRESIÓN LINEAL Y PREDICCIÓN
// ==========================================
function calculatePrediction() {
    // Usamos allDataGlobal para tener el historial completo, no solo lo filtrado
    if (allDataGlobal.length < 10) {
        document.getElementById('cost-prediction').textContent = "Recopilando datos...";
        return;
    }

    // 1. Agrupar costos por semana
    const weeklyCosts = {}; 
    
    // Iteramos para calcular energía por bloques semanales
    for (let i = 1; i < allDataGlobal.length; i++) {
        const prev = allDataGlobal[i-1];
        const curr = allDataGlobal[i];
        
        // Identificar semana única (Año-Semana)
        const weekKey = getWeekKey(curr.dateObj);
        
        const msDiff = curr.dateObj - prev.dateObj;
        const hDiff = msDiff / (1000 * 60 * 60);

        if (hDiff > 0 && hDiff < 1) { // Filtro de ruido
            const avgW = (prev.valP + curr.valP) / 2;
            const kwh = (avgW / 1000) * hDiff;
            const cost = kwh * electricityRate;

            if (!weeklyCosts[weekKey]) weeklyCosts[weekKey] = 0;
            weeklyCosts[weekKey] += cost;
        }
    }

    // Convertir objeto a arrays para regresión (X = índice de semana, Y = costo)
    const weeks = Object.keys(weeklyCosts).sort(); // Ordenar cronológicamente
    const yValues = weeks.map(w => weeklyCosts[w]);
    const xValues = weeks.map((_, i) => i + 1); // 1, 2, 3...

    // Necesitamos al menos 2 puntos (2 semanas distintas) para una línea
    if (xValues.length < 2) {
        // Si no hay historial suficiente, proyectamos con el promedio actual
        const currentTotal = yValues.reduce((a,b)=>a+b, 0);
        document.getElementById('cost-prediction').textContent = `~ $${currentTotal.toFixed(2)} (Faltan datos)`;
        return;
    }

    // 2. Regresión Lineal: y = mx + b
    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, xi, i) => sum + xi * yValues[i], 0);
    const sumXX = xValues.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 3. Predecir siguiente semana (x = n + 1)
    const nextWeekIndex = n + 1;
    let predictedCost = (slope * nextWeekIndex) + intercept;

    // Evitar valores negativos en la predicción
    if (predictedCost < 0) predictedCost = 0;

    document.getElementById('cost-prediction').textContent = `$${predictedCost.toFixed(2)} MXN`;
}

// Helper: Obtener clave única de semana (ej: "2023-W48")
function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

// Renderizado de tarjetas CON EL ESTILO ORIGINAL
function renderCards(data) {
    const container = document.getElementById('energy-data-container');
    container.innerHTML = "";

    const show = data.slice(0, 50); // Límite para rendimiento

    if (show.length === 0) {
        container.innerHTML = '<p style="padding:20px;">No hay datos.</p>';
        return;
    }

    // Colores originales del CSS
    const colors = ["green", "orange", "red", "blue"];

    show.forEach((item, index) => {
        const color = colors[index % colors.length];

        const card = document.createElement('div');
        card.className = `card ${color}`; // Aplica clase de color original
        
        // Estructura HTML original para que coincida con tu CSS
        card.innerHTML = `
            <div class="card-header">
                <div class="date">${item.timestamp}</div>
            </div>
            <div class="card-body">
                <h2>${item.sensor}</h2>
                <div class="card-values">
                    <div class="value-container">
                        <div class="value-label">Voltaje</div>
                        <div class="value">${item.valV}V</div>
                    </div>
                    <div class="value-container">
                        <div class="value-label">Corriente</div>
                        <div class="value">${item.valI}A</div>
                    </div>
                    <div class="value-container">
                        <div class="value-label">Potencia</div>
                        <div class="value">${item.valP}W</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 4. GRÁFICAS
// ==========================================
function initializeCharts() {
    const ctx1 = document.getElementById('power-chart').getContext('2d');
    powerChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Potencia (W)',
                data: [],
                borderColor: '#01c3a8',
                backgroundColor: 'rgba(1, 195, 168, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });

    const ctx2 = document.getElementById('sensor-chart').getContext('2d');
    sensorChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['SCT013'],
            datasets: [{
                data: [100],
                backgroundColor: ['#01c3a8'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff' } }
            }
        }
    });
}

function updateCharts() {
    if (!powerChart) return;
    
    // Muestreo para evitar lentitud si hay miles de datos
    let chartData = filteredDataGlobal;
    if (chartData.length > 200) {
        const step = Math.ceil(chartData.length / 200);
        chartData = chartData.filter((_, i) => i % step === 0);
    }

    const labels = chartData.map(d => {
        return `${d.dateObj.getHours()}:${d.dateObj.getMinutes().toString().padStart(2,'0')}`;
    });
    const values = chartData.map(d => d.valP);

    powerChart.data.labels = labels;
    powerChart.data.datasets[0].data = values;
    powerChart.update();
}

// ==========================================
// 5. PDF PROFESIONAL "SISTEMA VIC"
// ==========================================

// NOTA: He modificado esta función para que acepte DATOS DIRECTOS (para el botón exportar)
// Si typeOrData es un Array, lo usa directamente. Si es un string ('today'), filtra como antes.
function generatePDF(typeOrData, customTitle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let reportData = [];
    let title = "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // NUEVO: Si recibimos DATOS (Array) directamente desde el botón Exportar
    if (Array.isArray(typeOrData)) {
        reportData = typeOrData;
        title = customTitle || "Reporte Personalizado";
    }
    // ORIGINAL: Si recibimos un string ('today', 'week', etc.)
    else {
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

    // Calcular totales para el reporte
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

    // --- DISEÑO ---
    // Header Azul
    doc.setFillColor(10, 25, 50); 
    doc.rect(0, 0, 210, 40, 'F');
    
    // Título
    doc.setTextColor(1, 195, 168); // Verde
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Sistema VIC", 15, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(title, 15, 30);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${now.toLocaleDateString()}`, 160, 20);
    doc.text(`Tarifa: $${electricityRate.toFixed(3)}`, 160, 26);

    // Caja Resumen
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

    // Tabla
    let y = 85;
    doc.setFillColor(24, 144, 255);
    doc.rect(15, 78, 180, 8, 'F');
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.text("FECHA / HORA", 18, 83);
    doc.text("VOLTAJE", 90, 83);
    doc.text("CORRIENTE", 120, 83);
    doc.text("POTENCIA", 150, 83);

    // Filas (Reciente primero)
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
            doc.text("VOLTAJE", 90, y-1);
            doc.text("CORRIENTE", 120, y-1);
            doc.text("POTENCIA", 150, y-1);
            y += 5;
            doc.setTextColor(0);
            doc.setFont("courier", "normal");
        }

        if (i % 2 === 0) {
            doc.setFillColor(245, 248, 255);
            doc.rect(15, y-4, 180, 6, 'F');
        }

        doc.text(row.timestamp, 18, y);
        doc.text(row.valV.toString(), 90, y);
        doc.text(row.valI.toString(), 120, y);
        doc.text(row.valP.toString(), 150, y);
        y += 6;
    });

    doc.save(`SistemaVIC_${title}.pdf`);
}

// ==========================================
// 6. EXPORTAR A EXCEL (NUEVO)
// ==========================================
function exportToExcel(data, title) {
    if (!data || data.length === 0) {
        alert("No hay datos para exportar");
        return;
    }
    
    // Preparar formato limpio
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

// ==========================================
// 7. EVENTOS (MODIFICADO para botones nuevos)
// ==========================================
function loadSettings() {
    const s = localStorage.getItem('vicRate');
    if (s) {
        electricityRate = parseFloat(s);
        document.getElementById('electricity-rate').value = electricityRate;
    }
}

function setupEventListeners() {
    // BOTÓN ACTUALIZAR: Recarga la página
    document.getElementById('refresh-btn').addEventListener('click', () => {
        location.reload();
    });

    // BOTÓN EXPORTAR: Abre Modal
    const modal = document.getElementById('export-modal');
    document.getElementById('export-btn').addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    // Cerrar modal
    document.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    // Clic fuera del modal para cerrar
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // BOTONES DENTRO DEL MODAL (Descarga lo que se ve en pantalla)
    document.getElementById('download-pdf-modal').addEventListener('click', () => {
        // Le pasamos filteredDataGlobal (lo que el usuario ve ahora mismo con filtros)
        generatePDF(filteredDataGlobal, "Vista_Exportada");
        modal.style.display = 'none';
    });

    document.getElementById('download-excel-modal').addEventListener('click', () => {
        exportToExcel(filteredDataGlobal, "Vista_Exportada");
        modal.style.display = 'none';
    });

    // --- EVENTOS ORIGINALES DE TU CÓDIGO ---
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

    // Reportes (Sección Reportes) - Siguen funcionando igual
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