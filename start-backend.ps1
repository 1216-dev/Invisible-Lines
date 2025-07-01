# Navigate to the python-backend directory
cd python-backend

# Check if Python is installed
try {
    python --version
    $PYTHON_CMD = "python"
}
catch {
    try {
        py --version
        $PYTHON_CMD = "py"
    }
    catch {
        Write-Host "Error: Python is not installed"
        exit 1
    }
}

# Check if pip is installed
try {
    pip --version
    $PIP_CMD = "pip"
}
catch {
    Write-Host "Error: pip is not installed"
    exit 1
}

# Install requirements
Write-Host "Installing Python dependencies..."
& $PIP_CMD install -r requirements.txt

# Start the Flask app
Write-Host "Starting Python backend on port 5000..."
& $PYTHON_CMD app.py
