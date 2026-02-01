// @ts-ignore
import { io } from 'socket.io-client';

let currentPrediction = -1;
let bestPredictionThisSpin = -1;
let cvWheelRPM = 0;
let cvBallRPM = 0;
let isSpinning = false;
let wasSpinning = false;
let lastTelemetryTime = 0;
let frameCount = 0;

interface SpinResult {
  number: number;
  timestamp: string;
}
let spinHistory: SpinResult[] = JSON.parse(localStorage.getItem('roulette_history') || '[]');

function isRed(num: number): boolean {
  const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return reds.includes(num);
}

function saveResult(num: number) {
  if (num < 0 || num > 37) return;
  const result = { number: num, timestamp: new Date().toLocaleTimeString() };
  spinHistory.unshift(result);
  if (spinHistory.length > 20) spinHistory.pop();
  localStorage.setItem('roulette_history', JSON.stringify(spinHistory));

  const display = document.getElementById('predictionDisplay');
  if (display) {
    display.style.color = '#ffd700';
    setTimeout(() => { if (display) display.style.color = '#fff'; }, 1000);
  }
}

const socket = (io as any)('http://localhost:8000', {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

let wsConnected = false;
socket.on('connect', () => {
  wsConnected = true;
});
socket.on('disconnect', () => {
  wsConnected = false;
});

(window as any).cvSocket = socket;
(window as any).triggerBoardDetected = (data: any) => {
  // Simulate the socket event logic
  if (!boardDetected) {
    boardDetected = true;
    const notification = document.createElement('div');
    notification.id = 'boardNotification';
    notification.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,255,0,0.95); color:#000; padding:30px 50px; border-radius:15px; border:3px solid #00ff00; z-index:10000; font-size:24px; font-weight:bold; text-align:center; box-shadow:0 0 30px rgba(0,255,0,0.8); animation: pulse 2s infinite;';
    notification.innerHTML = `
      <div style="font-size:32px; margin-bottom:10px;">🎰</div>
      <div>ROULETTE BOARD DETECTED!</div>
      <div style="font-size:14px; margin-top:10px; opacity:0.8;">Monitoring: ${data.window || 'Full Screen'}</div>
      <div style="font-size:12px; margin-top:5px; opacity:0.6;">Center: (${data.center.x}, ${data.center.y}) | Radius: ${data.radius}</div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transition = 'opacity 1s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 1000);
      }
    }, 5000);
  }
};

(window as any).simulateCVUpdate = (data: any) => {
  const currentlySpinning = data.is_spinning || data.ball_rpm > 5;

  if (currentlySpinning) {
    if (data.prediction !== -1) {
      bestPredictionThisSpin = data.prediction;
    }
  } else {
    if (wasSpinning && bestPredictionThisSpin !== -1) {
      saveResult(bestPredictionThisSpin);
      bestPredictionThisSpin = -1;
    }
  }

  wasSpinning = currentlySpinning;
  currentPrediction = data.prediction;
  cvWheelRPM = data.wheel_rpm;
  cvBallRPM = data.ball_rpm;
  isSpinning = currentlySpinning;
  lastTelemetryTime = Date.now();
  frameCount++;
  (window as any).frameCount = frameCount;
  (window as any).currentPrediction = currentPrediction;
  (window as any).cvWheelRPM = cvWheelRPM;
  (window as any).cvBallRPM = cvBallRPM;
};

socket.on('prediction_update', (data: any) => {
  (window as any).cvCalibrated = data.calibrated || false;
  (window as any).cvBallFound = data.ball_found || false;
  (window as any).cvWheelFound = data.wheel_found || false;
  (window as any).simulateCVUpdate(data);
});

socket.on('spin_finished', (data: any) => {
  if (data.number !== -1) {
    saveResult(data.number);
    if (data.predicted !== undefined && data.actual !== undefined && data.predicted !== -1 && data.actual !== -1) {
      console.log(`Spin finished - Predicted: ${data.predicted}, Actual: ${data.actual}, Match: ${data.predicted === data.actual}`);
    }
  }
});

let boardDetected = false;
socket.on('board_detected', (data: any) => {
  if (!boardDetected) {
    boardDetected = true;
    console.log('🎰 Roulette board detected!', data);

    const notification = document.createElement('div');
    notification.id = 'boardNotification';
    notification.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,255,0,0.95); color:#000; padding:30px 50px; border-radius:15px; border:3px solid #00ff00; z-index:10000; font-size:24px; font-weight:bold; text-align:center; box-shadow:0 0 30px rgba(0,255,0,0.8); animation: pulse 2s infinite;';
    notification.innerHTML = `
      <div style="font-size:32px; margin-bottom:10px;">🎰</div>
      <div>ROULETTE BOARD DETECTED!</div>
      <div style="font-size:14px; margin-top:10px; opacity:0.8;">Monitoring: ${data.window || 'Full Screen'}</div>
      <div style="font-size:12px; margin-top:5px; opacity:0.6;">Center: (${data.center.x}, ${data.center.y}) | Radius: ${data.radius}</div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transition = 'opacity 1s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 1000);
      }
    }, 5000);

    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPSgjMGHm7A7+OZURAJR6Hh8sFvJgUwgM/y2Yk3CB1ou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEGMYfR89KCMwYebsDv45lREAlHoeHywW8mBTCAz/LZiTcIHWi77eefTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEALFF606euoVRQKRp/g8r5sIQYxh9Hz0oIzBh5uwO/jmVEQCUeh4fLBbyYFMIDP8tmJNwgdaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAsUXrTp66hVFApGn+DyvmwhBjGH0fPSgjMGHm7A7+OZURAJR6Hh8sFvJgUwgM/y2Yk3CB1ou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEGMYfR89KCMwYebsDv45lREAlHoeHywW8mBTCAz/LZiTcIHWi77eefTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEALFF606euoVRQKRp/g8r5sIQYxh9Hz0oIzBh5uwO/jmVEQCUeh4fLBbyYFMIDP8tmJNwgdaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAsUXrTp66hVFApGn+DyvmwhBjGH0fPSgjMGHm7A7+OZURAJR6Hh8sFvJgUwgM/y2Yk3CB1ou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEGMYfR89KCMwYebsDv45lREAlHoeHywW8mBTCAz/LZiTcIHWi77eefTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEALFF606euoVRQKRp/g8r5sIQYxh9Hz0oIzBh5uwO/jmVEQCUeh4fLBbyYFMIDP8tmJNwgdaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAsUXrTp66hVFApGn+DyvmwhBjGH0fPSgjMGHm7A7+OZURAJR6Hh8sFvJgUwgM/y2Yk3CB1ou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEGMYfR89KCMwYebsDv45lREAlHoeHywW8mBTCAz/LZiTcIHWi77eefTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEALFF606euoVRQKRp/g8r5sIQYxh9Hz0oIzBh5uwO/jmVEQCUeh4fLBbyYFMIDP8tmJNwgdaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAsUXrTp66hVFApGn+DyvmwhBjGH0fPSgjMGHm7A7+OZURAJR6Hh8sFvJgUwgM/y2Yk3CB1ou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEGMYfR89KCMwYebsDv45lRA==');
      audio.volume = 0.3;
      audio.play().catch(() => { });
    } catch (e) {
    }
  }
});

