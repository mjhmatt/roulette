# Autonomous Roulette Tracker & Prediction System

A high-performance system for real-time monitoring and outcome prediction of physical roulette wheels using Computer Vision.

## 🎯 Project Goals

This repository aims to provide a fully autonomous pipeline for:
1.  **Automatic Wheel Identification**: Using Hough Circle transforms and color-based pocket detection to locate a roulette wheel in any video source.
2.  **Robust Ball Tracking**: Combining background subtraction and morphological operations to track the ball's movement across frames.
3.  **Real-time Physics Modeling**: Calculating wheel and ball RPM to estimate the ball's decay and landing pocket using a friction-based physics engine.
4.  **Low-Latency Overlay**: Providing a real-time telemetry HUD that can be overlaid on top of browser windows or video feeds.
5.  **Multi-Source Monitoring**: Ability to target specific browser tabs (e.g., Chrome) or full-screen video feeds for analysis.

## 🏗 Architecture

- **Backend (Python)**:
  - `OpenCV` for image processing and object tracking.
  - `FastAPI` for RESTful window management.
  - `Socket.IO` for streaming real-time telemetry at 60fps.
  - `mss` for high-speed screen capture.
- **Frontend (TypeScript)**:
  - `Three.js` for a high-performance transparent HUD.
  - `Socket.IO Client` for receiving telemetry data.
  - Automated UI for selecting monitoring targets.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- macOS (for window selection) or Windows/Linux (full screen only)

### Installation
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```

### Running the System
1. Start the Backend:
   ```bash
   python backend/main.py
   ```
2. Start the Frontend:
   ```bash
   npm start
   ```

## 🧪 Testing

### End-to-End Tests
```bash
npm run test:e2e
```

## 📜 License
ISC
