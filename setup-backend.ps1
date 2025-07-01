# Setup script for Python backend (Windows)

Write-Host "Setting up Python backend..." -ForegroundColor Green

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install required packages
Write-Host "Installing required packages..." -ForegroundColor Green
pip install --upgrade pip
pip install Flask==2.3.3 Flask-Cors==4.0.0 pandas==2.1.0 numpy==1.25.2 matplotlib==3.7.2 scikit-learn==1.3.0 requests==2.31.0 gunicorn==21.2.0

# Update CORS settings in app.py
Write-Host "Updating CORS settings..." -ForegroundColor Green
$content = Get-Content -Path python-backend\app.py -Raw
$content = $content -replace 'CORS$$app$$', 'CORS(app, resources={r"/*": {"origins": "*"}})'
Set-Content -Path python-backend\app.py -Value $content

Write-Host "Setup complete! Start the backend with: cd python-backend; python app.py" -ForegroundColor Green
