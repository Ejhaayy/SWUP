// ==========================================
// UI EVENT LISTENERS (Information Panel)
// ==========================================
const infoPanel = document.getElementById('info-panel');
const closeBtn = document.getElementById('close-btn');
const bldgName = document.getElementById('bldg-name');
const bldgDesc = document.getElementById('bldg-desc');
const bldgTags = document.getElementById('bldg-tags');
const appHeaderTitle = document.querySelector('#app-header h1');
const defaultHeaderTitle = appHeaderTitle.textContent;

// ==========================================
// MAP INITIALIZATION
// ==========================================

// Coordinates center on the UP Diliman Academic Oval
const updBounds = [
    [14.6380, 121.0520], // Southwest 
    [14.6680, 121.0780]  // Northeast
];

// Initialize the map locked to the campus boundaries
const map = L.map('map', {
    zoomControl: false, 
    maxBounds: updBounds,     
    maxBoundsViscosity: 0.9,   
    minZoom: 15,
    maxZoom: 20
}).setView([14.6549, 121.0645], 16);

// Add a sleek, dark mode basemap (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Move zoom controls to bottom-right for easier thumb reach on mobile
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// ==========================================
// PANES (Z-INDEX CONTROL)
// ==========================================
map.createPane('greeneryPane');
map.getPane('greeneryPane').style.zIndex = 200;

// ==========================================
// DATA LAYERS & FETCH LOGIC
// ==========================================

// Create empty Layer Groups
const roadsLayer = L.layerGroup().addTo(map);
const stopsLayer = L.layerGroup().addTo(map);
const buildingsLayer = L.layerGroup().addTo(map);
const waterLinesLayer = L.layerGroup().addTo(map);
const waterPolygonsLayer = L.layerGroup().addTo(map);
const greeneryLayer = L.layerGroup().addTo(map);
const activitiesLayer = L.layerGroup().addTo(map);

// GeoJSON references (for tag-based highlighting)
let stopsGeo = null;
let buildingsGeo = null;
let waterPolygonsGeo = null;
let greeneryGeo = null;
let activitiesGeo = null;

// Styles
const buildingStyle = {
    color: "#ffffff",
    weight: 1,
    opacity: 0.8,
    fillColor: "#cfcfcf",
    fillOpacity: 0.6
};

const buildingHighlightStyle = {
    color: "#7B1113",
    weight: 2,
    opacity: 1,
    fillColor: "#7B1113",
    fillOpacity: 0.7
};

const waterStyle = {
    color: "#4C8DBA",
    weight: 2,
    opacity: 0.55,
    fillColor: "#4C8DBA",
    fillOpacity: 0.25
};

const waterHighlightStyle = {
    color: "#8FC7E8",
    weight: 3,
    opacity: 0.9,
    fillColor: "#4C8DBA",
    fillOpacity: 0.3
};

const greeneryStyle = {
    color: "#3E8F4C",
    weight: 1,
    opacity: 0.6,
    fillColor: "#3E8F4C",
    fillOpacity: 0.35
};

const greeneryHighlightStyle = {
    color: "#6CCB7A",
    weight: 3,
    opacity: 0.9,
    fillColor: "#3E8F4C",
    fillOpacity: 0.4
};

const activitiesStyle = {
    color: "#FF8C2B",
    weight: 2,
    opacity: 0.7,
    fillColor: "#FF8C2B",
    fillOpacity: 0.35
};

const activitiesHighlightStyle = {
    color: "#FFC285",
    weight: 3,
    opacity: 0.95,
    fillColor: "#FF8C2B",
    fillOpacity: 0.4
};

const tagLabels = {
    building: "Buildings",
    dormitory: "Dormitory",
    water: "Water",
    greenery: "Greenery",
    activity: "Activities",
    stop: "Ikot Stops"
};

let selectedFeature = null;
let highlightedGroup = null;

function setHeaderTitle(title) {
    appHeaderTitle.textContent = title;
}

function resetHeaderTitle() {
    appHeaderTitle.textContent = defaultHeaderTitle;
}

function clearSelection() {
    if (!selectedFeature) return;

    const { layer, type } = selectedFeature;

    if (type === 'building') layer.setStyle(buildingStyle);
    if (type === 'water') layer.setStyle(waterStyle);
    if (type === 'greenery') layer.setStyle(greeneryStyle);
    if (type === 'activity') layer.setStyle(activitiesStyle);

    selectedFeature = null;
}

function clearGroupHighlights() {
    if (!highlightedGroup) return;

    const { type, layers } = highlightedGroup;

    if (type === 'building') {
        layers.forEach(layer => layer.setStyle(buildingStyle));
    }
    if (type === 'water') {
        layers.forEach(layer => layer.setStyle(waterStyle));
    }
    if (type === 'greenery') {
        layers.forEach(layer => layer.setStyle(greeneryStyle));
    }
    if (type === 'activity') {
        layers.forEach(layer => layer.setStyle(activitiesStyle));
    }
    if (type === 'stop') {
        layers.forEach(layer => {
            layer.setZIndexOffset(0);
            const el = layer.getElement();
            if (el) el.style.filter = '';
        });
    }

    highlightedGroup = null;
    resetHeaderTitle();
}