let availableWindows: any[] = [];
let selectedWindow: any = null;

async function loadWindows(retries = 3) {
  try {
    const response = await fetch('http://localhost:8000/api/windows');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    availableWindows = data.windows || [];
    updateWindowSelector();
  } catch (e) {
    if (retries > 0) {
      setTimeout(() => loadWindows(retries - 1), 1000);
    }
  }
}

async function selectWindow(windowData: any) {
  try {
    const response = await fetch('http://localhost:8000/api/select-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(windowData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    selectedWindow = windowData;
    updateWindowSelector();
  } catch (e) {
    console.error('Failed to select window:', e);
  }
}

async function resetWindow() {
  try {
    await fetch('http://localhost:8000/api/reset-window', { method: 'POST' });
    selectedWindow = null;
    updateWindowSelector();
  } catch (e) {
    console.error('Failed to reset window:', e);
  }
}

// UI Elements
const info = document.createElement('div');
info.id = 'info';
info.style.cssText = 'position:fixed; bottom:0; left:0; right:0; color:white; font-family:Arial; background:rgba(0,0,0,0.95); padding:15px 20px; border-top:3px solid #00ff00; z-index:100; box-shadow: 0 -5px 20px rgba(0,255,0,0.3); max-height:500px; overflow-y:auto;';
document.body.appendChild(info);

info.innerHTML = `
    <div id="telemetryPanel"></div>
    <div id="windowSelector" style="margin-top:15px; border-top:2px solid #00ff00; padding-top:15px; font-size:11px; background:rgba(0,0,0,0.3); padding:15px; border-radius:5px;"></div>
    <div id="statusFooter" style="margin-top:5px; padding:5px; background:rgba(0,255,0,0.2); border:1px solid #00ff00; border-radius:3px; font-size:9px; color:#00ff00; display:none;">✓ Board Detected & Monitoring</div>
`;

const telemetryPanel = document.getElementById('telemetryPanel')!;
const windowSelector = document.getElementById('windowSelector')!;
const statusFooter = document.getElementById('statusFooter')!;

document.body.style.cssText = 'margin:0; padding:0; background:#000; overflow:hidden;';

let lastWindowsJSON = "";
let lastSelectedWindowTitle = "";

function updateWindowSelector() {
  const currentWindowsJSON = JSON.stringify(availableWindows);
  const currentSelectedTitle = selectedWindow ? selectedWindow.title : "";

  if (currentWindowsJSON === lastWindowsJSON && currentSelectedTitle === lastSelectedWindowTitle) {
    return;
  }

  lastWindowsJSON = currentWindowsJSON;
  lastSelectedWindowTitle = currentSelectedTitle;

  windowSelector.innerHTML = `
    <div style="margin-bottom:10px; border-bottom:2px solid #00ff00; padding-bottom:8px;">
      <div style="font-size:12px; color:#ffd700; text-transform:uppercase; margin-bottom:8px; font-weight:bold;">📺 SELECT CHROME TAB TO MONITOR</div>
      ${selectedWindow ?
      `<div style="font-size:11px; color:#00ff00; padding:6px; background:rgba(0,255,0,0.1); border:1px solid #00ff00; border-radius:3px; margin-bottom:5px;">
         ✓ Monitoring: <strong>${selectedWindow.title.substring(0, 50)}${selectedWindow.title.length > 50 ? '...' : ''}</strong>
         <button id="resetWindowBtn" style="margin-left:10px; padding:4px 10px; background:#333; color:#fff; border:1px solid #00ff00; border-radius:3px; font-size:9px; cursor:pointer; font-weight:bold;">✕ Clear</button>
       </div>` :
      `<div style="font-size:11px; color:#ff4444; padding:8px; background:rgba(255,68,68,0.1); border:2px solid #ff4444; border-radius:3px; margin-bottom:8px; font-weight:bold;">
         ⚠️ NO TAB SELECTED - Click a tab below to start monitoring
       </div>`
    }
    </div>
    <div id="windowsList" style="max-height:200px; overflow-y:auto; border:2px solid #00ff00; border-radius:5px; padding:8px; background:rgba(0,0,0,0.5);">
      ${availableWindows.length > 0 ?
      availableWindows.map((w, i) =>
        `<div data-window-index="${i}" class="window-item" style="padding:10px; margin:5px 0; background:${selectedWindow && selectedWindow.title === w.title ? '#004400' : '#222'}; border:2px solid ${selectedWindow && selectedWindow.title === w.title ? '#00ff00' : '#555'}; border-radius:5px; font-size:11px; cursor:pointer; color:${selectedWindow && selectedWindow.title === w.title ? '#00ff00' : '#ccc'}; transition:all 0.2s; font-weight:${selectedWindow && selectedWindow.title === w.title ? 'bold' : 'normal'};">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:14px;">${selectedWindow && selectedWindow.title === w.title ? '✓' : '○'}</span>
              <div>${w.title.substring(0, 60)}${w.title.length > 60 ? '...' : ''}</div>
            </div>
            ${selectedWindow && selectedWindow.title === w.title ? '<div style="font-size:9px; color:#00ff00; margin-top:4px; padding-top:4px; border-top:1px solid #00ff00;">✓ ACTIVE - Monitoring this tab</div>' : ''}
          </div>`
      ).join('') :
      '<div style="font-size:11px; color:#888; padding:12px; text-align:center; border:1px dashed #555; border-radius:3px;">No Chrome tabs found<br/><br/>1. Open Chrome browser<br/>2. Open some tabs<br/>3. Click "Refresh Chrome Tabs" below</div>'
    }
    </div>
    <button id="refreshWindowsBtn" style="margin-top:10px; padding:10px 15px; background:#004400; color:#00ff00; border:2px solid #00ff00; border-radius:5px; font-size:12px; cursor:pointer; width:100%; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">🔄 Refresh Chrome Tabs</button>
  `;

  const resetBtn = windowSelector.querySelector('#resetWindowBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetWindow();
    });
  }

  const refreshBtn = windowSelector.querySelector('#refreshWindowsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      loadWindows();
    });
  }

  const windowsList = windowSelector.querySelector('#windowsList');
  if (windowsList) {
    windowsList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const windowItem = target.closest('.window-item') as HTMLElement;
      if (windowItem) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(windowItem.dataset.windowIndex || '0');
        if (availableWindows && availableWindows[index]) {
          selectWindow(availableWindows[index]);
        }
      }
    });
  }
}

