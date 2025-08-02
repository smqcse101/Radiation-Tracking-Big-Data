// Helper function to get the correct API base URL
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
    } else {
        return `http://${hostname}:3001`;
    }
}

// Initialize the map
const map = L.map('map', {
    worldCopyJump: true,
}).setView([20, 0], 2);

// Cluster Tooltip
let clusterTooltip = L.tooltip({
    permanent: false,
    direction: 'top',
    className: 'cluster-tooltip'
});

// Add tile layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attributionControl: false,
    noWrap: true,
    bounds: [
        [-85, -180],
        [85, 180]
    ]
}).addTo(map);

// Cluster group for marker clustering
const clusterGroup = L.markerClusterGroup({
    iconCreateFunction: function (cluster) {
        const markers = cluster.getAllChildMarkers();
        let total = 0;

        markers.forEach(m => {
            total += m.options.pointValue || 0;
        });

        const avg = total / markers.length;
        const color = getRadiationColor(avg); // Your custom function to determine color

        return L.divIcon({
            html: `<div style="background-color: ${color}; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${cluster.getChildCount()}</div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40)
        });
    }
});

let clusteringEnabled = false;
let clusterPopup = null;

clusterGroup.on('clustermouseover', function (a) {
    const markers = a.layer.getAllChildMarkers();
    if (markers.length === 0) return;

    let total = 0, max = -Infinity;
    let timestamps = [];

    markers.forEach(m => {
        const val = m.options.pointValue || 0;
        total += val;
        if (val > max) max = val;

        const pointData = m.options.pointData;
        if (pointData && pointData.timestamp) {
            timestamps.push(new Date(pointData.timestamp));
        }
    });

    const avg = (total / markers.length).toFixed(2);
    const timeMin = new Date(Math.min(...timestamps));
    const timeMax = new Date(Math.max(...timestamps));

    const timeRange = `${timeMin.toLocaleString()} — ${timeMax.toLocaleString()}`;

    const popupContent = `
        <div class="popup-content">
            <h4>Cluster Summary</h4>
            <p><strong>Total Points:</strong> ${markers.length}</p>
            <p><strong>Average CPM:</strong> <span style="color:${getRadiationColor(avg)}">${avg}</span></p>
            <p><strong>Max CPM:</strong> <span style="color:${getRadiationColor(max)}">${max}</span></p>
            <p><strong>Time Range:</strong><br>${timeRange}</p>
        </div>
    `;

    clusterPopup = L.popup({
        offset: [0, -10],
        closeButton: false,
        autoClose: false,
        className: 'cluster-popup'
    })
    .setLatLng(a.layer.getLatLng())
    .setContent(popupContent)
    .openOn(map);
});

clusterGroup.on('clustermouseout', function () {
    if (clusterPopup) {
        map.closePopup(clusterPopup);
        clusterPopup = null;
    }
});


// Marker layer and data storage
//const markersLayer = L.layerGroup().addTo(map);
const markersLayer = L.layerGroup().addTo(map);
let allData = [];
let alertThreshold = 70;
let alerts = [];
let currentHighlightedMarker = null;

// DOM elements
const thresholdInput = document.getElementById('threshold-input');
const countrySelect = document.getElementById('country-select');
const alertsButton = document.getElementById('alerts-button');
const alertsSidebar = document.getElementById('alerts-sidebar');
const closeAlerts = document.getElementById('close-alerts');
const alertsList = document.getElementById('alerts-list');
const alertCount = document.getElementById('alert-count');
const heatmapToggle = document.getElementById('heatmap-toggle');
const minCpmValue = document.getElementById('min-cpm-value');
const maxCpmValue = document.getElementById('max-cpm-value');

// Countries data for dropdown
const countries = {
    "Germany": { lat: 51.1657, lng: 10.4515, zoom: 6 },
    "Japan": { lat: 36.2048, lng: 138.2529, zoom: 6 },
    "United States": { lat: 37.0902, lng: -95.7129, zoom: 4 },
    "France": { lat: 46.6035, lng: 1.8883, zoom: 6 },
    "United Kingdom": { lat: 55.3781, lng: -3.4360, zoom: 6 },
    "Canada": { lat: 56.1304, lng: -106.3468, zoom: 4 },
    "Australia": { lat: -25.2744, lng: 133.7751, zoom: 4 },
    "Brazil": { lat: -14.2350, lng: -51.9253, zoom: 5 },
    "India": { lat: 20.5937, lng: 78.9629, zoom: 5 },
    "China": { lat: 35.8617, lng: 104.1954, zoom: 5 },
    "South Africa": { lat: -30.5595, lng: 22.9375, zoom: 5 }
};

// Populate country dropdown
function populateCountrySelect() {
    countrySelect.innerHTML = '<option value="">World View</option>';
    Object.keys(countries).forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
}

// Slider setup
let slider;

function parseCoordinate(coord) {
    if (typeof coord === 'number') return coord;
    const parts = coord.toString().split('.');
    if (parts.length === 3) {
        return parseFloat(`${parts[0]}.${parts[1]}${parts[2]}`);
    }
    return parseFloat(coord);
}

function initSlider() {
    slider = document.getElementById('slider');
    const valueDisplay = document.getElementById('slider-value-display');

    noUiSlider.create(slider, {
        start: [0, 6000],
        connect: true,
        range: {
            'min': 0,
            'max': 6000
        },
        step: 1,
        pips: {
            mode: 'values',
            values: [0, 3000, 6000],
            density: 10
        }
    });

    slider.noUiSlider.on('update', function(values) {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        valueDisplay.textContent = `Showing values: ${min}-${max} CPM`;
        updateMarkersForClustering();
    });
}

function updateMapWithFilter(min, max) {
    markersLayer.clearLayers();
    
    // Special handling for values above 5000
    const showExtremeValues = max >= 5000;
    const extremeValueThreshold = 5000;

    allData
        .filter(point => {
            if (showExtremeValues) {
                return point.value >= min && (point.value <= max || point.value >= extremeValueThreshold);
            }
            return point.value >= min && point.value <= max;
        })
        .forEach(point => {
            const marker = L.marker([point.lat, point.lng], {
                icon: getRadiationIcon(point.value)
            }).addTo(markersLayer)
            .bindPopup(`
                <div class="popup-content">
                    <h4>Radiation Alert</h4>
                    <p><strong>Value:</strong> <span style="color:${getRadiationColor(point.value)}">${point.value} ${point.unit}</span></p>
                    <p><strong>Location:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</p>
                    <p><strong>Time:</strong> ${point.timestamp}</p>
                    <p><strong>Status:</strong> <span style="color:${point.value >= alertThreshold ? 'var(--danger)' : 'var(--success)'}">
                        ${getStatusText(point.value)}
                    </span></p>
                </div>
            `);

            // Store reference to the marker in the point object
            point.marker = marker;

            if (point.value >= alertThreshold) {
                marker.openPopup();
            }
        });
}

function getStatusText(value) {
    if (value >= 5000) return '⚠️ EXTREME DANGER';
    if (value >= 1000) return '⚠️ DANGER';
    if (value >= alertThreshold) return '⚠️ WARNING';
    return 'Normal';
}

function renderMarkers(useClustering = false, dataToRender = null) {
    // If no data provided, render allData
    const data = dataToRender || allData;

    if (useClustering) {
        markersLayer.clearLayers();
        clusterGroup.clearLayers();

        data.forEach(point => {
            const marker = L.marker([point.lat, point.lng], {
                icon: getRadiationIcon(point.value),
                pointValue: point.value,
                pointData: point
            }).bindPopup(`
                <div class="popup-content">
                    <h4>Radiation Alert</h4>
                    <p><strong>Value:</strong> <span style="color:${getRadiationColor(point.value)}">${point.value} ${point.unit}</span></p>
                    <p><strong>Location:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</p>
                    <p><strong>Time:</strong> ${point.timestamp}</p>
                    <p><strong>Status:</strong> <span style="color:${point.value >= alertThreshold ? 'var(--danger)' : 'var(--success)'}">
                        ${getStatusText(point.value)}
                    </span></p>
                </div>
            `);

            if (point.value >= alertThreshold) {
                marker.openPopup();
            }
            clusterGroup.addLayer(marker);
            point.marker = marker; // keep reference if needed
        });

        if (map.hasLayer(markersLayer)) map.removeLayer(markersLayer);
        if (!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
    } else {
        clusterGroup.clearLayers();
        markersLayer.clearLayers();

        data.forEach(point => {
            const marker = L.marker([point.lat, point.lng], {
                icon: getRadiationIcon(point.value)
            }).bindPopup(`
                <div class="popup-content">
                    <h4>Radiation Alert</h4>
                    <p><strong>Value:</strong> <span style="color:${getRadiationColor(point.value)}">${point.value} ${point.unit}</span></p>
                    <p><strong>Location:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</p>
                    <p><strong>Time:</strong> ${point.timestamp}</p>
                    <p><strong>Status:</strong> <span style="color:${point.value >= alertThreshold ? 'var(--danger)' : 'var(--success)'}">
                        ${getStatusText(point.value)}
                    </span></p>
                </div>
            `);

            if (point.value >= alertThreshold) {
                marker.openPopup();
            }
            markersLayer.addLayer(marker);
            point.marker = marker;
        });

        if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
        if (!map.hasLayer(markersLayer)) map.addLayer(markersLayer);
    }
}

function setupStreaming() {
    const eventSource = new EventSource(`${getApiBaseUrl()}/api/realtime/safecastEnriched`);

    eventSource.onmessage = (event) => {
        try {
            const newPoint = JSON.parse(event.data);

            const formattedPoint = {
                lat: parseCoordinate(newPoint.Latitude),
                lng: parseCoordinate(newPoint.Longitude),
                value: newPoint.Value,
                unit: newPoint.Unit,
                timestamp: newPoint['Captured Time']
            };

            if (!isNaN(formattedPoint.lat) && !isNaN(formattedPoint.lng)) {
                allData.push(formattedPoint);
                //maybeInitBuckets();
                // Update min/max CPM
                updateMinMaxCPM();

                // Check if this point should trigger an alert
                if (formattedPoint.value >= alertThreshold) {
                    addAlert(formattedPoint);
                }

                const currentRange = slider.noUiSlider.get();
                const min = Math.round(currentRange[0]);
                const max = Math.round(currentRange[1]);

                if ((formattedPoint.value >= min && formattedPoint.value <= max) || 
                    (max >= 5000 && formattedPoint.value >= 5000)) {
                    
                    const marker = L.marker([formattedPoint.lat, formattedPoint.lng], {
                        icon: getRadiationIcon(formattedPoint.value)
                    }).bindPopup(`
                        <div class="popup-content">
                            <h4>Radiation Alert</h4>
                            <p><strong>Value:</strong> <span style="color:${getRadiationColor(formattedPoint.value)}">${formattedPoint.value} ${formattedPoint.unit}</span></p>
                            <p><strong>Location:</strong> ${formattedPoint.lat.toFixed(6)}, ${formattedPoint.lng.toFixed(6)}</p>
                            <p><strong>Time:</strong> ${formattedPoint.timestamp}</p>
                            <p><strong>Status:</strong> <span style="color:${formattedPoint.value >= alertThreshold ? 'var(--danger)' : 'var(--success)'}">
                                ${getStatusText(formattedPoint.value)}
                            </span></p>
                        </div>
                    `);

                    // Store reference to the marker in the point object
                    formattedPoint.marker = marker;

                 if (clusteringEnabled) {
    clusterGroup.addLayer(marker);
    
    // If value is above threshold, open popup after cluster expands
    if (formattedPoint.value >= alertThreshold) {
        // Use a short timeout to wait for the marker to be added
        setTimeout(() => {
            marker.openPopup();
        }, 300);
    }

} else {
    markersLayer.addLayer(marker);
    if (formattedPoint.value >= alertThreshold) {
        marker.openPopup();
    }
}


                    groupDataByTimeBuckets();
                    
                }
            }
        } catch (e) {
            console.error("Error processing stream point:", e);
        }
    };

    eventSource.onerror = () => {
        console.warn("Stream connection error. Reconnecting...");
        setTimeout(setupStreaming, 5000);
    };
}

/*
Commented as the logic seems to be broken right now
// Time Animation Variables
let animationPlaying = false;
let animationInterval = null;
let timeSlider;
let timeLabel;
let playPauseBtn;
let timeBuckets = [];
let timeIndex = 0;
// Setup playback controls
function setupTimeAnimationControls() {
    timeSlider = document.getElementById('time-slider');
    timeLabel = document.getElementById('current-time-label');
    playPauseBtn = document.getElementById('play-pause-btn');

    playPauseBtn.addEventListener('click', () => {
        animationPlaying = !animationPlaying;
        playPauseBtn.innerHTML = `<i class="fas fa-${animationPlaying ? 'pause' : 'play'}"></i>`;
        if (animationPlaying) {
            animationInterval = setInterval(() => {
                timeIndex++;
                if (timeIndex >= timeBuckets.length) {
                    timeIndex = 0;
                }
                timeSlider.value = timeIndex;
                renderTimeBucket(timeIndex);
            }, 1000);
        } else {
            clearInterval(animationInterval);
        }
    });

    timeSlider.addEventListener('input', (e) => {
        timeIndex = parseInt(e.target.value);
        renderTimeBucket(timeIndex);
    });
}

let bucketInitialized = false;
function maybeInitBuckets() {
    if (!bucketInitialized && allData.length >= 10) {
        groupDataByTimeBuckets();
        bucketInitialized = true;
    }
}
// Group data into hourly buckets
function groupDataByTimeBuckets() {
    const bucketSizeInMinutes = 1; // hourly
    const sorted = [...allData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstTime = new Date(sorted[0]?.timestamp);
    timeBuckets = [];

    for (const point of sorted) {
        const time = new Date(point.timestamp);
        const diffMinutes = Math.floor((time - firstTime) / 60000);
        const bucketIndex = Math.floor(diffMinutes / bucketSizeInMinutes);
        if (!timeBuckets[bucketIndex]) timeBuckets[bucketIndex] = [];
        timeBuckets[bucketIndex].push(point);
    }

    timeSlider.max = timeBuckets.length - 1;
    timeSlider.value = 0;
    renderTimeBucket(0);
}

function renderTimeBucket(index) {
    if (!timeBuckets[index]) return;
    const dataToRender = timeBuckets[index];
    const time = dataToRender[0]?.timestamp;
    timeLabel.textContent = `1-min bucket: ${new Date(time).toLocaleString()}`;
    renderMarkers(clusteringEnabled, dataToRender);
}

*/

function updateMinMaxCPM() {
    if (allData.length === 0) return;
    
    const values = allData.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    minCpmValue.textContent = min.toFixed(2);
    maxCpmValue.textContent = max.toFixed(2);
}

function addAlert(point) {
    alerts.push(point);
    updateAlertsDisplay();
    // Flash the alerts button
    alertsButton.classList.add('pulse');
    setTimeout(() => alertsButton.classList.remove('pulse'), 1500);
}

function updateAlertsDisplay() {
    alertCount.textContent = alerts.length;
    
    // Sort alerts by value (descending)
    alerts.sort((a, b) => b.value - a.value);
    
    alertsList.innerHTML = '';
    alerts.forEach((alert, index) => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item ${alert.value >= 1000 ? 'alert-high' : ''} ${alert.value >= 5000 ? 'alert-extreme' : ''}`;
        alertItem.innerHTML = `
            <div class="alert-value">${alert.value} ${alert.unit}</div>
            <div class="alert-coords">${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}</div>
            <div class="alert-time">${alert.timestamp}</div>
            <button class="view-alert-btn" data-index="${index}">View on Map</button>
        `;
        alertsList.appendChild(alertItem);
    });

    // Add event listeners to the new buttons
    document.querySelectorAll('.view-alert-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            highlightAlertOnMap(index);
        });
    });
}

