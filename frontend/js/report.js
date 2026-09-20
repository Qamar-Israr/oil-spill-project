let reportMap = null;

const evidenceFactors = [
  ['Proximity Score', 'proximityScore'],
  ['Trajectory Match', 'trajectoryMatchScore'],
  ['Confidence', 'confidence']
];

export function renderForensicReport(data) {
  const container = document.getElementById('forensic-report-content');
  if (!container || !data) return;

  container.innerHTML = `
    <div class="report-grid">
      ${renderSection('Incident Information', renderRows([
        ['Incident ID', data.id],
        ['Detection Timestamp', data.acquiredUtc],
        ['Investigation Status', 'Evidence review']
      ]))}
      ${renderSection('SAR Observation', renderRows([
        ['Spill Detected', Number(data.spillAreaKm2) > 0 ? 'Confirmed' : 'Not detected'],
        ['Detection Confidence', `${format(data.detectionConfidence)}%`],
        ['Spill Area', `${format(data.spillAreaKm2)} km²`],
        ['Satellite Source', data.satellite || 'Unavailable']
      ]))}
      ${renderSection('Spill Estimation', renderRows([
        ['Estimated Oil Quantity', formatQuantity(data)],
        ['Origin Latitude', `${format(data.originPoint?.lat, 5)}°`],
        ['Origin Longitude', `${format(data.originPoint?.lng, 5)}°`],
        ['Uncertainty Radius', `${format(Number(data.originPoint?.uncertaintyRadiusMeters) / 1000)} km`]
      ]))}
      ${renderSection('Drift and Forecast', renderRows([
        ['Estimated Origin', `${format(data.originPoint?.lat, 5)}°, ${format(data.originPoint?.lng, 5)}°`],
        ['Drift Waypoints', data.driftPath?.length ? data.driftPath.length : 'Unavailable'],
        ['Forecast', data.predictedPolygonGeoJSON ? '+6 hour spread available' : 'Unavailable']
      ]))}
    </div>
    <section class="report-section report-map-section">
      <div class="report-section-heading"><h2>Map Section</h2><span>Spill, origin, forecast and candidate tracks</span></div>
      <div id="report-map" class="report-map"></div>
    </section>
    <section class="report-section">
      <div class="report-section-heading"><h2>Candidate Vessels</h2><span>Ranked source association evidence</span></div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead><tr><th>Rank</th><th>Vessel Name</th><th>MMSI</th><th>Score</th><th>Risk</th><th>Confidence</th><th>Distance</th></tr></thead>
          <tbody>${(data.candidates || []).map((vessel, index) => renderVesselRow(vessel, index + 1)).join('')}</tbody>
        </table>
      </div>
    </section>
  `;

  container.querySelectorAll('.report-vessel-row').forEach((row) => {
    row.addEventListener('click', () => row.classList.toggle('expanded'));
  });

  renderReportMap(data);
}

function renderVesselRow(vessel, rank) {
  const confidence = vessel.confidence == null ? '-' : `${Math.round(Number(vessel.confidence) * 100)}%`;
  return `<tr class="report-vessel-row" tabindex="0">
    <td>${rank}</td>
    <td><strong>${escapeHtml(vessel.name)}</strong><small>Candidate Vessel</small></td>
    <td>${escapeHtml(vessel.mmsi)}</td>
    <td><span class="score-badge">${format(vessel.suspicionScore)}/100</span></td>
    <td><span class="risk-badge risk-${String(vessel.riskLevel || '').toLowerCase()}">${escapeHtml(vessel.riskLevel || '-')}</span></td>
    <td>${confidence}</td>
    <td>${format(vessel.distanceKm)} km</td>
  </tr>
  <tr class="report-vessel-details"><td colspan="7">${renderEvidence(vessel)}</td></tr>`;
}

