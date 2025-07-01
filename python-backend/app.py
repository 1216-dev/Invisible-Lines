from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import requests
import tempfile
import os
import logging
import time
import platform
import flask
import sklearn

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes and origins

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the Python backend is running"""
    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "python_version": platform.python_version(),
        "dependencies": {
            "flask": flask.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "scikit-learn": sklearn.__version__
        }
    })

@app.route('/api/process', methods=['POST'])
def process_file():
    """Process uploaded CSV file"""
    try:
        logger.info("Received file upload request")
        
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
            
        file = request.files['file']
        aggregation_level = request.form.get('aggregationLevel', 'county')
        
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        if not file.filename.endswith('.csv'):
            return jsonify({"error": "File must be a CSV"}), 400
        
        # Read the CSV file
        df = pd.read_csv(file)
        logger.info(f"Successfully read CSV with {len(df)} rows")
        
        # Process the data
        result = process_data(df, aggregation_level)
        
        # Add flag to indicate Python backend was used
        result["usedPythonBackend"] = True
        
        logger.info("Data processing completed successfully")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/process-url', methods=['POST'])
def process_url():
    """Process data from a URL"""
    try:
        logger.info("Received URL processing request")
        data = request.json
        
        if not data or 'url' not in data:
            return jsonify({"error": "No URL provided"}), 400
            
        url = data['url']
        aggregation_level = data.get('aggregationLevel', 'county')
        
        # Download the CSV file
        logger.info(f"Downloading CSV from {url}")
        response = requests.get(url)
        
        if response.status_code != 200:
            return jsonify({"error": f"Failed to download file: {response.status_code}"}), 400
            
        # Save to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
            temp_file.write(response.content)
            temp_file_path = temp_file.name
        
        try:
            # Read the CSV file
            df = pd.read_csv(temp_file_path)
            logger.info(f"Successfully read CSV with {len(df)} rows")
            
            # Process the data
            result = process_data(df, aggregation_level)
            
            # Add flag to indicate Python backend was used
            result["usedPythonBackend"] = True
            
            logger.info("Data processing completed successfully")
            
            return jsonify(result)
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"Error processing URL: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def process_data(df, aggregation_level):
    """Process the data and return the result"""
    logger.info(f"Processing data with aggregation level: {aggregation_level}")
    
    # Ensure FIPS codes are strings and properly formatted
    if 'FIPS' in df.columns:
        df['FIPS'] = df['FIPS'].astype(str).str.zfill(5)
    
    # Standardize field names
    df = standardize_field_names(df)
    
    # Filter data to include only rows with valid identifiers
    df = filter_valid_data(df, aggregation_level)
    
    # Aggregate data if needed
    if aggregation_level != 'county':
        df = aggregate_data(df, aggregation_level)
    
    # Select important metrics
    metrics = select_metrics(df)
    
    # Calculate health burden index
    health_burden_index = calculate_health_burden_index(df)
    
    # Perform PCA and clustering
    pca_result, cluster_assignments, elbow_plot, optimal_clusters = perform_analysis(df, metrics)
    
    # Convert DataFrame to records for JSON serialization
    # Convert NaN → None so JSON is valid
    # Replace NaN, inf, -inf with None so it's JSON-safe
    df = df.replace([np.nan, np.inf, -np.inf], None)
    processed_data = df.to_dict('records')

    
    # Prepare the result
    result = {
        "rawData": processed_data,  # Include the raw data
        "processedData": processed_data,
        "metrics": metrics,
        "healthBurdenIndex": health_burden_index,
        "pcaResult": pca_result,
        "clusterAssignments": cluster_assignments,
        "elbowPlot": elbow_plot,
        "optimalClusters": optimal_clusters
    }
    
    return result

def standardize_field_names(df):
    """Standardize field names to ensure consistent access"""
    # Create a copy to avoid modifying the original
    df_copy = df.copy()
    
    # Standardize FIPS
    if 'fips' in df_copy.columns and 'FIPS' not in df_copy.columns:
        df_copy['FIPS'] = df_copy['fips']
    elif 'FIPS Code' in df_copy.columns and 'FIPS' not in df_copy.columns:
        df_copy['FIPS'] = df_copy['FIPS Code']
    
    # Standardize Name
    if 'County' in df_copy.columns and 'Name' not in df_copy.columns:
        df_copy['Name'] = df_copy['County']
    elif 'county' in df_copy.columns and 'Name' not in df_copy.columns:
        df_copy['Name'] = df_copy['county']
    elif 'NAME' in df_copy.columns and 'Name' not in df_copy.columns:
        df_copy['Name'] = df_copy['NAME']
    
    # Standardize State Abbreviation
    if 'State' in df_copy.columns and 'State Abbreviation' not in df_copy.columns:
        df_copy['State Abbreviation'] = df_copy['State']
    elif 'state' in df_copy.columns and 'State Abbreviation' not in df_copy.columns:
        df_copy['State Abbreviation'] = df_copy['state']
    
    return df_copy

def filter_valid_data(df, aggregation_level):
    """Filter data to include only rows with valid identifiers"""
    if aggregation_level == 'county':
        return df[df['FIPS'].notna() & df['Name'].notna() & df['State Abbreviation'].notna()]
    elif aggregation_level == 'state':
        return df[df['State Abbreviation'].notna()]
    else:  # region
        return df[df['State Abbreviation'].notna()]

def aggregate_data(df, aggregation_level):
    """Aggregate data based on aggregation level"""
    if aggregation_level == 'state':
        # Group by state
        group_field = 'State Abbreviation'
    else:  # region
        # Add region field
        df['Region'] = df['State Abbreviation'].apply(get_region_from_state)
        group_field = 'Region'
    
    # Get numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    # Aggregate
    agg_dict = {col: 'mean' for col in numeric_cols}
    aggregated = df.groupby(group_field).agg(agg_dict)
    
    # Add count
    aggregated[f'{group_field}Count'] = df.groupby(group_field).size()
    
    # Reset index to make the group field a column
    aggregated = aggregated.reset_index()
    
    return aggregated

def get_region_from_state(state_abbr):
    """Map state abbreviation to region"""
    regions = {
        # Northeast
        'CT': 'Northeast', 'ME': 'Northeast', 'MA': 'Northeast', 'NH': 'Northeast',
        'RI': 'Northeast', 'VT': 'Northeast', 'NJ': 'Northeast', 'NY': 'Northeast',
        'PA': 'Northeast',
        
        # Midwest
        'IL': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest', 'OH': 'Midwest',
        'WI': 'Midwest', 'IA': 'Midwest', 'KS': 'Midwest', 'MN': 'Midwest',
        'MO': 'Midwest', 'NE': 'Midwest', 'ND': 'Midwest', 'SD': 'Midwest',
        
        # South
        'DE': 'South', 'FL': 'South', 'GA': 'South', 'MD': 'South',
        'NC': 'South', 'SC': 'South', 'VA': 'South', 'WV': 'South',
        'AL': 'South', 'KY': 'South', 'MS': 'South', 'TN': 'South',
        'AR': 'South', 'LA': 'South', 'OK': 'South', 'TX': 'South',
        'DC': 'South',
        
        # West
        'AZ': 'West', 'CO': 'West', 'ID': 'West', 'MT': 'West',
        'NV': 'West', 'NM': 'West', 'UT': 'West', 'WY': 'West',
        'AK': 'West', 'CA': 'West', 'HI': 'West', 'OR': 'West',
        'WA': 'West'
    }
    
    return regions.get(state_abbr, 'Unknown')

def select_metrics(df):
    """Select important health and socioeconomic metrics"""
    important_metrics = [
        "Adult Obesity raw value",
        "Food Insecurity raw value",
        "Physical Inactivity raw value",
        "Poor or Fair Health raw value",
        "Median Household Income raw value",
        "Children in Poverty raw value",
        "Life Expectancy raw value",
        "Adult Smoking raw value",
        "Uninsured raw value",
        "Mental Health Providers raw value",
        "Unemployment raw value",
        "Income Inequality raw value",
        "Air Pollution - Particulate Matter raw value",
        "Severe Housing Problems raw value",
        "Insufficient Sleep raw value",
        "Broadband Access raw value",
        "Premature Death raw value",
        "Low Birthweight raw value",
        "Access to Exercise Opportunities raw value",
        "Primary Care Physicians raw value",
        "Food Environment Index raw value",
        "Dentists raw value",
        "Preventable Hospital Stays raw value",
        "Mammography Screening raw value",
        "Flu Vaccinations raw value",
        "High School Completion raw value",
        "Children in Single-Parent Households raw value",
        "Injury Deaths raw value",
        "Driving Alone to Work raw value",
        "Long Commute - Driving Alone raw value",
        "Voter Turnout raw value",
    ]
    
    # Filter to only include metrics that exist in the data
    available_metrics = [metric for metric in important_metrics if metric in df.columns]
    
    return available_metrics

def calculate_health_burden_index(df):
    """Calculate health burden index"""
    health_metrics = [
        "Adult Obesity raw value",
        "Food Insecurity raw value",
        "Physical Inactivity raw value",
        "Poor or Fair Health raw value",
    ]
    
    # Filter to only include metrics that exist in the data
    available_metrics = [metric for metric in health_metrics if metric in df.columns]
    
    if not available_metrics:
        # If none of the specific health metrics are available, use any available metrics
        available_metrics = [col for col in df.columns if 'raw value' in col]
    
    health_burden_index = {}
    
    for _, row in df.iterrows():
        # Determine the ID based on available fields
        if 'FIPS' in row and pd.notna(row['FIPS']):
            id_field = row['FIPS']
        elif 'State Abbreviation' in row and pd.notna(row['State Abbreviation']):
            id_field = row['State Abbreviation']
        elif 'Region' in row and pd.notna(row['Region']):
            id_field = row['Region']
        else:
            continue
        
        values = []
        for metric in available_metrics:
            if metric in row and pd.notna(row[metric]):
                value = row[metric]
                
                # Normalize percentage values
                if 0 <= value <= 1:
                    values.append(value)
                # Handle other numeric values
                elif isinstance(value, (int, float)):
                    # Simple normalization for demonstration
                    values.append(0.5)
        
        if values:
            health_burden_index[id_field] = sum(values) / len(values)
        else:
            health_burden_index[id_field] = 0.5  # Default value
    
    return health_burden_index

def perform_analysis(df, metrics):
    """Perform PCA and clustering analysis"""
    # Select features for analysis
    features = [m for m in metrics if m in df.columns][:8]  # Limit to 8 features
    
    if not features:
        # If no specific features are available, use any numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        features = numeric_cols[:8]  # Limit to 8 features
    
    # Extract feature data
    feature_data = df[features].copy()
    
    # Handle missing values
    feature_data = feature_data.fillna(feature_data.mean())
    
    # Standardize the data
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(feature_data)
    
    # Perform PCA
    pca = PCA(n_components=2)
    pca_result = pca.fit_transform(scaled_data)
    
    # Convert PCA result to list of dictionaries
    pca_data = [
        {"pc1": float(row[0]), "pc2": float(row[1]), "index": i}
        for i, row in enumerate(pca_result)
    ]
    
    # Determine optimal number of clusters using the elbow method
    max_clusters = min(10, len(df) // 5) if len(df) > 10 else 2
    max_clusters = max(max_clusters, 2)  # Ensure at least 2 clusters
    
    distortions = []
    silhouette_scores = []
    K_range = range(2, max_clusters + 1)
    
    for k in K_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(scaled_data)
        distortions.append(kmeans.inertia_)
        
        if k > 1 and len(df) > k:
            silhouette_scores.append(silhouette_score(scaled_data, kmeans.labels_))
    
    # Determine optimal number of clusters
    optimal_clusters = determine_optimal_clusters(K_range, distortions, silhouette_scores)
    
    # Generate elbow plot
    elbow_plot = generate_elbow_plot(K_range, distortions, optimal_clusters)
    
    # Perform clustering with optimal number of clusters
    kmeans = KMeans(n_clusters=optimal_clusters, random_state=42, n_init=10)
    cluster_assignments = kmeans.fit_predict(scaled_data).tolist()
    
    return pca_data, cluster_assignments, elbow_plot, optimal_clusters

def determine_optimal_clusters(K_range, distortions, silhouette_scores):
    """Determine the optimal number of clusters using the elbow method and silhouette scores"""
    if not distortions:
        return 5  # Default if no data
    
    # Calculate the rate of change in distortion
    deltas = [distortions[i-1] - distortions[i] for i in range(1, len(distortions))]
    
    # Normalize deltas
    if max(deltas) - min(deltas) > 0:
        normalized_deltas = [(d - min(deltas)) / (max(deltas) - min(deltas)) for d in deltas]
    else:
        normalized_deltas = [0.5] * len(deltas)
    
    # Find the elbow point (where the rate of change significantly decreases)
    elbow_index = 0
    for i in range(1, len(normalized_deltas)):
        if normalized_deltas[i] < 0.3 * normalized_deltas[0]:  # Threshold at 30% of initial delta
            elbow_index = i
            break
    
    # Consider silhouette scores if available
    if silhouette_scores:
        # Find the cluster number with the highest silhouette score
        max_silhouette_index = silhouette_scores.index(max(silhouette_scores))
        
        # Combine elbow method and silhouette score
        # If they're close, prefer the silhouette score
        if abs(elbow_index - max_silhouette_index) <= 1:
            optimal_index = max_silhouette_index
        else:
            # Otherwise, take the average (rounded)
            optimal_index = round((elbow_index + max_silhouette_index) / 2)
    else:
        optimal_index = elbow_index
    
    # Get the corresponding K value (add 2 because K_range starts at 2)
    optimal_clusters = K_range[optimal_index]
    
    return optimal_clusters

def generate_elbow_plot(K_range, distortions, optimal_clusters):
    """Generate the elbow plot as a base64 encoded image"""
    plt.figure(figsize=(10, 6))
    plt.plot(K_range, distortions, 'bo-')
    plt.xlabel('Number of Clusters (k)')
    plt.ylabel('Distortion (Inertia)')
    plt.title('Elbow Method for Optimal k')
    plt.grid(True, linestyle='--', alpha=0.7)
    
    # Highlight the optimal number of clusters
    optimal_index = K_range.index(optimal_clusters)
    plt.plot(optimal_clusters, distortions[optimal_index], 'ro', markersize=10, 
             label=f'Optimal k = {optimal_clusters}')
    plt.legend()
    
    # Save the plot to a bytes buffer
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Encode the image as base64
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    
    return f"data:image/png;base64,{img_str}"

if __name__ == '__main__':
    # Get port from environment variable or use default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
