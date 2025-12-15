# Meteorite Landings Interactive Dashboard

An interactive data visualization dashboard exploring NASA's meteorite landings dataset.

## Features

- **Interactive Map**: Explore meteorite landing locations with clustering
- **Dynamic Filtering**: Filter by year, mass class, and meteorite class
- **Country Selection**: Click on any meteorite to view country-specific data
- **Multiple Visualizations**:
  - Occurrences by Year
  - Cumulative Sightings Over Time
  - Mass Distribution by Class (Violin Plot)
  - Top Meteorite Classes
  - Mass vs Year Scatter Plot
  - Geographic Distribution

## Live Demo

Visit the live dashboard: [https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/](https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/)

## Technologies Used

- **Leaflet.js**: Interactive maps with marker clustering
- **Chart.js**: Data visualizations (bar charts, line charts, scatter plots)
- **Plotly.js**: Advanced violin plots and sunburst charts
- **PapaParse**: CSV data parsing
- **Web Workers**: Offload computations for better performance

## Local Development

To run locally:

```bash
python3 serve.py
```

Then open: http://127.0.0.1:8000/javascript-dashboard/meteorite-dashboard.html

## Data Source

Data from NASA's Open Data Portal: [Meteorite Landings](https://data.nasa.gov/Space-Science/Meteorite-Landings/gh4g-9sfh)

## License

MIT License - Feel free to use and modify for your own projects!
