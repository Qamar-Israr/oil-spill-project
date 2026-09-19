
import { fetchIncidentData } from './mockdata.js';

import { initMap, refreshMapSize } from './map.js';

import { renderVesselPanel } from './panels.js';

import { saveIncident, seedSampleIncident, formatArchiveId } from './archive.js';

import { renderIncidentsArchive, setArchiveStatus } from './incidents.js';


let currentIncidentData = null;
let investigationBannerTimer = null;
const INVESTIGATE_ENDPOINT = 'http://127.0.0.1:8000/api/investigate';


document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupInvestigationForm();
  setupInvestigationBanner();
});



async function initializeApp() {
  setupNavigation();

  await loadIncident('SAR-2026-0881');
}


async function loadIncident(incidentId) {
  try {

    const data = await fetchIncidentData(incidentId);

    // Make sure the demo incident is in the archive on first launch.
    seedSampleIncident(data);

    displayIncident(data);

  } catch (err) {
    console.error('Failed to load incident data:', err);
  }
}

// Shows an incident on the dashboard. Used for the initial load, for fresh
// investigation results and for incidents restored from the archive, so all
// three render identically.
function displayIncident(data, { showBanner = false } = {}) {
  currentIncidentData = data;

  if (showBanner) {
    updateInvestigationBanner('complete', data);
  } else {
    hideInvestigationBanner();
  }

  // The existing map requires vessel coordinates and a drift line. Keep
  // those layers empty when the data does not provide those data points.
  const mapData = {
    ...data,
    candidates: data.candidates.filter(hasMapTrack),
    driftPath: data.driftPath || []
  };
  initMap('map', mapData);
  renderVesselPanel(data);
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
}

function showView(viewId) {
  const target = document.getElementById(viewId);
  // Report and System Info have no view yet; leave the current view as is.
  if (!target) return false;

  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('active', view === target);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewId);
  });

  if (viewId === 'view-dashboard') refreshMapSize();
  if (viewId === 'view-incidents') refreshIncidentsArchive();
  return true;
}

function refreshIncidentsArchive() {
  setArchiveStatus('');
  renderIncidentsArchive({
    activeId: currentIncidentData?.id,
    onOpen: restoreIncident
  });
}

// Clicking an archive row brings that investigation back on the dashboard:
// map layers, incident metadata and candidate vessels.
function restoreIncident(record) {
  const data = record.data;
  const archiveId = formatArchiveId(record.no);

  if (!isRestorable(data)) {
    console.error('Archived incident is incomplete and cannot be restored:', record);
    setArchiveStatus(`${archiveId} is missing data and cannot be restored.`, true);
    return;
  }

  // Switch first: Leaflet can't size a map inside a hidden container.
  showView('view-dashboard');
  displayIncident(data, { showBanner: true });
  setRequestStatus(
    document.getElementById('investigation-status'),
    `Restored ${archiveId} from archive.`,
    false
  );
}

function isRestorable(data) {
  return Boolean(
    data &&
    Number.isFinite(data.centerCoords?.lat) &&
    Number.isFinite(data.centerCoords?.lng) &&
    Number.isFinite(data.originPoint?.lat) &&
    Number.isFinite(data.originPoint?.lng) &&
    Array.isArray(data.spillPolygon) &&
    Array.isArray(data.candidates)
  );
}

function setupInvestigationForm() {
  const form = document.getElementById('investigation-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const status = document.getElementById('investigation-status');
    const button = document.getElementById('investigate-button');
    const image = document.getElementById('investigation-image')?.files?.[0];
    const latitude = document.getElementById('investigation-latitude')?.value;
    const longitude = document.getElementById('investigation-longitude')?.value;
    const timestamp = document.getElementById('investigation-timestamp')?.value;

    if (!image || latitude === '' || longitude === '' || !timestamp) {
      setRequestStatus(status, 'Enter all fields and choose a SAR image.', true);
      return;
    }

    const timestampIso = new Date(timestamp).toISOString();

    const formData = new FormData();
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('timestamp', timestampIso);
    formData.append('image', image);

    button.disabled = true;
    updateInvestigationBanner('progress');
    setRequestStatus(status, 'Investigating image...', false);

    try {
      const response = await fetch(INVESTIGATE_ENDPOINT, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, response.status));
      }

      const adaptedData = adaptInvestigationResponse(payload, image.name, timestampIso);
      displayIncident(adaptedData, { showBanner: true });

      const saved = saveIncident(adaptedData);
      if (saved) {
        setRequestStatus(
          status,
          `Investigation complete. Saved to archive as ${formatArchiveId(saved.no)}.`,
          false
        );
      } else {
        setRequestStatus(
          status,
          'Investigation complete, but it could not be saved to the archive (browser storage is full or unavailable).',
          true
        );
      }
    } catch (error) {
      console.error('Investigation request failed:', error);
      updateInvestigationBanner('error', null, error.message || 'Investigation failed.');
      setRequestStatus(status, error.message || 'Investigation failed.', true);
    } finally {
      button.disabled = false;
    }
  });
}

