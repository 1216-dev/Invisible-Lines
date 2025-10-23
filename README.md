
# Food Deserts and Health Inequality Dashboard

## 📌 Overview
"Food Deserts and Health Inequality: A Visual Exploration of Nutrition Access in America" is a comprehensive visual analytics dashboard that explores how geography, poverty, and public health variables interact to shape food access and obesity rates across U.S. counties.

This project was developed for CSE 564: Visual Analytics at Stony Brook University and meets the course requirements for:
- Interactive data visualizations
- Real-time linked brushing
- Advanced analytical methods (PCA, clustering, correlation analysis)
- Seamless storytelling in a scroll-free dashboard

---
![Food Desert Dashboard]([images/dashboard.png](https://github.com/1216-dev/Invisible-Lines/blob/main/dashboard.png))

## 🎯 Problem Statement
Millions of Americans live in "food deserts," with limited access to nutritious food. These areas often exhibit high obesity rates, child poverty, food insecurity, and chronic illness. Our goal was to:
> **Use visual analytics to investigate how food access, income, and regional disparities drive health inequality in the U.S.**

---

## 📊 Features

### 🌍 1. Choropleth Map – Adult Obesity
- County-level mapping of adult obesity rates
- Interactive pan, zoom, and click-to-select
- Linked brushing updates all other views in real time

### 📉 2. PCA + KMeans Scatter Plot
- Reduces high-dimensional features to 2D
- Clusters counties into 3 health risk groups
- Selection updates dynamically with linked highlighting

### 📌 3. Custom Scatter Plot
- Plots any two user-selected variables
- Bubble size = Health Burden Index
- Bubble color = Gradient of burden score

### 🪄 4. Parallel Coordinates
- Shows multivariate patterns across counties
- Interactive brushing, axis reordering
- Highlights patterns like low income + high obesity

### 🧮 5. Correlation Matrix
- Visualizes correlation between all variables
- Confirms insights like strong obesity-inactivity link (0.80)
- Adds statistical foundation to story

### 🍩 6. Cluster Distribution Chart
- Donut chart shows population per cluster
- Clickable segments for full-dashboard filtering

---

## 🧠 Health Burden Index
A composite metric used to summarize multiple health-related factors (e.g. obesity, smoking, food insecurity, income, inactivity) into a single value that indicates overall burden on health for each county. Used for:
- Bubble size scaling
- Analytical filtering
- Targeting high-risk zones

---

## ⚙️ Technologies Used
- **Frontend**: D3.js, HTML/CSS, JavaScript
- **Analytics**: PCA, KMeans (Scikit-learn), Pandas
- **Backend (optional)**: Python, Flask (for deployment)
- **Data Sources**:
  - USDA Food Access Research Atlas
  - CDC PLACES dataset
  - U.S. Census ACS
  - FEMA National Risk Index

---

## 📦 Interaction Capabilities
- ✅ Linked Brushing across all views
- ✅ Pan/Zoom & Click on GeoMap
- ✅ Drag-and-Drop Variable Selector (Scatter Plot)
- ✅ Axis Reordering (Parallel Coordinates)
- ✅ Real-time Highlighting
- ✅ Data Upload + Filter + Export

---

## 📂 Project Structure
```
root/
│
├── app/
│   ├── index.html
│   ├── dashboard.js
│   ├── styles.css
│   └── assets/
│       ├── choropleth.svg
│       ├── correlation_matrix.png
│       └── ...
├── data/
│   ├── processed_data.csv
│   └── cluster_results.json
├── notebooks/
│   └── PCA_KMeans_analysis.ipynb
└── README.md
```

---

## 🚀 Getting Started
1. Clone this repo
2. Open `index.html` in a browser
3. Use provided `cleaned_health_data.csv` or upload your own
4. Explore the dashboard using interactions and filters

---

## 📧 Contact
For questions, suggestions, or collaboration, feel free to reach us:

- Devshree Jadeja – [devshreehardik.jadeja@stonybrook.edu](mailto:devshreehardik.jadeja@stonybrook.edu)
- Divyansh Pradhan – [divyansh.pradhan@stonybrook.edu](mailto:divyansh.pradhan@stonybrook.edu)
