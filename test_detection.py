import cv2
import numpy as np
import os
import json
import time
import pytest
from yt_dlp import YoutubeDL
from backend.main import ProfessionalRouletteTracker, POCKETS

# Configuration
YOUTUBE_URL = "https://www.youtube.com/watch?v=C8QLePvWYdo"
VIDEO_FILE = "youtube_test_video.mp4"
ACTUAL_WINNING_NUMBER = 17
RESULTS_FILE = "test_results.json"

def download_video(url, output_path):
    if os.path.exists(output_path):
        return
    print(f"Downloading video from {url}...")
    ydl_opts = {
        'format': 'best[height<=720]',
        'outtmpl': output_path,
        'overwrites': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

@pytest.fixture(scope="module")
def test_video():
    download_video(YOUTUBE_URL, VIDEO_FILE)
    return VIDEO_FILE

def test_ball_detection_accuracy(test_video):
    tracker = ProfessionalRouletteTracker()
    cap = cv2.VideoCapture(test_video)

    frames_processed = 0
    ball_found_count = 0
    spinning_frames = 0
    confidences = []
    final_prediction = -1

    print("\nStarting video processing...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        result = tracker.process_frame(frame, dt=1/30.0)

        # Print confidence and prediction to console
        if frames_processed % 30 == 0:
            print(f"Frame {frames_processed}: Confidence={result['confidence']:.1f}%, Prediction={result['prediction']}")

        confidences.append(result['confidence'])

        # Track ball detection during the spinning phase
        if result['is_spinning']:
            spinning_frames += 1
            if result['ball_found']:
                ball_found_count += 1

        if result['prediction'] != -1:
            final_prediction = result['prediction']

        if result['spin_finished']:
            break

        frames_processed += 1

    cap.release()

    # Calculate ball identification rate during spinning phase
    ball_id_rate = (ball_found_count / spinning_frames) if spinning_frames > 0 else 0
    print(f"\nBall identification rate during spin: {ball_id_rate*100:.1f}%")

    # Assert: The tracker must identify the ball in at least 80% of the frames where the ball is clearly visible
    # We define "clearly visible" as being within the spinning phase
    assert ball_id_rate >= 0.80, f"Tracker identified ball in only {ball_id_rate*100:.1f}% of spinning frames (required >= 80%)"

    # Additional assertion for accuracy
    if final_prediction != -1:
        pred_idx = POCKETS.index(final_prediction)
        actual_idx = POCKETS.index(ACTUAL_WINNING_NUMBER)
        diff = abs(pred_idx - actual_idx)
        distance = min(diff, 38 - diff)
        assert distance <= 2, f"Prediction {final_prediction} was {distance} pockets away from {ACTUAL_WINNING_NUMBER} (required <= 2)"

    # Log results
    test_results = {
        "timestamp": time.ctime(),
        "frames_processed": frames_processed,
        "ball_id_rate": float(ball_id_rate),
        "avg_confidence": float(np.mean(confidences)) if confidences else 0,
        "final_prediction": int(final_prediction),
        "passed": True
    }

    results_history = []
    if os.path.exists(RESULTS_FILE):
        try:
            with open(RESULTS_FILE, 'r') as f:
                results_history = json.load(f)
        except: pass

    results_history.append(test_results)
    with open(RESULTS_FILE, 'w') as f:
        json.dump(results_history, f, indent=2)

if __name__ == "__main__":
    # If run directly, execute the test logic manually
    download_video(YOUTUBE_URL, VIDEO_FILE)
    try:
        test_ball_detection_accuracy(VIDEO_FILE)
        print("\nTest PASSED!")
    except AssertionError as e:
        print(f"\nTest FAILED: {e}")