function highlightAlertOnMap(index) {
    if (index >= 0 && index < alerts.length) {
        const alert = alerts[index];
        
        // Remove previous highlight if exists
        if (currentHighlightedMarker) {
            currentHighlightedMarker.setIcon(getRadiationIcon(currentHighlightedMarker.pointValue));
        }
        
        // Find the marker in the markers layer
        let marker = alert.marker;
        if (!marker) {
            // If marker doesn't exist (might be filtered out), create it temporarily
            marker = L.marker([alert.lat, alert.lng], {
                icon: getHighlightedRadiationIcon(alert.value)
            }).addTo(map);
            marker.bindPopup(`
                <div class="popup-content">
                    <h4>Radiation Alert</h4>
                    <p><strong>Value:</strong> <span style="color:${getRadiationColor(alert.value)}">${alert.value} ${alert.unit}</span></p>
                    <p><strong>Location:</strong> ${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}</p>
                    <p><strong>Time:</strong> ${alert.timestamp}</p>
                    <p><strong>Status:</strong> <span style="color:${alert.value >= alertThreshold ? 'var(--danger)' : 'var(--success)'}">
                        ${getStatusText(alert.value)}
                    </span></p>
                </div>
            `);
        } else {
            // Update existing marker with highlight
            marker.setIcon(getHighlightedRadiationIcon(alert.value));
        }
        
        // Store reference to the highlighted marker
        marker.pointValue = alert.value;
        currentHighlightedMarker = marker;
        
        // Fly to the marker and open its popup
        map.flyTo([alert.lat, alert.lng], 10, {
            duration: 1,
            easeLinearity: 0.25
        });
        marker.openPopup();
        
        // Close the sidebar if on mobile
        if (window.innerWidth < 768) {
            alertsSidebar.classList.remove('active');
        }
    }
}

