#!/bin/bash

# Navigate to the python-backend directory
cd python-backend

# Check if Python is installed
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo "Error: Python is not installed"
    exit 1
fi

# Check if pip is installed
if command -v pip3 &>/dev/null; then
    PIP_CMD=pip3
elif command -v pip &>/dev/null; then
    PIP_CMD=pip
else
    echo "Error: pip is not installed"
    exit 1
fi

# Install requirements
echo "Installing Python dependencies..."
$PIP_CMD install -r requirements.txt

# Start the Flask app
echo "Starting Python backend on port 5000..."
$PYTHON_CMD app.py