function clearAllHighlights() {
    clearSelection();
    clearGroupHighlights();
}

function highlightBuildings(filterFn) {
    const layers = [];
    if (!buildingsGeo) return layers;

    buildingsGeo.eachLayer(layer => {
        const isMatch = filterFn ? filterFn(layer.feature) : true;
        if (isMatch) {
            layer.setStyle(buildingHighlightStyle);
            layers.push(layer);
        }
    });

    return layers;
}

function highlightPolygons(geoLayer, highlightStyle) {
    const layers = [];
    if (!geoLayer) return layers;

    geoLayer.eachLayer(layer => {
        layer.setStyle(highlightStyle);
        layers.push(layer);
    });

    return layers;
}

function highlightStops() {
    const layers = [];
    if (!stopsGeo) return layers;

    stopsGeo.eachLayer(layer => {
        layer.setZIndexOffset(1000);
        const el = layer.getElement();
        if (el) el.style.filter = 'drop-shadow(0 0 6px #FFD700)';
        layers.push(layer);
    });

    return layers;
}

function applyTagFilter(tag) {
    clearAllHighlights();

    if (tag === 'building') {
        const layers = highlightBuildings();
        highlightedGroup = { type: 'building', layers };
    } else if (tag === 'dormitory') {
        const layers = highlightBuildings(feature => {
            const val = feature?.properties?.Dormitory;
            return val === 1 || val === "1";
        });
        highlightedGroup = { type: 'building', layers };
    } else if (tag === 'water') {
        const layers = highlightPolygons(waterPolygonsGeo, waterHighlightStyle);
        highlightedGroup = { type: 'water', layers };
    } else if (tag === 'greenery') {
        const layers = highlightPolygons(greeneryGeo, greeneryHighlightStyle);
        highlightedGroup = { type: 'greenery', layers };
    } else if (tag === 'activity') {
        const layers = highlightPolygons(activitiesGeo, activitiesHighlightStyle);
        highlightedGroup = { type: 'activity', layers };
    } else if (tag === 'stop') {
        const layers = highlightStops();
        highlightedGroup = { type: 'stop', layers };
    }

    if (tagLabels[tag]) {
        setHeaderTitle(tagLabels[tag]);
    }
}

// Close the panel when the 'X' is clicked
closeBtn.addEventListener('click', () => {
    clearAllHighlights();
    resetHeaderTitle();
    infoPanel.classList.remove('active');
});

// Clickable tags in info panel
bldgTags.addEventListener('click', (event) => {
    const tagEl = event.target.closest('.tag');
    if (!tagEl || !tagEl.dataset.tag) return;
    applyTagFilter(tagEl.dataset.tag);
});