function getHighlightedRadiationIcon(value) {
    const size = Math.min(50, 25 + value / 50); // Slightly larger than normal
    return L.divIcon({
        html: `<div style="
                  background: ${getRadiationColor(value)};
                  width: ${size}px;
                  height: ${size}px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 3px solid white;
                  box-shadow: 0 0 10px rgba(0,0,0,0.5);
                  animation: pulse 0.5s infinite;
              ">
              <i class="fas fa-radiation" style="color: white; font-size: ${Math.min(16, 15 + value / 100)}px;"></i>
              </div>`,
        className: '',
        iconSize: [size, size]
    });
}

function listenToAverageStream() {
    const eventSource = new EventSource(`${getApiBaseUrl()}/api/realtime/average`);

    eventSource.onmessage = (event) => {
        try {
            const avgData = JSON.parse(event.data);
            const avgCPM = avgData.real_time_avg_cpm.toFixed(5);
            const count = avgData.count;
            document.getElementById('avg-cpm-value').textContent = avgCPM;
            document.getElementById('measurement-count').textContent = count;
        } catch (e) {
            console.error("Error parsing average data:", e);
        }
    };

    eventSource.onerror = () => {
        console.warn("Average SSE error. Reconnecting...");
        setTimeout(listenToAverageStream, 5000);
    };
}