function setupInvestigationBanner() {
  document.getElementById('investigation-banner-close')?.addEventListener('click', hideInvestigationBanner);
}

function updateInvestigationBanner(state, data = null, errorMessage = '') {
  const banner = document.getElementById('investigation-banner');
  const heading = document.getElementById('investigation-banner-state');
  const summary = document.getElementById('investigation-banner-summary');
  const checks = document.getElementById('investigation-banner-checks');
  if (!banner || !heading || !summary || !checks) return;

  clearTimeout(investigationBannerTimer);
  banner.hidden = false;
  banner.dataset.state = state;
  checks.replaceChildren();

  if (state === 'complete') {
    if (!isSpillDetected(data)) {
      heading.textContent = 'No spill detected in this image';
      summary.textContent = '';
      investigationBannerTimer = setTimeout(hideInvestigationBanner, 10000);
      return;
    }

    const steps = getInvestigationSteps(data);
    heading.textContent = 'INVESTIGATION COMPLETE';
    summary.textContent = data?.title || 'All investigation stages completed';
    steps.forEach((step) => {
      const item = document.createElement('span');
      item.textContent = step;
      checks.appendChild(item);
    });
    investigationBannerTimer = setTimeout(hideInvestigationBanner, 10000);
    return;
  }

  if (state === 'error') {
    heading.textContent = 'Investigation failed';
    summary.textContent = errorMessage;
    investigationBannerTimer = setTimeout(hideInvestigationBanner, 10000);
    return;
  }

  heading.textContent = 'Investigating...';
  summary.textContent = 'Analyzing SAR, reconstructing origin, and correlating AIS';
}

function hideInvestigationBanner() {
  clearTimeout(investigationBannerTimer);
  const banner = document.getElementById('investigation-banner');
  if (banner) banner.hidden = true;
}

function getInvestigationSteps(data) {
  const steps = [];
  const area = Number(data?.spillAreaKm2);
  const confidence = Number(data?.detectionConfidence);
  if (isSpillDetected(data)) {
    steps.push(`SAR spill detected - ${formatNumber(area)} km2, ${formatNumber(confidence)}%`);
  }

  if (Number.isFinite(data?.originPoint?.lat) && Number.isFinite(data?.originPoint?.lng)) {
    steps.push('Origin reconstructed');
  }

  if (data?.aisCorrelationCompleted !== false && Array.isArray(data?.candidates)) {
    const count = data.candidates.length;
    steps.push(count === 0 ? 'No candidate vessels found' : `${count} candidate vessels identified`);
  }

  if (hasForecast(data)) steps.push('+6h forecast generated');
  return steps;
}

function isSpillDetected(data) {
  return Number(data?.spillAreaKm2) > 0 && Number(data?.detectionConfidence) > 0;
}