function updateUI() {
  requestAnimationFrame(updateUI);

  const isReceivingData = (Date.now() - lastTelemetryTime) < 2000;
  const hasMotion = cvBallRPM > 0.1 || cvWheelRPM > 0.1;

  let motionStatus = 'WAITING FOR MOTION...';
  let motionColor = '#ff0000';

  if (hasMotion) {
    motionStatus = 'DETECTING MOTION';
    motionColor = '#00ff00';
  } else if (isReceivingData) {
    motionStatus = (window as any).cvCalibrated ? 'CALIBRATED & SCANNING' : 'SEARCHING FOR WHEEL...';
    motionColor = (window as any).cvCalibrated ? '#00ff00' : '#ffff00';
  }

  telemetryPanel.innerHTML = `
        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:10px; height:10px; border-radius:50%; background:${motionColor}; box-shadow:0 0 8px ${motionColor}"></div>
                <span style="font-size:12px; font-weight:bold; color:${motionColor}">${motionStatus}</span>
                <span style="font-size:10px; padding:2px 6px; border-radius:3px; background:${wsConnected ? '#004400' : '#440000'}; color:${wsConnected ? '#00ff00' : '#ff4444'}; border:1px solid ${wsConnected ? '#00ff00' : '#ff4444'}">
                    ${wsConnected ? 'WS: ON' : 'WS: OFF'}
                </span>
            </div>

            <div style="display:flex; align-items:center; gap:15px; background:rgba(0,255,0,0.1); padding:8px 15px; border:1px solid #00ff00; border-radius:5px;">
                <div>
                    <div style="font-size:9px; color:#00ff00; text-transform:uppercase; letter-spacing:1px;">
                        ${isSpinning ? '🔮 Prediction' : '🎯 Result'}
                    </div>
                    <div id="predictionDisplay" style="font-size:28px; font-weight:bold; color:#fff; text-shadow: 0 0 8px rgba(255,255,255,0.5); line-height:1;">
                        ${currentPrediction === -1 ? "---" : (currentPrediction === 37 ? '00' : currentPrediction)}
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:15px; font-size:11px;">
                <div style="background:#111; padding:6px 10px; border:1px solid #333; border-radius:3px;">
                    Wheel: <span style="color:#00ff00; font-weight:bold;">${cvWheelRPM.toFixed(1)} RPM</span>
                </div>
                <div style="background:#111; padding:6px 10px; border:1px solid #333; border-radius:3px;">
                    Ball: <span style="color:#00ff00; font-weight:bold;">${cvBallRPM.toFixed(1)} RPM</span>
                </div>
                <div style="background:#111; padding:6px 10px; border:1px solid #333; border-radius:3px; font-size:10px;">
                    State: <span style="color:#00ff00;">${isSpinning ? 'SPINNING' : 'IDLE'}</span>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px; margin-left:auto;">
                <div style="font-size:10px; color:#ffd700; text-transform:uppercase;">History:</div>
                <div style="display:flex; gap:4px; flex-wrap:wrap; max-width:400px;">
                    ${spinHistory.slice(0, 10).map(res => {
    const color = res.number === 0 || res.number === 37 ? '#008000' : (isRed(res.number) ? '#dc143c' : '#000000');
    return `<div title="${res.timestamp}" style="width:22px; height:22px; background:${color}; color:white; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:10px; font-weight:bold; border:1px solid #444;">${res.number === 37 ? '00' : res.number}</div>`;
  }).join('')}
                </div>
            </div>

            <div style="font-size:9px; color:#888; margin-left:10px;">
                F:${frameCount} | ${(window as any).cvCalibrated ? '✓' : '✗'} | B:${(window as any).cvBallFound ? '✓' : '✗'} | W:${(window as any).cvWheelFound ? '✓' : '✗'}
            </div>
        </div>
    `;

  if (boardDetected) {
    statusFooter.style.display = 'block';
  } else {
    statusFooter.style.display = 'none';
  }

  updateWindowSelector();
}

(window as any).selectWindow = (index: number) => {
  if (availableWindows && availableWindows[index]) {
    selectWindow(availableWindows[index]);
  }
};

(window as any).resetWindow = () => {
  resetWindow();
};

(window as any).loadWindows = () => {
  loadWindows();
};

setTimeout(() => loadWindows(), 2000);
setInterval(() => loadWindows(0), 10000);

updateUI();
