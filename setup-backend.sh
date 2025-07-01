#!/bin/bash
# Setup script for Python backend

echo "Setting up Python backend..."

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install required packages
echo "Installing required packages..."
pip install --upgrade pip
pip install Flask==2.3.3 Flask-Cors==4.0.0 pandas==2.1.0 numpy==1.25.2 matplotlib==3.7.2 scikit-learn==1.3.0 requests==2.31.0 gunicorn==21.2.0

# Update CORS settings in app.py
echo "Updating CORS settings..."
sed -i 's/CORS(app)/CORS(app, resources={r"\/*": {"origins": "*"}})/' python-backend/app.py

echo "Setup complete! Start the backend with: cd python-backend && python app.py"
