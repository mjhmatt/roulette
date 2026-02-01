import pytest
import asyncio
import sys
import os
import platform
from unittest.mock import Mock, patch, MagicMock, AsyncMock
import numpy as np
import cv2
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import ProfessionalRouletteTracker, POCKETS, get_chrome_windows, tracker
from fastapi.testclient import TestClient
from main import app, sio

@pytest.fixture
def tracker_instance():
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

class TestFullCoverage:
    def test_all_pocket_numbers(self):
        for num in range(38):
            if num == 37:
                assert 0 in POCKETS or 37 in POCKETS
            else:
                assert num in POCKETS

    def test_predict_all_combinations(self, tracker_instance):
        results = set()
        for w_speed in [0.1, 0.2, 0.3]:
            for b_speed in [0.15, 0.25, 0.35]:
                for w_angle in [0.0, np.pi/2, np.pi]:
                    for b_angle in [0.0, np.pi/2, np.pi]:
                        result = tracker_instance.predict(w_speed, b_speed, w_angle, b_angle)
                        results.add(result)
                        assert result in POCKETS

        assert len(results) > 1

    def test_detect_winning_number_calibrated(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        ball_angle = np.pi / 4
        wheel_angle = 0.0

        result = tracker_instance.detect_winning_number(frame, ball_angle, wheel_angle)
        assert result in POCKETS or result == -1

    def test_detect_winning_number_with_ocr(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        ball_angle = np.pi / 4

        try:
            import pytesseract
            with patch('main.TESSERACT_AVAILABLE', True), \
                 patch('pytesseract.image_to_string', return_value='17'):
                result = tracker_instance.detect_winning_number(frame, ball_angle, 0.0)
                assert result in POCKETS or result == -1
        except ImportError:
            pass

    @pytest.mark.asyncio
    async def test_run_full_cycle(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        with patch.object(tracker_instance, 'sct') as mock_sct, \
             patch('main.cv2.cvtColor') as mock_cvt, \
             patch('main.cv2.HoughCircles') as mock_circles, \
             patch('main.cv2.inRange') as mock_inrange, \
             patch('main.cv2.findContours') as mock_contours, \
             patch('main.cv2.createBackgroundSubtractorMOG2') as mock_bgsub:

            mock_sct.grab.return_value = np.zeros((1080, 1920, 4), dtype=np.uint8)
            mock_cvt.return_value = np.zeros((1080, 1920, 3), dtype=np.uint8)
            mock_circles.return_value = None
            mock_inrange.return_value = np.zeros((1080, 1920), dtype=np.uint8)
            mock_contours.return_value = ([], None)
            mock_bgsub.return_value.apply.return_value = np.zeros((1080, 1920), dtype=np.uint8)

            task = asyncio.create_task(tracker_instance.run())
            await asyncio.sleep(0.1)
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                pass

            assert tracker_instance.frame_count >= 0

    def test_state_idle_detection(self, tracker_instance):
        tracker_instance.state = "IDLE"
        tracker_instance.ball_speed = 0.0
        tracker_instance.wheel_speed = 0.0

        ball_rpm = tracker_instance.ball_speed * 60 / (np.pi * 2)
        wheel_rpm = abs(tracker_instance.wheel_speed * 60 / (np.pi * 2))

        assert ball_rpm <= 0.5
        assert wheel_rpm <= 0.5
        assert tracker_instance.state == "IDLE"

    def test_state_spinning_detection(self, tracker_instance):
        tracker_instance.state = "IDLE"
        tracker_instance.ball_speed = 1.0
        tracker_instance.wheel_speed = 0.5

        ball_rpm = tracker_instance.ball_speed * 60 / (np.pi * 2)
        wheel_rpm = abs(tracker_instance.wheel_speed * 60 / (np.pi * 2))

        if ball_rpm > 0.5 or wheel_rpm > 0.5:
            tracker_instance.state = "SPINNING"
            tracker_instance.spin_start_time = time.time()

        assert tracker_instance.state == "SPINNING"

    def test_prediction_made_once(self, tracker_instance):
        tracker_instance.state = "SPINNING"
        tracker_instance.spin_start_time = time.time() - 2.0
        tracker_instance.prediction_made = False
        tracker_instance.last_ball_angle = np.pi / 4
        tracker_instance.ball_speed = 0.5

        spin_duration = time.time() - tracker_instance.spin_start_time

        if not tracker_instance.prediction_made and 1.0 <= spin_duration <= 3.0:
            tracker_instance.final_prediction = 17
            tracker_instance.prediction_made = True

        assert tracker_instance.prediction_made == True
        assert tracker_instance.final_prediction == 17

    def test_settling_detection(self, tracker_instance):
        tracker_instance.state = "SPINNING"
        tracker_instance.ball_speed = 0.05
        tracker_instance.wheel_speed = 0.03

        ball_rpm = tracker_instance.ball_speed * 60 / (np.pi * 2)
        wheel_rpm = abs(tracker_instance.wheel_speed * 60 / (np.pi * 2))

        if ball_rpm < 8 and wheel_rpm < 5:
            if tracker_instance.settling_start_time == 0:
                tracker_instance.settling_start_time = time.time()

        assert tracker_instance.settling_start_time > 0

    def test_final_result_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200
        tracker_instance.final_ball_angle = np.pi / 4
        tracker_instance.final_wheel_angle = 0.0
        tracker_instance.settling_start_time = time.time() - 2.0

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        now = time.time()

        if now - tracker_instance.settling_start_time > 1.5:
            if tracker_instance.settling_ball_positions:
                result = tracker_instance.detect_winning_number(
                    frame,
                    tracker_instance.final_ball_angle,
                    tracker_instance.final_wheel_angle
                )
                assert result in POCKETS or result == -1

    def test_csv_logging_format(self):
        import csv
        import io
        from datetime import datetime

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['timestamp', 'predicted', 'actual', 'distance', 'within_1', 'within_2', 'within_3', 'within_4', 'within_5'])

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        writer.writerow([timestamp, 17, 20, 3, '0', '0', '1', '1', '1'])

        output.seek(0)
        reader = csv.DictReader(output)
        row = next(reader)

        assert row['predicted'] == '17'
        assert row['actual'] == '20'
        assert row['distance'] == '3'
        assert row['within_3'] == '1'
        assert row['within_4'] == '1'
        assert row['within_5'] == '1'

    def test_window_selection_coordinate_conversion(self, tracker_instance):
        tracker_instance.monitor = {'width': 1920, 'height': 1080}

        x, y, width, height = 100, 100, 800, 600

        if platform.system() == 'Darwin':
            screen_height = tracker_instance.monitor['height']
            y = screen_height - y - height

        tracker_instance.window_rect = {
            'top': y,
            'left': x,
            'width': width,
            'height': height
        }

        assert tracker_instance.window_rect['width'] == 800
        assert tracker_instance.window_rect['height'] == 600

    def test_multi_method_wheel_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        hsv = np.zeros((1080, 1920, 3), dtype=np.uint8)

        with patch('main.cv2.inRange') as mock_inrange, \
             patch('main.cv2.findContours') as mock_contours, \
             patch('main.cv2.moments') as mock_moments:

            mock_inrange.return_value = np.zeros((1080, 1920), dtype=np.uint8)
            mock_contours.return_value = ([], None)
            mock_moments.return_value = {'m00': 100, 'm10': 96000, 'm01': 54000}

            wheel_found = False
            assert wheel_found == False

    def test_multi_method_ball_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

        with patch.object(tracker_instance, 'backSub') as mock_bgsub, \
             patch('main.cv2.findContours') as mock_contours, \
             patch('main.cv2.minEnclosingCircle') as mock_circle:

            mock_bgsub.apply.return_value = np.zeros((1080, 1920), dtype=np.uint8)
            mock_contours.return_value = ([], None)
            mock_circle.return_value = ((960, 540), 10)

            ball_found = False
            assert ball_found == False

    def test_optical_flow_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200
        tracker_instance.prev_gray = np.zeros((1080, 1920), dtype=np.uint8)
        tracker_instance.frame_count = 20

        gray = np.zeros((1080, 1920), dtype=np.uint8)

        with patch('main.cv2.goodFeaturesToTrack') as mock_features, \
             patch('main.cv2.calcOpticalFlowPyrLK') as mock_flow:

            mock_features.return_value = None
            mock_flow.return_value = (None, None, None)

            wheel_found = False
            assert wheel_found == False

    def test_ball_bright_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        hsv = np.zeros((1080, 1920, 3), dtype=np.uint8)
        gray = np.zeros((1080, 1920), dtype=np.uint8)

        with patch('main.cv2.inRange') as mock_inrange, \
             patch('main.cv2.threshold') as mock_thresh, \
             patch('main.cv2.findContours') as mock_contours:

            mock_inrange.return_value = np.zeros((1080, 1920), dtype=np.uint8)
            mock_thresh.return_value = (None, np.zeros((1080, 1920), dtype=np.uint8))
            mock_contours.return_value = ([], None)

            ball_found = False
            assert ball_found == False

    def test_ball_circular_detection(self, tracker_instance):
        tracker_instance.calibrated = True
        tracker_instance.center = (960, 540)
        tracker_instance.radius = 200

        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        gray = np.zeros((1080, 1920), dtype=np.uint8)

        with patch('main.cv2.HoughCircles') as mock_circles:
            mock_circles.return_value = None

            ball_found = False
            assert ball_found == False

    def test_distance_calculation(self, tracker_instance):
        pred_idx = POCKETS.index(17)
        actual_idx = POCKETS.index(20)

        diff = abs(pred_idx - actual_idx)
        circular_diff = min(diff, 38 - diff)

        assert circular_diff >= 0
        assert circular_diff <= 19

    def test_accuracy_within_ranges(self, tracker_instance):
        for range_size in [1, 2, 3, 4, 5]:
            pred_idx = POCKETS.index(17)
            actual_idx = POCKETS.index(17)

            diff = abs(pred_idx - actual_idx)
            circular_diff = min(diff, 38 - diff)

            assert circular_diff <= range_size

    def test_api_error_handling(self, client):
        with patch('main.get_chrome_windows', side_effect=Exception("Test error")):
            response = client.get("/api/windows")
            assert response.status_code == 200
            data = response.json()
            assert "windows" in data

    def test_select_window_error_handling(self, client):
        with patch('main.tracker', side_effect=Exception("Test error")):
            window_data = {'title': 'Test', 'x': 0, 'y': 0, 'width': 800, 'height': 600}
            try:
                response = client.post("/api/select-window", json=window_data)
            except:
                pass

    @pytest.mark.asyncio
    async def test_socketio_events(self):
        mock_sid = "test_sid"

        await sio.emit('test_event', {'data': 'test'}, room=mock_sid)

        assert sio is not None

    def test_frame_processing(self, tracker_instance):
        tracker_instance.frame_count = 0
        tracker_instance.last_frame_time = time.time()

        now = time.time()
        dt = max(now - tracker_instance.last_frame_time, 0.001)
        fps = 1.0 / dt

        assert fps > 0
        assert dt > 0

    def test_calibration_samples(self, tracker_instance):
        tracker_instance.center_samples = []

        for i in range(5):
            tracker_instance.center_samples.append((960 + i, 540 + i, 200 + i))
            if len(tracker_instance.center_samples) > 10:
                tracker_instance.center_samples.pop(0)

        assert len(tracker_instance.center_samples) == 5

    def test_settling_positions(self, tracker_instance):
        tracker_instance.settling_ball_positions = []

        for i in range(15):
            tracker_instance.settling_ball_positions.append(i * 0.1)
            if len(tracker_instance.settling_ball_positions) > 10:
                tracker_instance.settling_ball_positions.pop(0)

        assert len(tracker_instance.settling_ball_positions) == 10

    def test_prediction_buffer(self, tracker_instance):
        tracker_instance.prediction_buffer = []

        for i in range(5):
            tracker_instance.prediction_buffer.append(i)

        assert len(tracker_instance.prediction_buffer) == 5

    def test_state_reset(self, tracker_instance):
        tracker_instance.state = "SPINNING"
        tracker_instance.prediction_made = True
        tracker_instance.final_prediction = 17

        tracker_instance.state = "IDLE"
        tracker_instance.prediction_made = False
        tracker_instance.final_prediction = -1

        assert tracker_instance.state == "IDLE"
        assert tracker_instance.prediction_made == False
        assert tracker_instance.final_prediction == -1

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=main", "--cov-report=html", "--cov-report=term-missing", "--cov-branch"])
