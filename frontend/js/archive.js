// Incident archive, persisted in the browser's localStorage.

const STORAGE_KEY = 'oilSpill.incidents.v1';

function emptyStore() {
  return { seq: 0, sampleSeeded: false, incidents: [] };
}

function readStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.incidents)) return emptyStore();

    const highestNo = parsed.incidents.reduce((max, record) => Math.max(max, Number(record.no) || 0), 0);
    return {
      ...emptyStore(),
      ...parsed,
      seq: Math.max(Number(parsed.seq) || 0, highestNo)
    };
  } catch (err) {
    console.warn('Incident archive could not be read:', err);
    return emptyStore();
  }
}

function writeStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    console.warn('Incident archive could not be saved:', err);
    return false;
  }
}

function addRecord(store, data, sample) {
  const record = {
    no: store.seq + 1,
    savedAt: new Date().toISOString(),
    sample,
    data
  };
  store.seq = record.no;
  store.incidents.push(record);
  return record;
}

export function formatArchiveId(no) {
  return `#${String(no).padStart(3, '0')}`;
}

export function listIncidents() {
  return readStore().incidents.sort((a, b) => b.no - a.no);
}

export function saveIncident(data) {
  const store = readStore();
  const record = addRecord(store, data, false);
  return writeStore(store) ? record : null;
}

export function seedSampleIncident(data) {
  const store = readStore();

  if (!store.sampleSeeded) {
    store.sampleSeeded = true;
    addRecord(store, data, true);
    writeStore(store);
    return;
  }

  const sample = store.incidents.find((record) => record.sample);
  if (sample && JSON.stringify(sample.data) !== JSON.stringify(data)) {
    sample.data = data;
    writeStore(store);
  }
}

export function deleteIncident(no) {
  const store = readStore();
  store.incidents = store.incidents.filter((record) => record.no !== no);
  return writeStore(store);
}