function renderEvidence(vessel) {
  const breakdown = vessel.scoreBreakdown || {};
  return `<div class="evidence-detail">
    <div><h3>Scoring Factors</h3><div class="evidence-bars">${evidenceFactors.map(([label, key]) => renderBar(label, key === 'confidence' ? Number(vessel.confidence) * 100 : breakdown[key])).join('')}</div></div>
    <div><h3>Investigation Evidence</h3><dl class="evidence-facts">${renderFact('Distance from Origin', `${format(vessel.distanceKm)} km`)}${renderFact('Heading', vessel.heading == null ? '-' : `${format(vessel.heading)}°`)}${renderFact('AIS Anomalies', breakdown.aisGapDetected ? 'Detected' : 'None')}${renderFact('Vessel Type', vessel.type || '-')}</dl></div>
    <div><h3>Evidence Summary</h3><ul class="evidence-reasons"><li>${escapeHtml(vessel.explanation || 'No explanation returned.')}</li></ul></div>
  </div>`;
}

function renderBar(label, value) {
  const score = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return `<div class="evidence-bar"><div><span>${label}</span><b>${format(value)}</b></div><div class="evidence-bar-track"><i style="width:${score}%"></i></div></div>`;
}

function renderSection(title, content) {
  return `<section class="report-section"><div class="report-section-heading"><h2>${title}</h2></div>${content}</section>`;
}

function renderRows(rows) {
  return `<div class="report-rows">${rows.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
}

function renderFact(label, value) {
  return `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderReportMap(data) {
  if (reportMap) reportMap.remove();
  if (!window.L || !document.getElementById('report-map')) return;

  reportMap = L.map('report-map', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri', maxZoom: 19
  }).addTo(reportMap);

  const layers = [];
  if (Array.isArray(data.spillPolygon) && data.spillPolygon.length) {
    layers.push(L.polygon(data.spillPolygon, { color: '#e89b29', fillColor: '#d9a048', fillOpacity: 0.35 }).addTo(reportMap));
  }
  if (data.originPoint) {
    layers.push(L.circle([data.originPoint.lat, data.originPoint.lng], { radius: data.originPoint.uncertaintyRadiusMeters, color: '#fff', fillOpacity: 0.08 }).addTo(reportMap));
  }
  if (Array.isArray(data.driftPath) && data.driftPath.length) {
    layers.push(L.polyline(data.driftPath, { color: '#3fb8af', dashArray: '8, 6' }).addTo(reportMap));
  }
  if (data.predictedPolygonGeoJSON) {
    layers.push(L.geoJSON(data.predictedPolygonGeoJSON, { style: { color: '#f59e0b', dashArray: '6, 6', fillColor: '#f59e0b', fillOpacity: 0.2 } }).addTo(reportMap));
  }
  (data.candidates || []).forEach((vessel) => {
    if (Array.isArray(vessel.trackHistory) && vessel.trackHistory.length > 1) {
      layers.push(L.polyline(vessel.trackHistory, { color: '#4cf9ed', weight: 2, opacity: 0.75 }).addTo(reportMap));
    }
  });

  const bounds = L.latLngBounds([]);
  if (Array.isArray(data.spillPolygon)) bounds.extend(data.spillPolygon);
  if (data.originPoint) bounds.extend([data.originPoint.lat, data.originPoint.lng]);
  if (Array.isArray(data.driftPath)) bounds.extend(data.driftPath);
  (data.candidates || []).forEach((vessel) => {
    if (Array.isArray(vessel.trackHistory)) bounds.extend(vessel.trackHistory);
  });
  if (bounds.isValid()) reportMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
}

function format(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : '-';
}

function formatQuantity(data) {
  const range = (data.oilQuantity || data.oilQuantityEstimate || {}).quantity_range_tonnes || {};
  return Number.isFinite(Number(range.min)) ? `${format(range.min)}-${format(range.max)} tonnes` : 'Unavailable';
}

function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function setupReportActions() {
  document.getElementById('print-report')?.addEventListener('click', () => window.print());
  document.getElementById('save-report')?.addEventListener('click', () => {
    const report = document.getElementById('forensic-report-content')?.innerText || '';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    link.download = 'forensic-report.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  document.getElementById('export-report')?.addEventListener('click', () => window.print());
}

export function refreshReportMapSize() {
  if (reportMap) requestAnimationFrame(() => reportMap.invalidateSize());
}
