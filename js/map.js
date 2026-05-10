// ==========================================
// CONFIGURATION & STYLES
// ==========================================
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7s8oCNcvh_ybmg_I2N1iK51X-SSDmqdjnuNV8DwEttUBeY9RPw7Fy6M6vgRCCNH5vYpO88nhzGDPp/pub?gid=0&single=true&output=csv';

let sheetDataMap = {};
let selectedFeature = null;

const layersControl = {
    buildings: L.layerGroup(),
    ikot: L.layerGroup(),
    food: L.layerGroup(),
    water: L.layerGroup(),
    library: L.layerGroup()
};

// Base Styles
const buildingStyle = { color: "#ffffff", weight: 1, opacity: 0.8, fillColor: "#cfcfcf", fillOpacity: 0.6 };
const waterStyle = { color: "#4C8DBA", weight: 2, fillColor: "#4C8DBA", fillOpacity: 0.25 };
const greeneryStyle = { color: "#3E8F4C", weight: 1, fillColor: "#3E8F4C", fillOpacity: 0.35 };
const activitiesStyle = { color: "#FF8C2B", weight: 2, fillColor: "#FF8C2B", fillOpacity: 0.35 };

const map = L.map('map', { 
    zoomControl: false, 
    maxBounds: [[14.6380, 121.0520], [14.6680, 121.0780]], 
    minZoom: 15 
}).setView([14.6549, 121.0645], 16);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

map.createPane('greeneryPane');
map.getPane('greeneryPane').style.zIndex = 200;

// Icons
const ikotIcon = L.divIcon({ className: 'ikot-marker', html: '<img src="data/ikot.png">', iconSize: [28, 28], iconAnchor: [14, 14] });
const foodIcon = L.divIcon({ className: 'amenity-marker food', html: '🍴', iconSize: [24, 24], iconAnchor: [12, 12] });
const waterIcon = L.divIcon({ className: 'amenity-marker water', html: '💧', iconSize: [24, 24], iconAnchor: [12, 12] });
const libMarkerIcon = L.divIcon({ className: 'amenity-marker library', html: '📚', iconSize: [24, 24], iconAnchor: [12, 12] });

// ==========================================
// CORE FUNCTIONS
// ==========================================

function clearSelection() {
    if (selectedFeature) {
        selectedFeature.layer.setStyle(selectedFeature.originalStyle);
        selectedFeature = null;
    }
}

// THE DEFINITIVE IMAGE PROXY FIX
function getImgUrl(id) {
    if (!id || id === "") return '';
    const cleanId = id.trim();
    return cleanId.startsWith('http') ? cleanId : `https://lh3.googleusercontent.com/d/${cleanId}`;
}

