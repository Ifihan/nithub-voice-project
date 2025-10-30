#!/bin/bash

# Audio Recording Web App - Start Script

echo "Starting Audio Recording Web App..."
echo "=================================="
echo ""

# Check if dependencies are installed
if ! python -c "import flask" 2>/dev/null; then
    echo "Installing dependencies..."
    uv pip install -e . || pip install flask flask-cors python-dotenv
    echo ""
fi

# Run the app
echo "Starting Flask server..."
echo "Open your browser and navigate to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python app.py