// Radiation visualization functions
function getRadiationColor(value) {
    return value >= 5000 ? '#8b0000' : // Dark red for extreme values
           value >= 3000 ? '#d73027' :
           value >= 2000 ? '#f46d43' :
           value >= 1000 ? '#fdae61' :
           value >= 600  ? '#fee08b' :
           value >= 300  ? '#d9ef8b' :
           value >= 100  ? '#91cf60' :
           value >= 50   ? '#66bd63' :
                           '#1a9850';
}

function getRadiationIcon(value) {
    const size = Math.min(40, 20 + value / 50);
    return L.divIcon({
        html: `<div style="
                  background: ${getRadiationColor(value)};
                  width: ${size}px;
                  height: ${size}px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 2px solid white;
                  box-shadow: 0 0 5px rgba(0,0,0,0.3);
                  ${value >= alertThreshold ? 'animation: pulse 1.5s infinite;' : ''}
              ">
              <i class="fas fa-radiation" style="color: white; font-size: ${Math.min(14, 8 + value / 100)}px;"></i>
              </div>`,
        className: '',
        iconSize: [size, size]
    });
}

// Event listeners and UI interactions

thresholdInput.addEventListener('change', () => {
    alertThreshold = parseInt(thresholdInput.value, 10) || 70;
    updateMarkersForClustering();
});

