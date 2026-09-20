# Oil Spill Project

## Requirements

- **Node.js 18 or newer** + npm
- **Python 3.10+** + pip

## Setup

Clone the repository and open the project folder:

```powershell
cd oil-spill-project
npm install
```

Install Python backend dependencies:

```powershell
cd backend
pip install -r requirements.txt
cd ..
```

## Run the application

###  — Two terminals 

**Terminal 1 — Backend (API server):**

```powershell
cd oil-spill-project\backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend (website):**

```powershell
cd oil-spill-project
npm start
```

Then open **http://localhost:3000** in your browser.

## Verify the backend

Open http://127.0.0.1:8000 in your browser. You should see:

```json
{"message": "Oil Spill Investigation API is running"}
```

## Run tests (backend)

```powershell
cd oil-spill-project\backend
pytest -v
```

## API usage

### Investigate a spill

`POST /api/investigate` accepts lat/lng/timestamp and an optional SAR image file.
Returns detected spill polygon, drift forecast, oil quantity estimate, and AIS vessel attribution.


## Oil quantity estimate

`POST /api/investigate` returns an `oil_quantity` object derived from the
detected `spill.area_km2`. It calculates `volume = area x estimated thickness`
and converts volume to tonnes using the configured oil density. Because this
prototype has no satellite-derived thickness measurement, the response is
explicitly labeled as an estimate and includes a quantity range.

The default assumed film thickness range is 1-10 micrometres and the default
oil density is 900 kg/m3. Override these assumptions with the environment
variables `OIL_FILM_THICKNESS_MIN_M`, `OIL_FILM_THICKNESS_MAX_M`, and
`OIL_DENSITY_KG_PER_M3` before starting the backend.

## Development mode (frontend auto-reload)

```powershell
npm run dev
```