function hasForecast(data) {
  return (Array.isArray(data?.driftPath) && data.driftPath.length > 0) ||
    data?.forecastAvailable === true ||
    (Array.isArray(data?.forecastPolygon) && data.forecastPolygon.length > 0);
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function adaptInvestigationResponse(response, imageName, incidentTimeIso) {
  const spill = response.spill || {};
  const origin = response.origin || {};
  const geometry = response.geometry || {};
  const prediction = response.prediction || {};
  const oilQuantity = response.oil_quantity || {};
  const polygon = geometry.polygon_geojson?.coordinates?.[0] || [];

  return {
    id: `API-${Date.now()}`,
    title: 'Oil Spill Investigation',
    satellite: imageName || 'Uploaded SAR image',
    // The time the user entered for the incident (what the archive dates by).
    acquiredUtc: incidentTimeIso || new Date().toISOString(),
    region: `${Number(origin.latitude).toFixed(4)}°, ${Number(origin.longitude).toFixed(4)}°`,
    centerCoords: {
      lat: Number(origin.latitude),
      lng: Number(origin.longitude)
    },
    spillAreaKm2: Number(spill.area_km2 || geometry.area_km2 || 0),
    oilQuantity,
    oilQuantityEstimate: oilQuantity,
    spillVolumeEstM3: oilQuantity.volume_range_m3
      ? `${oilQuantity.volume_range_m3.min}-${oilQuantity.volume_range_m3.max} m³`
      : 'Unavailable',
    detectionConfidence: Number(spill.confidence || 0) * 100,
    originPoint: {
      lat: Number(origin.latitude),
      lng: Number(origin.longitude),
      uncertaintyRadiusMeters: Number(origin.uncertainty_km || 0) * 1000
    },
    spillPolygon: polygon.map(([lng, lat]) => [lat, lng]),
    // The backend returns a predicted polygon, not a time-stepped path.
    // Leave this empty rather than fabricating drift waypoints.
    driftPath: [],
    forecastAvailable: Boolean(prediction.predicted_polygon_geojson),
    windVector: 'Unavailable',
    candidates: (response.vessels || []).map(adaptVessel)
  };
}

function adaptVessel(vessel) {
  const breakdown = vessel.score_breakdown || {};
  const anomaly = Array.isArray(vessel.ais_anomalies) && vessel.ais_anomalies.length > 0;
  const position = vessel.position && {
    lat: Number(vessel.position.latitude),
    lng: Number(vessel.position.longitude)
  };
  const trackHistory = Array.isArray(vessel.track_history)
    ? vessel.track_history.map((point) => [
      Number(point.latitude),
      Number(point.longitude)
    ])
    : [];

  return {
    id: vessel.id || vessel.mmsi,
    mmsi: vessel.mmsi || vessel.id,
    name: vessel.name,
    flagCode: '',
    type: vessel.vessel_type || '',
    speedKnots: vessel.speed_knots ?? '',
    position,
    heading: vessel.heading,
    trackHistory,
    // Which stretch of the track the transponder was silent for (the map dashes it)
    aisGapRanges: findGapRanges(vessel.track_history, vessel.ais_anomalies),
    distanceKm: vessel.distance_km,
    timeDifferenceMinutes: vessel.time_difference_minutes,
    riskLevel: vessel.risk_level,
    confidence: vessel.confidence,
    suspicionScore: Number(vessel.score),
    explanation: Array.isArray(vessel.reasons) ? vessel.reasons.join('. ') : '',
    scoreBreakdown: {
      proximityScore: breakdown.distance,
      trajectoryMatchScore: Number(vessel.trajectory_alignment) * 100,
      aisGapDetected: anomaly,
      aisGapDurationMins: anomaly
        ? Math.max(...vessel.ais_anomalies.map((gap) => Number(gap.gap_duration_minutes || 0)))
        : 0,
      speedAnomalyDetected: false,
      speedDropKnots: ''
    }
  };
}

// Turns the API's AIS gaps (start/end timestamps) into [startIndex, endIndex]
// pairs into the vessel's track, by matching them to the track points' timestamps.
function findGapRanges(track, gaps) {
  if (!Array.isArray(track) || !Array.isArray(gaps)) return [];

  const times = track.map((point) => Date.parse(point.timestamp));
  const ranges = [];
  gaps.forEach((gap) => {
    const start = times.indexOf(Date.parse(gap.gap_start));
    const end = times.indexOf(Date.parse(gap.gap_end));
    if (start !== -1 && end > start) ranges.push([start, end]);
  });
  return ranges;
}

function hasMapTrack(vessel) {
  return Boolean(
    vessel.position &&
    Number.isFinite(vessel.position.lat) &&
    Number.isFinite(vessel.position.lng) &&
    Array.isArray(vessel.trackHistory) &&
    vessel.trackHistory.length > 0 &&
    vessel.trackHistory.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
  );
}

function getApiErrorMessage(payload, statusCode) {
  if (payload?.detail) {
    return typeof payload.detail === 'string'
      ? payload.detail
      : 'The backend rejected the investigation request.';
  }
  return `Investigation failed (HTTP ${statusCode}).`;
}

function setRequestStatus(element, message, isError) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'normal';
}