// Custom icon for Ikot stops
const ikotIcon = L.divIcon({
    className: 'ikot-marker',
    html: '<img src="data/ikot.png" alt="Ikot stop">',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

// Function to asynchronously load your local GeoJSON data
async function loadSpatialData() {
    try {
        // Fetch the roads GeoJSON
        const roadResponse = await fetch('./data/roads.geojson');
        if (!roadResponse.ok) {
            throw new Error(`HTTP error! status: ${roadResponse.status}`);
        }
        const roadData = await roadResponse.json();

        L.geoJSON(roadData, {
            // Dynamically style based on the properties
            style: function(feature) {
                if (feature.properties.is_ikot === 1) {
                    // Ikot Jeepney Route: Thick glowing yellow
                    return { color: "#FFD700", weight: 4, opacity: 1.0 }; 
                } else if (feature.properties.type === "Walkway") {
                    // Pedestrian Walkway: Dashed neon green
                    return { color: "#39FF14", weight: 2.5, dashArray: "5, 6", opacity: 0.8 }; 
                } else {
                    // Standard Campus Road: Muted dark grey
                    return { color: "#FFFFFF", weight: 2, opacity: 0.6 }; 
                }
            }
            // No click handlers on roads
        }).addTo(roadsLayer);

        // Fetch the Ikot stops GeoJSON
        const stopsResponse = await fetch('./data/ikotstops.geojson');
        if (!stopsResponse.ok) {
            throw new Error(`HTTP error! status: ${stopsResponse.status}`);
        }
        const stopsData = await stopsResponse.json();

        stopsGeo = L.geoJSON(stopsData, {
            pointToLayer: function(feature, latlng) {
                return L.marker(latlng, { icon: ikotIcon });
            },
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    clearAllHighlights();

                    bldgName.textContent = feature.properties.Name || 'Ikot Stop';
                    bldgDesc.textContent = 'Ikot jeepney stop.';
                    bldgTags.innerHTML = `<span class="tag tag-clickable" data-tag="stop">🚙 Ikot Stop</span>`;
                    infoPanel.classList.add('active');
                });
            }
        }).addTo(stopsLayer);

        // Fetch the Buildings GeoJSON
        const buildingsResponse = await fetch('./data/buildings.geojson');
        if (!buildingsResponse.ok) {
            throw new Error(`HTTP error! status: ${buildingsResponse.status}`);
        }
        const buildingsData = await buildingsResponse.json();

        buildingsGeo = L.geoJSON(buildingsData, {
            style: function() {
                return buildingStyle;
            },
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    clearAllHighlights();

                    layer.setStyle(buildingHighlightStyle);
                    selectedFeature = { layer, type: 'building' };

                    bldgName.textContent = feature.properties.Name || 'Unnamed Building';
                    bldgDesc.textContent = 'Campus building.';

                    const tags = ['<span class="tag tag-clickable" data-tag="building">🏛️ Building</span>'];
                    if (feature.properties.Dormitory === 1 || feature.properties.Dormitory === "1") {
                        tags.push('<span class="tag tag-clickable" data-tag="dormitory">🛏️ Dormitory</span>');
                    }
                    bldgTags.innerHTML = tags.join('');

                    infoPanel.classList.add('active');
                });
            }
        }).addTo(buildingsLayer);

        // Fetch Water Lines GeoJSON
        const waterLinesResponse = await fetch('./data/water_lines.geojson');
        if (!waterLinesResponse.ok) {
            throw new Error(`HTTP error! status: ${waterLinesResponse.status}`);
        }
        const waterLinesData = await waterLinesResponse.json();

        L.geoJSON(waterLinesData, {
            style: waterStyle
        }).addTo(waterLinesLayer);

        // Fetch Water Polygons GeoJSON
        const waterPolygonsResponse = await fetch('./data/water_polygons.geojson');
        if (!waterPolygonsResponse.ok) {
            throw new Error(`HTTP error! status: ${waterPolygonsResponse.status}`);
        }
        const waterPolygonsData = await waterPolygonsResponse.json();

        waterPolygonsGeo = L.geoJSON(waterPolygonsData, {
            style: waterStyle,
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    clearAllHighlights();

                    layer.setStyle(waterHighlightStyle);
                    selectedFeature = { layer, type: 'water' };

                    bldgName.textContent = feature.properties.Name || 'Water';
                    bldgDesc.textContent = 'Water feature.';
                    bldgTags.innerHTML = `<span class="tag tag-clickable" data-tag="water">💧 Water</span>`;
                    infoPanel.classList.add('active');
                });
            }
        }).addTo(waterPolygonsLayer);

        // Fetch Greenery GeoJSON
        const greeneryResponse = await fetch('./data/greenery.geojson');
        if (!greeneryResponse.ok) {
            throw new Error(`HTTP error! status: ${greeneryResponse.status}`);
        }
        const greeneryData = await greeneryResponse.json();

        greeneryGeo = L.geoJSON(greeneryData, {
            pane: 'greeneryPane',
            style: greeneryStyle,
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    clearAllHighlights();

                    layer.setStyle(greeneryHighlightStyle);
                    selectedFeature = { layer, type: 'greenery' };

                    bldgName.textContent = feature.properties.Name || 'Greenery';
                    bldgDesc.textContent = 'Green area.';
                    bldgTags.innerHTML = `<span class="tag tag-clickable" data-tag="greenery">🌿 Greenery</span>`;
                    infoPanel.classList.add('active');
                });
            }
        }).addTo(greeneryLayer);

        // Fetch Activities GeoJSON
        const activitiesResponse = await fetch('./data/activities.geojson');
        if (!activitiesResponse.ok) {
            throw new Error(`HTTP error! status: ${activitiesResponse.status}`);
        }
        const activitiesData = await activitiesResponse.json();

        activitiesGeo = L.geoJSON(activitiesData, {
            style: activitiesStyle,
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    clearAllHighlights();

                    layer.setStyle(activitiesHighlightStyle);
                    selectedFeature = { layer, type: 'activity' };

                    bldgName.textContent = feature.properties.Name || 'Activity Area';
                    bldgDesc.textContent = 'Activity area.';
                    bldgTags.innerHTML = `<span class="tag tag-clickable" data-tag="activity">🏟️ Activity</span>`;
                    infoPanel.classList.add('active');
                });
            }
        }).addTo(activitiesLayer);

        map.fitBounds(stopsGeo.getBounds(), {
            padding: [40, 40],
            maxZoom: 18
        });

        console.log("Roads + Ikot stops + Buildings + Water + Greenery + Activities loaded successfully!");

    } catch (error) {
        console.error("Failed to load data. Check your /data folder and Live Server.", error);
    }
}

loadSpatialData();
