import pytest
import sys
import os
from unittest.mock import Mock, patch
import numpy as np

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

class TestProfessionalRouletteTracker:
    def test_init(self, tracker):
        assert tracker.state == "IDLE"
        assert tracker.calibrated == False
        assert tracker.frame_count == 0

    def test_is_within_range_adjacent(self, tracker):
        assert tracker.is_within_range(17, 34, 3) == True
        idx_0 = POCKETS.index(0)
        idx_37 = POCKETS.index(37)
        diff = abs(idx_0 - idx_37)
        circular_diff = min(diff, 38 - diff)
        expected = circular_diff <= 3
        assert tracker.is_within_range(0, 37, 3) == expected

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

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
