import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, patch, MagicMock, AsyncMock
import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import ProfessionalRouletteTracker, POCKETS, get_chrome_windows
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def tracker():
    with patch('main.mss.mss') as mock_mss:
        mock_monitor = {'width': 1920, 'height': 1080}
        mock_mss_instance = Mock()
        mock_mss_instance.monitors = [None, mock_monitor]
        mock_mss.return_value = mock_mss_instance

        t = ProfessionalRouletteTracker()
        t.monitor = mock_monitor
        return t

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def asgi_client():
    from backend.main import app_asgi
    from httpx import AsyncClient
    import asyncio
    return AsyncClient(app=app_asgi, base_url="http://test")

class TestProfessionalRouletteTracker:
    def test_init(self, tracker):
        assert tracker.state == "IDLE"
        assert tracker.calibrated == False
        assert tracker.frame_count == 0
        assert tracker.center == (1920 // 2, 1080 // 2)
        assert tracker.radius == 300

    def test_predict(self, tracker):
        result = tracker.predict(0.1, 0.15, 0.0, 0.0)
        assert result in POCKETS
        assert 0 <= result <= 37

    def test_predict_different_speeds(self, tracker):
        results = []
        for i in range(10):
            result = tracker.predict(0.1 + i * 0.01, 0.15 + i * 0.01, i * 0.1, i * 0.1)
            results.append(result)

        assert len(set(results)) > 1

    def test_is_within_range_exact_match(self, tracker):
        assert tracker.is_within_range(17, 17, 3) == True
        assert tracker.is_within_range(0, 0, 3) == True

    def test_is_within_range_adjacent(self, tracker):
        assert tracker.is_within_range(17, 34, 3) == True
        idx_0 = POCKETS.index(0)
        idx_37 = POCKETS.index(37)
        diff = abs(idx_0 - idx_37)
        circular_diff = min(diff, 38 - diff)
        expected = circular_diff <= 3
        assert tracker.is_within_range(0, 37, 3) == expected

    def test_is_within_range_too_far(self, tracker):
        assert tracker.is_within_range(17, 26, 3) == False

    def test_is_within_range_circular(self, tracker):
        idx_0 = POCKETS.index(0)
        idx_37 = POCKETS.index(37)
        diff = abs(idx_0 - idx_37)
        circular_diff = min(diff, 38 - diff)
        expected = circular_diff <= 3
        assert tracker.is_within_range(0, 37, 3) == expected
        assert tracker.is_within_range(37, 0, 3) == expected

        # Test actual adjacent numbers
        assert tracker.is_within_range(0, 28, 3) == True
        assert tracker.is_within_range(28, 0, 3) == True

    def test_detect_winning_number_not_calibrated(self, tracker):
        tracker.calibrated = False
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        result = tracker.detect_winning_number(frame, 0.0)
        assert result == -1

    def test_detect_winning_number_no_angle(self, tracker):
        tracker.calibrated = True
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        result = tracker.detect_winning_number(frame, None)
        assert result == -1

    @pytest.mark.asyncio
    async def test_run_initialization(self, tracker):
        with patch('main.mss.mss') as mock_mss, \
             patch('main.cv2.cvtColor') as mock_cvt, \
             patch('main.cv2.HoughCircles') as mock_circles, \
             patch.object(tracker, 'sct') as mock_sct:

            mock_sct.grab.return_value = np.zeros((1080, 1920, 4), dtype=np.uint8)
            mock_cvt.return_value = np.zeros((1080, 1920, 3), dtype=np.uint8)
            mock_circles.return_value = None

            task = asyncio.create_task(tracker.run())
            await asyncio.sleep(0.1)
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                pass

            assert tracker.frame_count > 0

    @pytest.mark.asyncio
    async def test_run_calibration(self, tracker):
        with patch('main.mss.mss'), \
             patch.object(tracker, 'sct') as mock_sct, \
             patch('main.cv2.cvtColor') as mock_cvt, \
             patch('main.cv2.HoughCircles') as mock_circles:

            mock_sct.grab.return_value = np.zeros((1080, 1920, 4), dtype=np.uint8)
            mock_cvt.return_value = np.zeros((1080, 1920, 3), dtype=np.uint8)

            circles = np.array([[[960, 540, 200]]], dtype=np.float32)
            mock_circles.return_value = circles

            task = asyncio.create_task(tracker.run())
            await asyncio.sleep(0.2)
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                pass

    @pytest.mark.asyncio
    async def test_state_transitions(self, tracker):
        tracker.calibrated = True
        tracker.last_ball_angle = 0.0
        tracker.ball_speed = 1.0

        tracker.state = "IDLE"
        ball_rpm = tracker.ball_speed * 60 / (np.pi * 2)

        assert ball_rpm > 0.5
        if ball_rpm > 0.5:
            tracker.state = "SPINNING"
            tracker.spin_start_time = 0.0

        assert tracker.state == "SPINNING"

class TestAPIEndpoints:
    def test_list_windows(self, client):
        with patch('main.get_chrome_windows') as mock_get:
            mock_get.return_value = [
                {'title': 'Test Tab', 'x': 0, 'y': 0, 'width': 1920, 'height': 1080}
            ]
            response = client.get("/api/windows")
            assert response.status_code == 200
            data = response.json()
            assert "windows" in data
            assert len(data["windows"]) > 0

    def test_list_windows_empty(self, client):
        with patch('main.get_chrome_windows') as mock_get:
            mock_get.return_value = []
            response = client.get("/api/windows")
            assert response.status_code == 200
            data = response.json()
            assert "windows" in data

    def test_select_window(self, client):
        with patch('main.tracker') as mock_tracker:
            mock_tracker.window_rect = None
            mock_tracker.selected_window = None
            mock_tracker.monitor = {'width': 1920, 'height': 1080}
            mock_tracker.center = (960, 540)

            window_data = {
                'title': 'Test Tab',
                'x': 100,
                'y': 100,
                'width': 800,
                'height': 600
            }

            response = client.post("/api/select-window", json=window_data)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["window"] == "Test Tab"

    def test_reset_window(self, client):
        with patch('main.tracker') as mock_tracker:
            mock_tracker.window_rect = {'top': 100, 'left': 100, 'width': 800, 'height': 600}
            mock_tracker.selected_window = 'Test Tab'
            mock_tracker.monitor = {'width': 1920, 'height': 1080}
            mock_tracker.center = (400, 300)

            response = client.post("/api/reset-window")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"

class TestChromeWindows:
    def test_get_chrome_windows_macos(self):
        with patch('platform.system', return_value='Darwin'):
            with patch('main.tracker') as mock_tracker:
                mock_tracker.monitor = {'width': 1920, 'height': 1080}

                try:
                    import Quartz
                    with patch('Quartz.CGWindowListCopyWindowInfo') as mock_quartz:
                        mock_quartz.return_value = [
                            {
                                'kCGWindowOwnerName': 'Google Chrome',
                                'kCGWindowName': 'Test Tab',
                                'kCGWindowLayer': 0,
                                'kCGWindowBounds': {'X': 0, 'Y': 0, 'Width': 1920, 'Height': 1080}
                            }
                        ]

                        windows = get_chrome_windows()
                        assert len(windows) > 0
                        assert windows[0]['title'] == 'Test Tab'
                except ImportError:
                    pass

    def test_get_chrome_windows_no_quartz(self):
        with patch('platform.system', return_value='Darwin'), \
             patch('main.tracker') as mock_tracker:
            mock_tracker.monitor = {'width': 1920, 'height': 1080}

            with patch.dict('sys.modules', {'Quartz': None}):
                windows = get_chrome_windows()
                assert len(windows) > 0

    def test_get_chrome_windows_non_macos(self):
        with patch('platform.system', return_value='Linux'), \
             patch('main.tracker') as mock_tracker:
            mock_tracker.monitor = {'width': 1920, 'height': 1080}

            windows = get_chrome_windows()
            assert len(windows) > 0
            assert windows[0]['title'] == 'Full Screen'

    def test_get_chrome_windows_filters_small_windows(self):
        with patch('platform.system', return_value='Darwin'):
            with patch('main.tracker') as mock_tracker:
                mock_tracker.monitor = {'width': 1920, 'height': 1080}

                try:
                    import Quartz
                    with patch('Quartz.CGWindowListCopyWindowInfo') as mock_quartz:
                        mock_quartz.return_value = [
                            {
                                'kCGWindowOwnerName': 'Google Chrome',
                                'kCGWindowName': 'Small Window',
                                'kCGWindowLayer': 0,
                                'kCGWindowBounds': {'X': 0, 'Y': 0, 'Width': 100, 'Height': 100}
                            },
                            {
                                'kCGWindowOwnerName': 'Google Chrome',
                                'kCGWindowName': 'Large Tab',
                                'kCGWindowLayer': 0,
                                'kCGWindowBounds': {'X': 0, 'Y': 0, 'Width': 1920, 'Height': 1080}
                            }
                        ]

                        windows = get_chrome_windows()
                        assert len(windows) == 1
                        assert windows[0]['title'] == 'Large Tab'
                except ImportError:
                    pass

class TestPocketDetection:
    def test_all_pockets_valid(self, tracker):
        for pocket in POCKETS:
            assert 0 <= pocket <= 37

    def test_pocket_count(self):
        assert len(POCKETS) == 38

    def test_pocket_uniqueness(self):
        assert len(set(POCKETS)) == len(POCKETS)

class TestPredictionAccuracy:
    def test_prediction_within_pockets(self, tracker):
        for _ in range(20):
            result = tracker.predict(0.1, 0.15, 0.0, 0.0)
            assert result in POCKETS

    def test_prediction_variety(self, tracker):
        results = set()
        for i in range(50):
            result = tracker.predict(
                0.1 + (i % 10) * 0.01,
                0.15 + (i % 10) * 0.01,
                (i % 10) * 0.1,
                (i % 10) * 0.1
            )
            results.add(result)

        assert len(results) > 5

@pytest.mark.asyncio
class TestAsyncOperations:
    async def test_socketio_connection(self):
        from main import sio
        assert sio is not None

    async def test_startup_event(self):
        with patch('main.tracker') as mock_tracker, \
             patch('asyncio.create_task') as mock_task:
            from main import startup_event
            await startup_event()
            mock_task.assert_called_once()

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=main", "--cov-report=html", "--cov-report=term"])
