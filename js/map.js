// ==========================================
// UI EVENT LISTENERS (Information Panel)
// ==========================================
const infoPanel = document.getElementById('info-panel');
const closeBtn = document.getElementById('close-btn');
const bldgName = document.getElementById('bldg-name');
const bldgDesc = document.getElementById('bldg-desc');
const bldgTags = document.getElementById('bldg-tags');

// Close the panel when the 'X' is clicked
closeBtn.addEventListener('click', () => {
    infoPanel.classList.remove('active');
});

// ==========================================
// MAP INITIALIZATION
// ==========================================

// Coordinates center on the UP Diliman Academic Oval
const updBounds = [
    [14.6380, 121.0520], // Southwest (near Philcoa / Krus na Ligas)
    [14.6680, 121.0780]  // Northeast (near Balara / UPTC)
];

// Initialize the map locked to the campus boundaries
const map = L.map('map', {
    zoomControl: false, 
    maxBounds: updBounds,     
    maxBoundsViscosity: 0.9,   
    minZoom: 14                
}).setView([14.6549, 121.0645], 15);

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
// DATA LAYERS & FETCH LOGIC
// ==========================================

// Create empty Layer Group for buildings
const buildingsLayer = L.layerGroup().addTo(map);

// Function to asynchronously load your local GeoJSON data
async function loadSpatialData() {
    try {
        // Fetch the buildings GeoJSON
        const response = await fetch('./data/buildings.geojson');
        const data = await response.json();
        
        L.geoJSON(data, {
            // Compute the dark mode styling for the building shapes
            style: function(feature) {
                return {
                    color: "#ff6666", // Bright, high-contrast maroon/red outline
                    fillColor: "#ffffff", // White fill to stand out against dark tiles
                    weight: 1.5,
                    fillOpacity: 0.15 // Keep it mostly transparent
                };
            },
            onEachFeature: function(feature, layer) {
                // Listen for taps/clicks on the buildings
                layer.on('click', function() {
                    
                    // Inject the GeoJSON properties into the HTML panel
                    bldgName.textContent = feature.properties.name || 'Unnamed Building';
                    bldgDesc.textContent = feature.properties.description || 'No description available for this location.';
                    
                    // Clear out old tags before generating new ones
                    bldgTags.innerHTML = '';
                    
                    // Generate dynamic facility tags based on the properties
                    if (feature.properties.type) {
                        bldgTags.innerHTML += `<span class="tag">🏢 ${feature.properties.type.toUpperCase()}</span>`;
                    }
                    if (feature.properties.has_library) {
                        bldgTags.innerHTML += `<span class="tag">📚 Library</span>`;
                    }
                    if (feature.properties.has_cafeteria) {
                        bldgTags.innerHTML += `<span class="tag">☕ Cafeteria</span>`;
                    }

                    // Slide the information panel into view
                    infoPanel.classList.add('active');
                });
            }
        }).addTo(buildingsLayer);

        console.log("Buildings loaded successfully.");

    } catch (error) {
        console.error("Error loading GeoJSON data. Ensure files are in the /data folder and you are running a local server.", error);
    }
}

// Execute the function
loadSpatialData();
