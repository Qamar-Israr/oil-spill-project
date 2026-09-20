import { listIncidents, deleteIncident, formatArchiveId } from './archive.js';

export function renderIncidentsArchive(options) {
  const body = document.getElementById('incidents-body');
  const table = document.getElementById('incidents-table');
  const empty = document.getElementById('incidents-empty');
  const count = document.getElementById('incidents-count');
  if (!body || !table || !empty || !count) return;

  const records = listIncidents();
  count.textContent = `${records.length} ${records.length === 1 ? 'record' : 'records'}`;
  table.hidden = records.length === 0;
  empty.hidden = records.length !== 0;
  body.replaceChildren(...records.map((record) => buildRow(record, options)));
}

export function setArchiveStatus(message, isError = false) {
  const status = document.getElementById('incidents-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'normal';
}

function buildRow(record, options) {
  const data = record.data || {};
  const archiveId = formatArchiveId(record.no);
  const isActive = Boolean(options.activeId) && data.id === options.activeId;

  const row = document.createElement('tr');
  row.className = 'incident-row' + (isActive ? ' active' : '');
  row.title = [data.title, data.region].filter(Boolean).join(' - ');
  if (isActive) row.setAttribute('aria-current', 'true');
  row.addEventListener('click', () => options.onOpen(record));

  const idCell = document.createElement('td');
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'incident-open text-cyan';
  openButton.textContent = archiveId;
  openButton.setAttribute('aria-label', `Open incident ${archiveId}`);
  idCell.appendChild(openButton);
  if (record.sample) {
    const tag = document.createElement('span');
    tag.className = 'incident-tag';
    tag.textContent = 'SAMPLE';
    idCell.appendChild(tag);
  }

  const date = parseDate(data.acquiredUtc) || parseDate(record.savedAt);
  const dateCell = document.createElement('td');
  dateCell.textContent = date ? formatDate(date) : '-';
  if (date) dateCell.title = formatTimestamp(date);

  const areaCell = document.createElement('td');
  areaCell.textContent = formatArea(data.spillAreaKm2);

  const confCell = document.createElement('td');
  confCell.textContent = formatConfidence(data.detectionConfidence);

  const vesselsCell = document.createElement('td');
  vesselsCell.textContent = Array.isArray(data.candidates) ? String(data.candidates.length) : '-';

  const actionCell = document.createElement('td');
  actionCell.className = 'col-actions';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'incident-delete';
  deleteButton.textContent = '×';
  deleteButton.setAttribute('aria-label', `Delete incident ${archiveId}`);
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!window.confirm(`Delete ${archiveId} from the archive?`)) return;
    deleteIncident(record.no);
    renderIncidentsArchive(options);
  });
  actionCell.appendChild(deleteButton);

  row.append(idCell, dateCell, areaCell, confCell, vesselsCell, actionCell);
  return row;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(' UTC', 'Z').replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date) {
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  const showYear = date.getUTCFullYear() !== new Date().getUTCFullYear();
  return showYear ? `${label} ${date.getUTCFullYear()}` : label;
}

function formatTimestamp(date) {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function formatArea(value) {
  const area = Number(value);
  if (value == null || !Number.isFinite(area)) return '-';
  return `${area.toFixed(area >= 1 ? 1 : 2)}km²`;
}

function formatConfidence(value) {
  const confidence = Number(value);
  if (value == null || !Number.isFinite(confidence)) return '-';
  return `${Math.round(confidence)}%`;
}