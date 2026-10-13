# GeoReference Lab — Advanced Mobile GIS Companion

## Included
- Responsive single-page app with Home, Map Lab, Accuracy, Learn and Projects tabs.
- Local map image preview (JPG, PNG, WebP).
- GCP manager with pixel and known coordinates, notes, CSV import and CSV export.
- Residual calculator and 2D RMSE summary.
- GIS learning lessons and a short quiz.
- Save/load project snapshots in browser local storage.
- JSON backup export and restore.
- Dark mode.
- PWA manifest and service worker for offline caching.

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser. Most functions work from a local file.
3. For PWA installation and service-worker offline caching, serve the folder over HTTPS or localhost. For example, from the extracted folder run `python -m http.server 8000`, then visit `http://localhost:8000` on that device.

## Important limitations
This is an educational and field-preparation app. It does **not** perform image georeferencing, estimate a transformation, warp pixels, or export a georeferenced GeoTIFF. The image is only previewed locally. For actual raster georeferencing, use QGIS Georeferencer or ArcGIS Pro.
The RMSE calculator reports the 2D root mean square of coordinate differences entered by the user. It cannot verify the CRS, coordinate quality, or whether validation points are independent.
Browser local storage may be cleared; export backups regularly. Uploaded image files are not included in project snapshots.