countrySelect.addEventListener('change', () => {
    const country = countrySelect.value;
    if (country && countries[country]) {
        const { lat, lng, zoom } = countries[country];
        map.flyTo([lat, lng], zoom);
    } else {
        map.flyTo([20, 0], 2);
    }
});

alertsButton.addEventListener('click', () => {
    alertsSidebar.classList.toggle('active');
});

closeAlerts.addEventListener('click', () => {
    alertsSidebar.classList.remove('active');
});

heatmapToggle.addEventListener('click', () => {
    clusteringEnabled = !clusteringEnabled;
    updateMarkersForClustering();
    heatmapToggle.textContent = clusteringEnabled ? 'Disable Clustering' : 'Enable Clustering';
});

// Core function to update markers depending on clustering and slider range
function updateMarkersForClustering() {
    if (!slider) return;
    const currentRange = slider.noUiSlider.get();
    const min = Math.round(currentRange[0]);
    const max = Math.round(currentRange[1]);

    // Filter data according to slider range
    const filteredData = allData.filter(point => {
        if (max >= 5000) {
            return point.value >= min && (point.value <= max || point.value >= 5000);
        }
        return point.value >= min && point.value <= max;
    });

    renderMarkers(clusteringEnabled, filteredData);
}

// Initialize everything on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    populateCountrySelect();
    initSlider();
    listenToAverageStream();
    setupStreaming();
    // Initially render markers without clustering
    updateMarkersForClustering();
    //setupTimeAnimationControls();
});
