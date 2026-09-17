# Oil Spill Project

## Requirements

- Node.js 18 or newer
- npm

## Setup

Clone the repository and open the project folder:

```powershell
cd oil-spill-project
npm install
```

## Run the website

```powershell
npm start
```

Open:

```text
http://localhost:3000
```

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

## Development mode

```powershell
npm run dev
```
