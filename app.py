from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from datetime import datetime
import json
import os
import csv
import secrets
import io

app = Flask(__name__)
# Enable CORS for all roots and all origins
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ===============================
# CONFIG
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_FILE = os.path.join(BASE_DIR, "logs.json")
KEYS_FILE = os.path.join(BASE_DIR, "api_keys.json")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")

API_HEADER = "X-API-KEY"

# ===============================
# HELPERS
# ===============================
def ensure_files():
    """Create data files and directories if they don't exist."""
    if not os.path.exists(LOGS_FILE):
        with open(LOGS_FILE, "w") as f:
            json.dump([], f)
    if not os.path.exists(KEYS_FILE):
        with open(KEYS_FILE, "w") as f:
            json.dump([], f)
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR)

def load_data(path):
    """Load JSON data from file safely."""
    ensure_files()
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

def save_data(path, data):
    """Save JSON data to file safely."""
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except IOError:
        pass

def validate_api_key():
    """Check if X-API-KEY header matches a generated key."""
    key = request.headers.get(API_HEADER)
    keys = load_data(KEYS_FILE)
    if not key or key not in keys:
        return False
    return True

# ===============================
# ROUTES
# ===============================

@app.route("/api/key/generate", methods=["POST"])
def generate_key():
    """Generate a new API key."""
    new_key = "uls_" + secrets.token_hex(16)
    keys = load_data(KEYS_FILE)
    keys.append(new_key)
    save_data(KEYS_FILE, keys)
    return jsonify({
        "status": "success",
        "api_key": new_key
    }), 201

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "success",
        "message": "API running"
    })

@app.route("/api/logs", methods=["GET"])
def get_logs():
    """Retrieve all logs (requires API key)."""
    if not validate_api_key():
        return jsonify({"status": "error", "message": "Invalid or missing API key"}), 401

    logs = load_data(LOGS_FILE)
    
    # Optional sorting: latest logs first
    try:
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    except:
        pass

    return jsonify({
        "status": "success",
        "logs": logs,
        "results": logs,  # Compatibility
        "count": len(logs)
    }), 200

@app.route("/api/logs", methods=["POST"])
def submit_log():
    """Add a new log entry (requires API key)."""
    if not validate_api_key():
        return jsonify({"status": "error", "message": "Invalid or missing API key"}), 401

    data = request.get_json(silent=True) or {}
    
    log_entry = {
        "timestamp": data.get("timestamp") or datetime.now().isoformat(),
        "service": data.get("service") or data.get("service_name") or "Unknown",
        "level": data.get("level") or data.get("log_level") or "INFO",
        "message": data.get("message", ""),
        "server": data.get("server") or data.get("server_id") or "Server-1",
        "trace_id": data.get("trace_id", "")
    }

    logs = load_data(LOGS_FILE)
    logs.append(log_entry)
    save_data(LOGS_FILE, logs)

    return jsonify({
        "status": "success",
        "message": "Log saved",
        "log": log_entry
    }), 201

@app.route("/api/logs/export", methods=["GET"])
def export_logs_csv():
    """Export all logs to CSV, save on server, and download."""
    if not validate_api_key():
        return jsonify({"status": "error", "message": "Invalid API key"}), 401

    logs = load_data(LOGS_FILE)
    if not logs:
        return jsonify({"status": "error", "message": "No logs to export"}), 400

    # Ensure export directory exists
    os.makedirs(EXPORT_DIR, exist_ok=True)
    
    # Generate unique filename for server-side storage
    filename = f"logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    server_path = os.path.join(EXPORT_DIR, filename)

    # Write CSV to server file
    try:
        with open(server_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["timestamp", "service", "level", "message", "server", "trace_id"]
            )
            writer.writeheader()
            writer.writerows(logs)
    except IOError as e:
        return jsonify({"status": "error", "message": f"Failed to save CSV: {str(e)}"}), 500

    # Return CSV as downloadable response
    return send_file(
        server_path,
        mimetype="text/csv",
        as_attachment=True,
        download_name="logs.csv"
    )

@app.route("/api/logs/clear", methods=["POST"])
def clear_logs():
    """Clear all stored logs (requires API key)."""
    if not validate_api_key():
        return jsonify({"status": "error", "message": "Invalid or missing API key"}), 401

    save_data(LOGS_FILE, [])
    return jsonify({
        "status": "success", 
        "message": "Logs cleared"
    }), 200

# ===============================
# MAIN
# ===============================
if __name__ == "__main__":
    ensure_files()
    print("====================================")
    print("  Universal Logging System Backend  ")
    print("====================================")
    print("API URL : http://localhost:5000")
    print("====================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