function updateInfoPanel(feature, typeLabelHtml, layer, originalStyle, themeColor) {
    clearSelection();
    
    selectedFeature = { layer: layer, originalStyle: originalStyle };
    if(layer.setStyle) {
        layer.setStyle({
            color: themeColor, weight: 3, opacity: 1,
            fillColor: themeColor, fillOpacity: 0.7
        });
    }

    const name = feature.properties.Name || 'Unnamed';
    const data = sheetDataMap[name];
    document.getElementById('bldg-name').textContent = name;
    
    // Main Building Image
    const bImg = document.getElementById('bldg-img');
    const bContainer = document.getElementById('bldg-img-container');
    if (data?.image && data.image.trim() !== "") {
        bImg.src = getImgUrl(data.image);
        bContainer.style.display = 'block';
        bImg.onerror = () => { bContainer.style.display = 'none'; };
    } else { 
        bContainer.style.display = 'none'; 
    }

    // Tags
    let tagsHtml = [typeLabelHtml];
    if (data) {
        if (data.tags) data.tags.forEach(t => { if(t.trim()) tagsHtml.push(`<span class="tag">${t.trim()}</span>`)});
        if (data.foodName) tagsHtml.push(`<span class="tag" style="background:#FF8C2B; color:white;">🍱 Food</span>`);
        if (data.water && data.water.toLowerCase() !== "no") tagsHtml.push(`<span class="tag" style="background:#4C8DBA; color:white;">💧 Water</span>`);
        if (data.libName) tagsHtml.push(`<span class="tag" style="background:#7B1113; color:white;">📚 Library</span>`);
    }
    document.getElementById('bldg-tags').innerHTML = tagsHtml.join('');

    // Food Section
    const fSect = document.getElementById('food-section');
    if (data?.foodName) {
        fSect.style.display = 'block';
        document.getElementById('food-info').innerHTML = `<strong>${data.foodName}</strong><br>${data.price || ''}<br>${data.foodDetails || ''}`;
        document.getElementById('food-img').src = getImgUrl(data.foodImg);
    } else { fSect.style.display = 'none'; }

    // Library Section
    const lSect = document.getElementById('lib-section');
    if (data?.libName) {
        lSect.style.display = 'block';
        document.getElementById('lib-info').innerHTML = `<strong>${data.libName}</strong><br>${data.libDetails || ''}`;
        document.getElementById('lib-img').src = getImgUrl(data.libImg);
    } else { lSect.style.display = 'none'; }

    document.getElementById('bldg-desc').textContent = data?.desc || "Campus location.";
    document.getElementById('info-panel').classList.add('active');
}

// ==========================================
// DATA LOADING
// ==========================================

async function loadSpatialData() {
    fetch('./data/roads.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, { style: (f) => ({ color: f.properties.is_ikot ? "#FFD700" : "#FFFFFF", weight: 2, opacity: 0.4 })}).addTo(map);
        L.geoJSON(data, { filter: (f) => f.properties.is_ikot === 1, style: { color: "#FFD700", weight: 6, opacity: 0.3 }}).addTo(map);
        L.geoJSON(data, { filter: (f) => f.properties.is_ikot === 1, style: { color: "#FFD700", weight: 6, opacity: 0.3 }}).addTo(layersControl.ikot);
    });

    fetch('./data/water_lines.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, { style: { color: "#4C8DBA", weight: 3, opacity: 0.8 } }).addTo(map);
    });

    fetch('./data/ikotstops.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: (f, l) => L.marker(l, { icon: ikotIcon }),
            onEachFeature: (f, l) => l.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                updateInfoPanel(f, '<span class="tag" style="background:#FFD700; color:#000;">🚙 Ikot Stop</span>', l, {}, "#FFD700");
            })
        }).addTo(layersControl.ikot);
    });

    const polyConfigs = [
        { url: './data/buildings.geojson', style: buildingStyle, label: '🏛️ Building', theme: '#7B1113', group: layersControl.buildings },
        { url: './data/water_polygons.geojson', style: waterStyle, label: '💧 Water', theme: '#4C8DBA', group: null },
        { url: './data/greenery.geojson', style: greeneryStyle, label: '🌿 Greenery', theme: '#3E8F4C', group: null, pane: 'greeneryPane' },
        { url: './data/activities.geojson', style: activitiesStyle, label: '🏟️ Activity', theme: '#FF8C2B', group: null }
    ];

    polyConfigs.forEach(cfg => {
        fetch(cfg.url).then(r => r.json()).then(data => {
            const layerGroup = L.geoJSON(data, {
                style: cfg.style,
                pane: cfg.pane || 'overlayPane',
                onEachFeature: (f, l) => {
                    const s = sheetDataMap[f.properties.Name];
                    if (s) {
                        const center = l.getBounds().getCenter();
                        const hasFood = !!s.foodName;
                        const hasWater = s.water && s.water.toLowerCase() !== "no";
                        const hasLib = !!s.libName;

                        if (hasFood && hasWater && hasLib) {
                            L.marker([center.lat + 0.00006, center.lng], { icon: foodIcon }).addTo(layersControl.food);
                            L.marker([center.lat - 0.00007, center.lng - 0.00007], { icon: waterIcon }).addTo(layersControl.water);
                            L.marker([center.lat - 0.00007, center.lng + 0.00007], { icon: libMarkerIcon }).addTo(layersControl.library);
                        } else if (hasFood && hasWater) {
                            L.marker([center.lat, center.lng + 0.00007], { icon: foodIcon }).addTo(layersControl.food);
                            L.marker([center.lat, center.lng - 0.00007], { icon: waterIcon }).addTo(layersControl.water);
                        } else if (hasFood && hasLib) {
                            L.marker([center.lat, center.lng + 0.00007], { icon: foodIcon }).addTo(layersControl.food);
                            L.marker([center.lat, center.lng - 0.00007], { icon: libMarkerIcon }).addTo(layersControl.library);
                        } else if (hasWater && hasLib) {
                            L.marker([center.lat, center.lng + 0.00007], { icon: waterIcon }).addTo(layersControl.water);
                            L.marker([center.lat, center.lng - 0.00007], { icon: libMarkerIcon }).addTo(layersControl.library);
                        } else {
                            if (hasFood) L.marker(center, { icon: foodIcon }).addTo(layersControl.food);
                            if (hasWater) L.marker(center, { icon: waterIcon }).addTo(layersControl.water);
                            if (hasLib) L.marker(center, { icon: libMarkerIcon }).addTo(layersControl.library);
                        }
                    }
                    l.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        updateInfoPanel(f, `<span class="tag" style="background:${cfg.theme}; color:white;">${cfg.label}</span>`, l, cfg.style, cfg.theme);
                    });
                }
            });
            if (cfg.group) layerGroup.addTo(cfg.group);
            else layerGroup.addTo(map);
        });
    });

    layersControl.buildings.addTo(map);
    layersControl.food.addTo(map);
    layersControl.water.addTo(map);
    layersControl.library.addTo(map);
}

