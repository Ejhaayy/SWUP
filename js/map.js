// ==========================================
// CONFIGURATION
// ==========================================
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7s8oCNcvh_ybmg_I2N1iK51X-SSDmqdjnuNV8DwEttUBeY9RPw7Fy6M6vgRCCNH5vYpO88nhzGDPp/pub?gid=0&single=true&output=csv';

let sheetDataMap = {};
let selectedFeature = null;

// ==========================================
// MAP INITIALIZATION
// ==========================================
const updBounds = [[14.6380, 121.0520], [14.6680, 121.0780]];
const map = L.map('map', {
    zoomControl: false, 
    maxBounds: updBounds, 
    maxBoundsViscosity: 0.9,
    minZoom: 15
}).setView([14.6549, 121.0645], 16);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

map.createPane('greeneryPane');
map.getPane('greeneryPane').style.zIndex = 200;

// ==========================================
// STYLES
// ==========================================
const buildingStyle = { color: "#ffffff", weight: 1, opacity: 0.8, fillColor: "#cfcfcf", fillOpacity: 0.6 };
const buildingHighlightStyle = { color: "#7B1113", weight: 2, opacity: 1, fillColor: "#7B1113", fillOpacity: 0.7 };
const waterStyle = { color: "#4C8DBA", weight: 2, fillColor: "#4C8DBA", fillOpacity: 0.25 };
const greeneryStyle = { color: "#3E8F4C", weight: 1, fillColor: "#3E8F4C", fillOpacity: 0.35 };
const activitiesStyle = { color: "#FF8C2B", weight: 2, fillColor: "#FF8C2B", fillOpacity: 0.35 };

const ikotIcon = L.divIcon({
    className: 'ikot-marker',
    html: '<img src="data/ikot.png">',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

// ==========================================
// CORE FUNCTIONS
// ==========================================

async function loadSheetData() {
    try {
        const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        const text = await res.text();
        
        if (text.includes("<!DOCTYPE html")) {
            console.error("Access Error: Google Sheet is not Published to Web (CSV).");
            return;
        }

        const rows = text.split(/\r?\n/).slice(1);
        rows.forEach(row => {
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            const name = cols[0]?.replace(/^"|"$/g, '').trim();
            if (name) {
                sheetDataMap[name] = {
                    desc: cols[2]?.replace(/^"|"$/g, '').trim(),
                    tags: cols[3]?.replace(/^"|"$/g, '').trim().split(','),
                    image: cols[4]?.replace(/^"|"$/g, '').trim()
                };
            }
        });
        console.log("Spreadsheet Synced.");
    } catch (e) { console.error("Sheet Sync Failed", e); }
}

function clearSelection() {
    if (selectedFeature) {
        if (selectedFeature.type === 'building') {
            selectedFeature.layer.setStyle(buildingStyle);
        } else if (selectedFeature.originalStyle) {
            selectedFeature.layer.setStyle(selectedFeature.originalStyle);
        }
        selectedFeature = null;
    }
}

function updateInfoPanel(feature, typeLabelHtml) {
    const name = feature.properties.Name || 'Unnamed Location';
    const data = sheetDataMap[name];
    
    document.getElementById('bldg-name').textContent = name;
    document.getElementById('bldg-desc').textContent = data?.desc || "Campus location.";

    // IMAGE HANDLER (Direct Link Format)
    const imgEl = document.getElementById('bldg-img');
    const container = document.getElementById('bldg-img-container');
    
    if (data?.image && data.image.trim() !== "") {
        const id = data.image.trim();
        // Uses the Google UserContent proxy which bypasses most CORS/Embed restrictions
        imgEl.src = id.startsWith('http') ? id : `https://lh3.googleusercontent.com/d/${id}`;
        container.style.display = 'block';
        
        imgEl.onerror = () => { container.style.display = 'none'; };
    } else {
        container.style.display = 'none';
    }

    // TAG INJECTION
    let tags = [typeLabelHtml];
    if (data?.tags) {
        data.tags.forEach(t => {
            const clean = t.trim().toLowerCase();
            if (clean) tags.push(`<span class="tag tag-${clean}">${clean}</span>`);
        });
    }
    document.getElementById('bldg-tags').innerHTML = tags.join('');
    document.getElementById('info-panel').classList.add('active');
}

// ==========================================
// DATA LOADING
// ==========================================

async function loadSpatialData() {
    // 1. Roads
    fetch('./data/roads.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            style: (f) => ({
                color: f.properties.is_ikot ? "#FFD700" : (f.properties.type === "Walkway" ? "#39FF14" : "#FFFFFF"),
                weight: f.properties.is_ikot ? 4 : 2,
                dashArray: f.properties.type === "Walkway" ? "5, 6" : null,
                opacity: 0.6
            })
        }).addTo(map);
    });

    // 2. Ikot Stops
    fetch('./data/ikotstops.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: (f, l) => L.marker(l, { icon: ikotIcon }),
            onEachFeature: (f, l) => {
                l.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    clearSelection();
                    updateInfoPanel(f, '<span class="tag" style="background:#FFD700; color:#000;">🚙 Ikot Stop</span>');
                });
            }
        }).addTo(map);
    });

    // 3. Buildings
    fetch('./data/buildings.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            style: buildingStyle,
            onEachFeature: (f, l) => {
                l.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    clearSelection();
                    l.setStyle(buildingHighlightStyle);
                    selectedFeature = { layer: l, type: 'building' };
                    updateInfoPanel(f, '<span class="tag" style="background:#7B1113; color:white;">🏛️ Building</span>');
                });
            }
        }).addTo(map);
    });

    // 4. Polygons
    const layers = [
        { url: './data/water_polygons.geojson', style: waterStyle, label: '💧 Water', color: '#4C8DBA', type: 'water' },
        { url: './data/greenery.geojson', style: greeneryStyle, label: '🌿 Greenery', color: '#3E8F4C', type: 'greenery', pane: 'greeneryPane' },
        { url: './data/activities.geojson', style: activitiesStyle, label: '🏟️ Activity', color: '#FF8C2B', type: 'activity' }
    ];

    layers.forEach(cfg => {
        fetch(cfg.url).then(r => r.json()).then(data => {
            L.geoJSON(data, {
                style: cfg.style,
                pane: cfg.pane || 'overlayPane',
                onEachFeature: (f, l) => {
                    l.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        clearSelection();
                        l.setStyle({ weight: 3, color: '#fff' });
                        selectedFeature = { layer: l, type: cfg.type, originalStyle: cfg.style };
                        updateInfoPanel(f, `<span class="tag" style="background:${cfg.color}; color:white;">${cfg.label}</span>`);
                    });
                }
            }).addTo(map);
        });
    });
}

// ==========================================
// INIT & EVENT LISTENERS
// ==========================================
async function init() {
    await loadSheetData();
    loadSpatialData();
}

init();

document.getElementById('close-btn').onclick = () => {
    clearSelection();
    document.getElementById('info-panel').classList.remove('active');
};

map.on('click', () => {
    clearSelection();
    document.getElementById('info-panel').classList.remove('active');
});
