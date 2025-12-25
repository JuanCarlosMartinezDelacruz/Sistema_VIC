// REEMPLAZA "tu-dominio.infinityfreeapp.com" por la URL real de tu cuenta
const API_URL = "https://sistemavic.free.nf/api.php";

async function fetchMenuData() {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (!res.ok) throw new Error("Error en servidor");
        const data = await res.json();
        return data.map(item => ({
            timestamp: item.timestamp,
            sensor: item.sensor,
            potencia: parseFloat(item.potencia),
            voltaje: parseFloat(item.voltaje),
            corriente: parseFloat(item.corriente)
        }));
    } catch (e) {
        console.error("Error cargando datos:", e);
        return [];
    }
}
window.fetchMenuData = fetchMenuData;