# Meteorite Dashboard - JavaScript Version

A pure JavaScript implementation of the meteorite landings interactive dashboard using Leaflet.js for mapping and Chart.js for visualizations.

## Features

- **Interactive Map**: Leaflet.js map with marker clustering
- **Real-time Filtering**: Filter by meteorite class, year range, and mass categories
- **Country Selection**: Click on meteorites to focus on specific countries
- **6 Chart Types**: Various visualizations that update based on filters and selection
- **Responsive Design**: Works on different screen sizes

## Files

- `meteorite-dashboard.html` - Main HTML file with styling
- `meteorite-dashboard.js` - JavaScript functionality
- `Meteorite_Landings_Processed.csv` - Data file (required)

## Libraries Used

- **Leaflet.js** - Interactive maps
- **Leaflet.markercluster** - Marker clustering functionality
- **Chart.js** - Data visualizations
- **PapaParse** - CSV parsing

## How to Run

1. Ensure you have the `Meteorite_Landings_Processed.csv` file in the parent directory (`../`)
2. Start a local HTTP server (e.g., `python3 -m http.server 8080`)
3. Open `http://localhost:8080/javascript-dashboard/meteorite-dashboard.html` in a web browser
4. The dashboard will automatically load and display the data

## Controls

- **Class Filter**: Checkboxes to select multiple meteorite class types
- **Year Range**: Dual sliders to set year range (860-2020)
- **Mass Classes**: Checkboxes to filter by mass categories:
  - ≤100g
  - 1-5kg
  - 5-10kg
  - 20+kg
- **Reset Country**: Button to clear country selection and show global data

## Charts

1. **Occurrences by Year** - Bar chart showing meteorites per year
2. **Cumulative Sightings** - Line chart of total discoveries over time
3. **Mass Distribution by Class** - Box/violin plots of mass by class
4. **Top Meteorite Classes** - Horizontal bar chart of most common classes
5. **Mass vs Year Scatter** - Scatter plot colored by class
6. **Geographic Distribution** - Bar chart of meteorites by country

## Map Interaction

- **Clustering**: Markers automatically cluster at lower zoom levels
- **Click Clusters**: Click on clusters to zoom in and see subclusters
- **Click Markers**: Click on individual markers to select countries
- **Popup Info**: Hover over markers for detailed information

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript features
- Canvas API (for Chart.js)
- Modern CSS features

## Data Source

Uses the processed meteorite landings dataset with the following fields:
- Location (latitude/longitude)
- Mass (in grams and kg)
- Year of discovery
- Meteorite class and type
- Country code

## Performance

- Displays all filtered points on the map (no artificial limits)
- Handles large datasets efficiently through clustering
- Charts update in real-time as filters change
- Optimized marker rendering with chunked loading