// ==========================================
// INTERFACE
// ==========================================
const toggles = { 'check-ikot': layersControl.ikot, 'check-food': layersControl.food, 'check-water': layersControl.water };
Object.keys(toggles).forEach(id => {
    const el = document.getElementById(id);
    if(el) el.onchange = function() { this.checked ? map.addLayer(toggles[id]) : map.removeLayer(toggles[id]); };
});

document.getElementById('menu-toggle').onclick = () => document.getElementById('filter-menu').classList.toggle('expanded');
document.getElementById('close-btn').onclick = () => { clearSelection(); document.getElementById('info-panel').classList.remove('active'); };
map.on('click', () => { clearSelection(); document.getElementById('info-panel').classList.remove('active'); });

async function init() {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    const text = await res.text();
    const rows = text.split(/\r?\n/).slice(1);
    rows.forEach(row => {
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const name = cols[0]?.replace(/^"|"$/g, '').trim();
        if (name) {
            sheetDataMap[name] = {
                desc: cols[2]?.replace(/^"|"$/g, '').trim(),
                tags: cols[3]?.replace(/^"|"$/g, '').trim().split(','),
                image: cols[4]?.replace(/^"|"$/g, '').trim(),
                foodName: cols[5]?.replace(/^"|"$/g, '').trim(),
                foodImg: cols[6]?.replace(/^"|"$/g, '').trim(),
                price: cols[7]?.replace(/^"|"$/g, '').trim(),
                water: cols[8]?.replace(/^"|"$/g, '').trim(),
                foodDetails: cols[9]?.replace(/^"|"$/g, '').trim(),
                libName: cols[10]?.replace(/^"|"$/g, '').trim(),
                libImg: cols[11]?.replace(/^"|"$/g, '').trim(),
                libDetails: cols[12]?.replace(/^"|"$/g, '').trim()
            };
        }
    });
    loadSpatialData();
}

init();
