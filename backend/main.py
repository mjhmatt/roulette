import cv2
import numpy as np
import mss
import time
import os
import platform

try:
    if platform.system() == 'Darwin':
        try:
            from AppKit import NSWorkspace, NSApplication
            APPKIT_AVAILABLE = True
        except ImportError:
            APPKIT_AVAILABLE = False
            print("Warning: AppKit (PyObjC) not available. Install with: pip3 install pyobjc")
    else:
        APPKIT_AVAILABLE = False
except:
    APPKIT_AVAILABLE = False
    print("Warning: Window selection not available on this platform")
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("Warning: pytesseract not available")


POCKETS = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]
WHEEL_FRICTION, BALL_FRICTION, GRAVITY = 0.9985, 0.996, 0.012

class ProfessionalRouletteTracker:
    def __init__(self):
        self.sct = mss.mss()
        self.selected_window = None
        self.window_rect = None
        self.monitor = self.sct.monitors[1]

        self.center = (self.monitor["width"] // 2, self.monitor["height"] // 2)
        self.radius = 300
        self.center_samples = []
        self.calibrated = False
        self.calibration_points = []
        self.M = None

        self.backSub = cv2.createBackgroundSubtractorMOG2(history=20, varThreshold=40, detectShadows=False)

        self.state = "IDLE"
        self.last_ball_angle = None
        self.last_wheel_angle = None
        self.wheel_speed = 0
        self.ball_speed = 0

        # Predictive tracking
        self.predicted_ball_angle = None
        self.missed_ball_frames = 0

        self.prediction_buffer = []
        self.last_frame_time = time.time()
        self.frame_count = 0
        self.ball_drop_detected = False
        self.last_prediction_time = 0
        self.spin_start_time = 0
        self.final_prediction = -1
        self.prediction_made = False
        self.actual_result = -1
        self.settling_start_time = 0
        self.settling_frames = 0
        self.final_ball_angle = None
        self.final_wheel_angle = None
        self.settling_ball_positions = []
        self.prev_gray = None
        self.confidence_score = 0.0
        self.detection_history = []
        self.ball_path = []
        self.ball_history = []
        self.frames_without_ball = 0
        self.debug_mode = False
        self.warped_frame = None

    def calibrate_perspective(self, frame):
        """
        Interactive calibration: User clicks 4 points on the wheel track.
        Maps to a perfect 500x500 square for flat circle representation.
        Returns the calibration matrix M.
        """
        display_frame = frame.copy()
        clicks = []

        def mouse_callback(event, x, y, flags, param):
            if event == cv2.EVENT_LBUTTONDOWN and len(clicks) < 4:
                clicks.append([x, y])

                # Visual feedback
                color = (0, 255, 0)
                cv2.circle(display_frame, (x, y), 8, color, -1)
                labels = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT']
                cv2.putText(display_frame, labels[len(clicks)-1], (x+15, y+15),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                cv2.imshow('Calibration - Click 4 Points', display_frame)

                print(f"[CALIBRATION] Point {len(clicks)}/4: {labels[len(clicks)-1]} at ({x}, {y})")

        # Create calibration window
        window_name = 'Calibration - Click 4 Points'
        cv2.imshow(window_name, display_frame)
        cv2.setMouseCallback(window_name, mouse_callback)

        print("\n" + "="*60)
        print("MANUAL CALIBRATION MODE")
        print("="*60)
        print("Click 4 points on the ball track in this order:")
        print("  1. TOP-CENTER of the track")
        print("  2. RIGHT-CENTER of the track")
        print("  3. BOTTOM-CENTER of the track")
        print("  4. LEFT-CENTER of the track")
        print("\nPress 'c' to confirm (after 4 clicks) or 's' to skip...")
        print("="*60 + "\n")

        # Wait for 4 clicks
        while True:
            key = cv2.waitKey(100) & 0xFF

            if key != 255 and len(clicks) == 4:  # A key was pressed after 4 clicks
                print(f"[DEBUG] Key detected: {key} (expecting 'c'={ord('c')} or 's'={ord('s')})")

            if key == ord('c') and len(clicks) == 4:
                print("\n[CALIBRATION] ✓ Confirmed!")
                break
            elif key == ord('s'):
                print("[CALIBRATION] Skipped - using auto-detection")
                cv2.destroyAllWindows()
                return None
            elif len(clicks) == 4:
                print("\n[CALIBRATION] All 4 points captured. Press 'c' to confirm...")

        cv2.destroyAllWindows()

        # Convert clicks to transformation matrix
        src_pts = np.array(clicks, dtype=np.float32)

        # Destination: perfect 500x500 square with points at cardinal positions
        dst_pts = np.array([
            [250, 0],     # Top-center
            [500, 250],   # Right-center
            [250, 500],   # Bottom-center
            [0, 250]      # Left-center
        ], dtype=np.float32)

        # Calculate perspective transform matrix
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)

        # Update tracker state
        self.M = M
        self.calibrated = True
        self.center = (250, 250)
        self.radius = 240
        self.calibration_points = src_pts

        print(f"\n[CALIBRATION] ✓ Perspective transform matrix calculated!")
        print(f"[CALIBRATION] Center: {self.center}, Radius: {self.radius}")
        print(f"[CALIBRATION] All frames will be warped to 500x500 flat circle\n")

        return M

    def initialize_calibration(self):
        """
        Synchronous calibration that opens a cv2 window and waits for 4 clicks.
        This runs BEFORE the async loop starts.
        """
        print("\n[CALIBRATION] Starting interactive calibration...")

        # List available windows
        windows = get_chrome_windows()
        print("\n" + "="*60)
        print("AVAILABLE WINDOWS/SCREENS:")
        print("="*60)
        for idx, win in enumerate(windows):
            print(f"  [{idx}] {win['title']}")
            print(f"       Size: {win['width']}x{win['height']} at ({win['x']}, {win['y']})")
        print("="*60)

        # Let user select window
        while True:
            try:
                choice = input("\nEnter window number to track (or 'f' for full screen, 's' to skip calibration): ").strip()

                if choice.lower() == 's':
                    print("[CALIBRATION] Skipped - using auto-calibration mode")
                    return
                elif choice.lower() == 'f':
                    print("[CALIBRATION] Using full screen")
                    break
                else:
                    idx = int(choice)
                    if 0 <= idx < len(windows):
                        win = windows[idx]
                        # Set window rect
                        x, y, width, height = win['x'], win['y'], win['width'], win['height']

                        # Handle macOS Retina scaling
                        if platform.system() == 'Darwin':
                            try:
                                from AppKit import NSScreen
                                main_screen = NSScreen.mainScreen()
                                backing_scale = main_screen.backingScaleFactor()
                                x *= backing_scale
                                y *= backing_scale
                                width *= backing_scale
                                height *= backing_scale
                                print(f"[DARWIN] Applied Retina scaling: {backing_scale}x")
                            except:
                                x *= 2
                                y *= 2
                                width *= 2
                                height *= 2
                                print("[DARWIN] Falling back to 2x Retina scaling")

                        self.window_rect = {
                            'top': int(y),
                            'left': int(x),
                            'width': int(width),
                            'height': int(height)
                        }
                        self.selected_window = win['title']
                        print(f"\n[WINDOW SELECTED] {win['title']}")
                        print(f"[DEBUG] Window rect set to: {self.window_rect}")
                        print(f"[DEBUG] This window should now be captured (not desktop)")
                        break
                    else:
                        print(f"Invalid choice. Please enter 0-{len(windows)-1}")
            except ValueError:
                print("Invalid input. Please enter a number.")

        # Give user time to prepare
        print("\nPreparing to capture frame for calibration...")
        time.sleep(2)

        # Capture a single frame
        sct_grab_params = self.window_rect if self.window_rect else self.monitor
        if self.window_rect:
            print(f"[DEBUG] Capturing window: {sct_grab_params}")
        else:
            print(f"[DEBUG] Capturing full screen: {sct_grab_params}")

        sct_img = self.sct.grab(sct_grab_params)
        img = np.array(sct_img)
        frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        print(f"[DEBUG] Captured frame size: {frame.shape[1]}x{frame.shape[0]}")

        # Show preview to verify correct window was captured
        preview = cv2.resize(frame, (800, 600))

        # Add text overlay with instructions
        overlay = preview.copy()
        cv2.putText(overlay, "Is this the roulette window?", (20, 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(overlay, "Press Y=Yes  N=No  S=Skip", (20, 80),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        window_name = 'PREVIEW - Verification'
        cv2.imshow(window_name, overlay)
        cv2.setWindowProperty(window_name, cv2.WND_PROP_TOPMOST, 1)

        print("\n" + "="*60)
        print("[VERIFICATION] Preview window is now OPEN!")
        print("="*60)
        print("CLICK on the green preview window to focus it, then:")
        print("  - Press 'y' if this is the CORRECT roulette window")
        print("  - Press 'n' if this is WRONG (will exit)")
        print("  - Press 's' to skip and continue anyway")
        print("="*60)
        print("Waiting for keypress...")

        while True:
            key = cv2.waitKey(100) & 0xFF
            if key != 255:  # A key was pressed
                print(f"[DEBUG] Key pressed: {key} (chr: {chr(key) if 32 <= key < 127 else 'special'})")

            if key == ord('y') or key == ord('Y'):
                cv2.destroyAllWindows()
                print("\n[✓] Correct window verified. Proceeding to calibration...")
                break
            elif key == ord('n') or key == ord('N'):
                cv2.destroyAllWindows()
                print("\n[✗] Incorrect window. Exiting...")
                print("TIP: Make sure the roulette window is visible and not minimized")
                import sys
                sys.exit(0)
            elif key == ord('s') or key == ord('S'):
                cv2.destroyAllWindows()
                print("\n[SKIPPED] Continuing anyway...")
                break
            elif key == 27:  # ESC key
                cv2.destroyAllWindows()
                print("\n[CANCELLED] Calibration cancelled")
                import sys
                sys.exit(0)

        # Call the calibration function
        M = self.calibrate_perspective(frame)

        if M is not None:
            print("[CALIBRATION] ✓ Calibration complete!")
        else:
            print("[CALIBRATION] Using auto-calibration mode")

    def set_calibration_points(self, points):
        """
        points: list of [x, y] in the order: top, right, bottom, left
        """
        self.calibration_points = np.array(points, dtype=np.float32)

        # Target points: top-center, right-center, bottom-center, left-center of 500x500
        dst_pts = np.array([
            [250, 0],     # Top
            [500, 250],   # Right
            [250, 500],   # Bottom
            [0, 250]      # Left
        ], dtype=np.float32)

        self.M = cv2.getPerspectiveTransform(self.calibration_points, dst_pts)
        self.calibrated = True
        self.center = (250, 250)
        self.radius = 240
        print(f"[CALIBRATION] Homography matrix calculated. Center: {self.center}, Radius: {self.radius}")

    def show_physics_view(self, warped_frame):
        """
        Debug window showing the warped (flattened) wheel with:
        - Static green ring (ball track)
        - Red line (ball's path history)
        This helps verify calibration accuracy.
        """
        if not self.debug_mode:
            return

        debug_frame = warped_frame.copy()
        center_x, center_y = self.center
        track_radius = self.radius

        # Draw static green ring (ball track)
        cv2.circle(debug_frame, (center_x, center_y), track_radius, (0, 255, 0), 3)
        cv2.circle(debug_frame, (center_x, center_y), track_radius - 20, (0, 255, 0), 1)
        cv2.circle(debug_frame, (center_x, center_y), track_radius + 20, (0, 255, 0), 1)

        # Draw center point
        cv2.circle(debug_frame, (center_x, center_y), 5, (255, 255, 0), -1)
        cv2.putText(debug_frame, "CENTER", (center_x + 10, center_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Draw ball's path history as red line
        if len(self.ball_history) >= 2:
            for i in range(1, len(self.ball_history)):
                pt1 = self.ball_history[i-1]
                pt2 = self.ball_history[i]
                # Draw with gradient (older = darker)
                intensity = int(255 * (i / len(self.ball_history)))
                cv2.line(debug_frame, pt1, pt2, (intensity, 0, 255 - intensity), 2)

        # Draw current ball position
        if self.ball_history:
            cv2.circle(debug_frame, self.ball_history[-1], 8, (0, 0, 255), -1)

        # Add info text
        info_y = 30
        cv2.putText(debug_frame, "PHYSICS VIEW - Warped Wheel", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        info_y += 30
        cv2.putText(debug_frame, f"History Points: {len(self.ball_history)}", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        info_y += 25
        cv2.putText(debug_frame, f"Confidence: {self.confidence_score:.1f}%", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        info_y += 25
        cv2.putText(debug_frame, f"Track Radius: {track_radius}px", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        info_y += 30

        # Instructions
        cv2.putText(debug_frame, "Green ring = Ball track", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        info_y += 20
        cv2.putText(debug_frame, "Red line = Ball path", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
        info_y += 20
        cv2.putText(debug_frame, "Press 'd' to toggle debug", (10, info_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        cv2.imshow('Physics View - Debug', debug_frame)
        cv2.waitKey(1)

    def preprocess_frame(self, frame):
        """
        Apply homography transformation to fix 3D tilt.
        Warps every frame using cv2.warpPerspective before ball detection.
        Turns tilted oval wheel into flat circle for physics engine.
        """
        if self.M is not None:
            return cv2.warpPerspective(frame, self.M, (500, 500))
        return frame

    def check_consistent_arc_with_declining_velocity(self):
        """
        Verify that the last 10 points in history form a consistent arc with declining velocity.
        Returns True only if the ball trajectory is stable and slowing down.
        """
        if len(self.ball_history) < 10:
            return False

        # Get last 10 points
        recent_points = self.ball_history[-10:]

        # Calculate velocities between consecutive points
        velocities = []
        for i in range(1, len(recent_points)):
            x1, y1 = recent_points[i-1]
            x2, y2 = recent_points[i]
            velocity = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            velocities.append(velocity)

        if len(velocities) < 5:
            return False

        # Check for declining velocity trend
        velocity_diffs = []
        for i in range(1, len(velocities)):
            velocity_diffs.append(velocities[i] - velocities[i-1])

        # Count how many velocity changes are negative (declining)
        declining_count = sum(1 for diff in velocity_diffs if diff < 0)

        # At least 60% should be declining
        is_declining = declining_count >= len(velocity_diffs) * 0.6

        # Check arc consistency: points should follow circular path
        center_x, center_y = self.center
        angles = []
        radii = []
        for x, y in recent_points:
            angle = np.arctan2(y - center_y, x - center_x)
            radius = np.sqrt((x - center_x)**2 + (y - center_y)**2)
            angles.append(angle)
            radii.append(radius)

        # Radial consistency: should stay roughly same distance from center
        radial_std = np.std(radii)
        radial_threshold = self.radius * 0.08 if self.radius else 30
        is_consistent_arc = radial_std < radial_threshold

        # Angular progression: should be monotonic (all increasing or all decreasing)
        angle_diffs = []
        for i in range(1, len(angles)):
            diff = (angles[i] - angles[i-1] + np.pi) % (np.pi * 2) - np.pi
            angle_diffs.append(diff)

        same_direction = all(d > 0 for d in angle_diffs) or all(d < 0 for d in angle_diffs)

        result = is_declining and is_consistent_arc and same_direction

        return result

    def predict(self, w_speed, b_speed, w_angle, b_angle):
        sw, sb = abs(w_speed), abs(b_speed)
        wa, ba = w_angle, b_angle
        dist = 5.1
        locked = False

        # More accurate physics simulation
        for step in range(5000):
            if locked:
                break

            wa += sw
            ba += sb

            sw *= WHEEL_FRICTION
            sb *= BALL_FRICTION

            # More accurate distance calculation
            centrifugal = sb * sb * dist * 0.0008
            dist += centrifugal - GRAVITY
            dist = max(dist, 4.0)

            # Lock when speeds match and ball is close to wheel
            if dist < 4.3 and abs(sb - sw) < 0.008:
                locked = True

        rel_angle = ((ba - wa) % (np.pi * 2) + (np.pi * 2)) % (np.pi * 2)
        pocket_idx = int((rel_angle / (np.pi * 2 / 38)) + 0.5) % 38
        return POCKETS[pocket_idx]

    def detect_winning_number(self, frame, ball_angle, wheel_angle=0):
        """Detect the actual winning number by reading it from the wheel pocket where ball stopped"""

        if not self.calibrated or ball_angle is None:
            return -1

        center_x, center_y = self.center

        # Calculate the position of the pocket where the ball is
        pocket_radius = self.radius * 0.75
        pocket_x = int(center_x + pocket_radius * np.cos(ball_angle))
        pocket_y = int(center_y + pocket_radius * np.sin(ball_angle))

        # Extract a larger region around the pocket to capture the number
        roi_size = 100
        x1 = max(0, pocket_x - roi_size)
        y1 = max(0, pocket_y - roi_size)
        x2 = min(frame.shape[1], pocket_x + roi_size)
        y2 = min(frame.shape[0], pocket_y + roi_size)

        if x2 <= x1 or y2 <= y1:
            return -1

        # Extract the pocket region
        roi = frame[y1:y2, x1:x2]

        # Save ROI for debugging
        try:
            cv2.imwrite('pocket_roi.jpg', roi)
        except:
            pass

        # Convert to grayscale
        roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

        # Try multiple preprocessing approaches
        detected_numbers = []

        # Approach 1: Look for white text on dark background
        _, thresh1 = cv2.threshold(roi_gray, 180, 255, cv2.THRESH_BINARY)
        detected_numbers.extend(self._ocr_on_image(thresh1))

        # Approach 2: Look for dark text on white background
        _, thresh2 = cv2.threshold(roi_gray, 100, 255, cv2.THRESH_BINARY_INV)
        detected_numbers.extend(self._ocr_on_image(thresh2))

        # Approach 3: Adaptive threshold
        thresh3 = cv2.adaptiveThreshold(roi_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        detected_numbers.extend(self._ocr_on_image(thresh3))

        # Approach 4: Enhanced contrast
        enhanced = cv2.equalizeHist(roi_gray)
        _, thresh4 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        detected_numbers.extend(self._ocr_on_image(thresh4))

        # Find the most common detected number
        if detected_numbers:
            from collections import Counter
            counter = Counter(detected_numbers)
            most_common = counter.most_common(1)[0]
            return most_common[0]

        # Fallback: Use angle-based calculation
        rel_angle = ((ball_angle - wheel_angle) % (np.pi * 2) + (np.pi * 2)) % (np.pi * 2)
        pocket_idx = int(rel_angle / (np.pi * 2 / 38)) % 38
        return POCKETS[pocket_idx]

    def _ocr_on_image(self, img):
        """Helper to run OCR on preprocessed image"""
        detected = []
        if TESSERACT_AVAILABLE:
            try:
                # Try different PSM modes for number recognition
                for psm in [7, 8, 10, 13]:
                    text = pytesseract.image_to_string(img, config=f'--psm {psm} -c tessedit_char_whitelist=0123456789')
                    text = text.strip().replace(' ', '').replace('\n', '')
                    if text.isdigit():
                        num = int(text)
                        if 0 <= num <= 37:
                            detected.append(num)
            except:
                pass
        return detected

    def is_within_range(self, predicted, actual, range_size=3):
        """Check if predicted number is within range_size pockets of actual"""
        pred_idx = POCKETS.index(predicted) if predicted in POCKETS else -1
        actual_idx = POCKETS.index(actual) if actual in POCKETS else -1

        if pred_idx == -1 or actual_idx == -1:
            return False

        # Calculate circular distance
        diff = abs(pred_idx - actual_idx)
        circular_diff = min(diff, 38 - diff)
        return circular_diff <= range_size

    def process_frame(self, frame, dt=0.016):
        """
        Standalone vision logic for a single frame.
        Returns: {'ball_coords': (x,y), 'zero_coords': (x,y), 'confidence': float, 'prediction': int, 'spin_finished': dict}
        """
        now = time.time()
        fps = 1.0 / dt if dt > 0 else 60.0

        # Apply homography transformation if calibrated
        if self.M is not None:
            frame = self.preprocess_frame(frame)
            self.warped_frame = frame.copy()
            self.center = (250, 250)
            self.radius = 240
            self.calibrated = True

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # --- STEP 1: AUTO-CALIBRATION ---
        if self.M is None and (not self.calibrated or self.frame_count % 60 == 0):
            best_circle = None
            for p2 in [15, 20, 25, 30]:
                circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, 1.2, 100, param1=50, param2=p2,
                                         minRadius=int(frame.shape[0]*0.1), maxRadius=int(frame.shape[0]*0.9))
                if circles is not None:
                    circles = np.uint16(np.around(circles))
                    for circle in circles[0]:
                        cx, cy, r = circle[0], circle[1], circle[2]
                        if 10 < cx < frame.shape[1]-10 and 10 < cy < frame.shape[0]-10:
                            self.center_samples.append((cx, cy, r))
                            if not best_circle: best_circle = (cx, cy, r)
                    break

            if not self.calibrated and not best_circle:
                edges = cv2.Canny(gray, 30, 100)
                contours, _ = cv2.findContours(cv2.dilate(edges, np.ones((3,3), np.uint8), iterations=1),
                                             cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if area > (frame.shape[0]*frame.shape[1])*0.05:
                        (cx, cy), r = cv2.minEnclosingCircle(cnt)
                        perimeter = cv2.arcLength(cnt, True)
                        circularity = 4 * np.pi * (area / (perimeter * perimeter)) if perimeter > 0 else 0
                        if circularity > 0.4:
                            self.center_samples.append((int(cx), int(cy), int(r)))
                            if not best_circle: best_circle = (int(cx), int(cy), int(r))

        if self.M is None and not self.calibrated and len(self.center_samples) >= 2:
            avg_pts = np.mean(self.center_samples, axis=0)
            self.center = (int(avg_pts[0]), int(avg_pts[1]))
            self.radius = int(avg_pts[2])
            self.calibrated = True
            print(f"[CALIBRATION] Locked: {self.center}, R={self.radius}")

        # --- STEP 2: TRACKING ---
        wheel_found = False
        ball_found = False
        gx, gy = None, None
        bx, by = None, None

        center_x, center_y = self.center if self.calibrated else (frame.shape[1] // 2, frame.shape[0] // 2)
        radius_check = self.radius if self.calibrated else int(min(frame.shape[0], frame.shape[1]) * 0.4)

        # Green marker (zero) detection
        green_mask = cv2.inRange(hsv, np.array([30, 30, 30]), np.array([90, 255, 255]))
        contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True):
            if 15 < cv2.contourArea(cnt) < 10000:
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    gx, gy = int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])
                    dist = np.sqrt((gx - center_x)**2 + (gy - center_y)**2)
                    if radius_check * 0.3 < dist < radius_check * 1.7:
                        wa = np.arctan2(gy - center_y, gx - center_x)
                        if self.last_wheel_angle is not None:
                            diff = (wa - self.last_wheel_angle + np.pi) % (np.pi * 2) - np.pi
                            self.wheel_speed = self.wheel_speed * 0.8 + abs(diff) * 0.2
                        self.last_wheel_angle = wa
                        wheel_found = True
                        break

        # Ball Detection (Background Subtraction)
        fgMask = self.backSub.apply(frame)
        fgMask = cv2.morphologyEx(fgMask, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
        fgMask = cv2.morphologyEx(fgMask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
        contours, _ = cv2.findContours(fgMask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True):
            area = cv2.contourArea(cnt)
            if 5 < area < 3000:
                (cur_bx, cur_by), _ = cv2.minEnclosingCircle(cnt)
                dist = np.sqrt(float(cur_bx-center_x)**2 + float(cur_by-center_y)**2)
                if not self.calibrated or (radius_check * 0.3 < dist < radius_check * 1.8):
                    ba = np.arctan2(cur_by - center_y, cur_bx - center_x)
                    if self.last_ball_angle is not None:
                        diff = (ba - self.last_ball_angle + np.pi) % (np.pi * 2) - np.pi
                        if 0.005 < abs(diff) < 3.0:
                            self.ball_speed = self.ball_speed * 0.8 + abs(diff) * 0.2
                            self.ball_drop_detected = True
                        else: self.ball_speed *= 0.98
                    else: self.ball_speed = 0.1
                    self.last_ball_angle, bx, by = ba, int(cur_bx), int(cur_by)
                    ball_found = True
                    break

        # Refined ball tracking history with strict noise filtering
        path_confidence = 1.0
        if ball_found:
            self.frames_without_ball = 0

            # Calculate Delta: distance from previous position
            should_add = True
            if self.ball_history:
                last_x, last_y = self.ball_history[-1]
                delta = np.sqrt((bx - last_x)**2 + (by - last_y)**2)

                # Strict noise filter: discard if > 30 pixels (ball can't teleport)
                if delta > 30:
                    should_add = False
                    path_confidence = 0.0

            if should_add:
                self.ball_history.append((bx, by))
                if len(self.ball_history) > 30:
                    self.ball_history.pop(0)

                # Track path in polar coordinates for physics
                self.ball_path.append((ba, dist))
                if len(self.ball_path) > 5:
                    self.ball_path.pop(0)

            if len(self.ball_path) >= 2:
                radii = [p[1] for p in self.ball_path]
                angles = [p[0] for p in self.ball_path]

                # Radial stability (distance from center should be constant)
                radial_std = np.std(radii)
                if radial_std > radius_check * 0.05:
                    path_confidence *= 0.5
                if radial_std > radius_check * 0.15:
                    path_confidence = 0.0

                # Angular consistency (no teleporting)
                angle_diffs = []
                for i in range(1, len(angles)):
                    diff = (angles[i] - angles[i-1] + np.pi) % (np.pi * 2) - np.pi
                    angle_diffs.append(abs(diff))

                if len(angle_diffs) > 0 and max(angle_diffs) > 2.0:
                    path_confidence = 0.0
        else:
            self.frames_without_ball += 1

            # Stricter reset: Clear history after 3 frames to avoid phantom predictions
            if self.frames_without_ball >= 3:
                self.ball_history = []
                self.ball_path = []
                self.confidence_score = 0.0
                self.detection_history = []

            path_confidence = 0.0

        # Update detection history with path confidence
        current_detection = path_confidence if (ball_found and wheel_found) else (path_confidence * 0.5 if (ball_found or wheel_found) else 0.0)
        self.detection_history.append(current_detection)
        if len(self.detection_history) > 60: self.detection_history.pop(0)
        self.confidence_score = np.mean(self.detection_history) * 100

        ball_rpm = self.ball_speed * fps * 60 / (np.pi * 2) if fps > 0 else 0
        wheel_rpm = abs(self.wheel_speed * fps * 60 / (np.pi * 2)) if fps > 0 else 0
        prediction = -1
        spin_finished_data = None

        if self.state == "IDLE":
            if (ball_rpm > 2.0 or wheel_rpm > 2.0) and (ball_found or wheel_found) and (self.ball_speed > 0.02 or self.wheel_speed > 0.02):
                self.state, self.spin_start_time, self.prediction_made = "SPINNING", now, False
                print(f"\n🎰 [SPIN STARTED]")
        elif self.state == "SPINNING":
            spin_duration = now - self.spin_start_time
            # Only predict if:
            # 1. Confidence is high enough
            # 2. We have at least 15 continuous valid points
            # 3. Last 10 points form consistent arc with declining velocity
            has_sufficient_history = len(self.ball_history) >= 15
            has_consistent_arc = self.check_consistent_arc_with_declining_velocity()

            # Debug: Show prediction blocking reasons every 2 seconds
            if not self.prediction_made and int(spin_duration) % 2 == 0 and self.frame_count % 60 == 0:
                print(f"[DEBUG] Prediction check: duration={spin_duration:.1f}s, confidence={self.confidence_score:.0f}%, history={len(self.ball_history)}, arc_ok={has_consistent_arc}")

            if not self.prediction_made and 1.0 <= spin_duration <= 3.0 and self.confidence_score > 50 and has_sufficient_history and has_consistent_arc:
                if ball_found and self.last_ball_angle is not None:
                    wheel_angle = self.last_wheel_angle if wheel_found else self.last_ball_angle
                    wheel_spd = self.wheel_speed if wheel_found else self.ball_speed * 0.35
                    preds = [self.predict(wheel_spd, self.ball_speed, wheel_angle, self.last_ball_angle) for _ in range(5)]
                    self.final_prediction, self.prediction_made = max(set(preds), key=preds.count), True
                    print(f"🎯 [PREDICTION] {self.final_prediction} (confidence: {self.confidence_score:.0f}%, ball RPM: {ball_rpm:.0f})")

            if self.prediction_made:
                prediction = self.final_prediction

            if ball_rpm < 8 and wheel_rpm < 5 and spin_duration >= 1.0:
                if self.settling_start_time == 0:
                    self.settling_start_time, self.settling_ball_positions = now, []
                    print(f"[DEBUG] Ball settling... RPM: ball={ball_rpm:.0f}, wheel={wheel_rpm:.0f}")
                if ball_found and self.last_ball_angle is not None:
                    self.settling_ball_positions.append(self.last_ball_angle)
                    if len(self.settling_ball_positions) > 10: self.settling_ball_positions.pop(0)
                if wheel_found: self.final_wheel_angle = self.last_wheel_angle

                if now - self.settling_start_time > 1.5 and spin_duration >= 2.0:
                    print(f"[DEBUG] Detecting final number... (settling samples: {len(self.settling_ball_positions)})")
                    if self.settling_ball_positions:
                        avg_ball_angle = np.mean(self.settling_ball_positions)

                        # Try to detect from video
                        self.actual_result = self.detect_winning_number(frame, avg_ball_angle, self.final_wheel_angle or 0)

                        # Save the final frame for manual verification
                        try:
                            cv2.imwrite('last_spin_result.jpg', frame)
                        except:
                            pass

                    final_num = self.actual_result if self.actual_result != -1 else self.final_prediction
                    spin_finished_data = {'number': int(final_num), 'predicted': int(self.final_prediction), 'actual': int(self.actual_result)}

                    # Calculate accuracy
                    distance = -1
                    status_icon = ""
                    if self.final_prediction != -1 and self.actual_result != -1:
                        pred_idx = POCKETS.index(self.final_prediction) if self.final_prediction in POCKETS else -1
                        actual_idx = POCKETS.index(self.actual_result) if self.actual_result in POCKETS else -1
                        if pred_idx != -1 and actual_idx != -1:
                            diff = abs(pred_idx - actual_idx)
                            distance = min(diff, 38 - diff)
                            if distance == 0:
                                status_icon = "✓"
                            elif distance <= 2:
                                status_icon = "✓"
                            elif distance <= 5:
                                status_icon = "~"
                            else:
                                status_icon = "✗"

                    # Clean log output
                    print(f"🎲 [RESULT] {status_icon} Predicted: {self.final_prediction} | Actual: {self.actual_result} | Distance: {distance if distance != -1 else 'N/A'} pockets\n")

                    # Reset state
                    self.state, self.prediction_made, self.final_prediction, self.actual_result, self.settling_start_time = "IDLE", False, -1, -1, 0
                    self.ball_history = []
                    self.ball_path = []
                    self.frames_without_ball = 0

        # Show Physics View debug window if enabled
        if self.debug_mode and self.warped_frame is not None:
            self.show_physics_view(self.warped_frame)

        self.frame_count += 1
        return {
            'ball_coords': (bx, by) if bx is not None else (None, None),
            'zero_coords': (gx, gy) if gx is not None else (None, None),
            'confidence': float(self.confidence_score),
            'prediction': int(prediction),
            'wheel_rpm': float(wheel_rpm),
            'ball_rpm': float(ball_rpm),
            'is_spinning': self.state == "SPINNING",
            'spin_finished': spin_finished_data,
            'ball_found': ball_found,
            'wheel_found': wheel_found
        }

    def run(self):
        """Main tracking loop - runs synchronously in terminal"""
        print(f"✓ Vision Engine Started")
        print(f"✓ Monitor: {self.monitor['width']}x{self.monitor['height']}")
        print(f"✓ Main tracking window will appear automatically")
        print(f"✓ Press 'v' to toggle main view | 'd' for debug | 'q' to quit\n")

        consecutive_errors = 0
        show_tracking_view = True  # Show by default

        while True:
            try:
                now = time.time()
                dt = max(now - self.last_frame_time, 0.001)
                self.last_frame_time = now

                # Capture screen
                sct_grab_params = self.window_rect if self.window_rect else self.monitor
                sct_img = self.sct.grab(sct_grab_params)
                img = np.array(sct_img)

                if img.size == 0:
                    time.sleep(0.5)
                    continue

                frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

                # Process frame
                result = self.process_frame(frame, dt)

                # Show live tracking view
                if show_tracking_view:
                    try:
                        self.show_tracking_view(frame, result)
                    except Exception as e:
                        print(f"[ERROR] Tracking view failed: {e}")
                        show_tracking_view = False

                # Check for keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('d'):
                    self.debug_mode = not self.debug_mode
                    status = "ENABLED" if self.debug_mode else "DISABLED"
                    print(f"[TOGGLE] Physics View {status}")
                    if not self.debug_mode:
                        cv2.destroyWindow('Physics View - Debug')
                elif key == ord('v'):
                    show_tracking_view = not show_tracking_view
                    status = "ENABLED" if show_tracking_view else "DISABLED"
                    print(f"[TOGGLE] Tracking View {status}")
                    if not show_tracking_view:
                        cv2.destroyWindow('Roulette Tracker - Live View')
                elif key == ord('q'):
                    print("\n[EXIT] Shutting down tracker...")
                    cv2.destroyAllWindows()
                    break

                time.sleep(0.01)

            except KeyboardInterrupt:
                print("\n[EXIT] Interrupted by user")
                cv2.destroyAllWindows()
                break
            except Exception as e:
                consecutive_errors += 1
                if consecutive_errors % 100 == 0:
                    print(f"[ERROR] {str(e)}")
                time.sleep(0.1)

    def show_tracking_view(self, frame, result):
        """Show live tracking window with overlays"""
        display = frame.copy()

        # Resize to fit screen better
        display = cv2.resize(display, (1280, 720))

        # Calculate scaling factors
        scale_x = 1280 / frame.shape[1]
        scale_y = 720 / frame.shape[0]

        # Draw wheel center and radius
        if self.calibrated:
            center_x = int(self.center[0] * scale_x)
            center_y = int(self.center[1] * scale_y)
            radius = int(self.radius * min(scale_x, scale_y))

            # Draw wheel circle
            cv2.circle(display, (center_x, center_y), radius, (0, 255, 0), 2)
            cv2.circle(display, (center_x, center_y), 5, (0, 255, 0), -1)

        # Draw ball position
        ball_x, ball_y = result['ball_coords']
        if ball_x is not None and ball_y is not None:
            scaled_x = int(ball_x * scale_x)
            scaled_y = int(ball_y * scale_y)
            cv2.circle(display, (scaled_x, scaled_y), 8, (0, 0, 255), -1)
            cv2.putText(display, "BALL", (scaled_x + 15, scaled_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

        # Status overlay
        y_pos = 30
        status_color = (0, 255, 0) if result['is_spinning'] else (100, 100, 100)
        cv2.putText(display, f"State: {self.state}", (10, y_pos),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        y_pos += 35

        cv2.putText(display, f"Confidence: {result['confidence']:.0f}%", (10, y_pos),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_pos += 30

        cv2.putText(display, f"Ball RPM: {result['ball_rpm']:.0f}", (10, y_pos),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_pos += 30

        cv2.putText(display, f"Wheel RPM: {result['wheel_rpm']:.0f}", (10, y_pos),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_pos += 30

        if result['prediction'] != -1:
            cv2.putText(display, f"PREDICTION: {result['prediction']}", (10, y_pos),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        # Instructions
        cv2.putText(display, "Press: d=Physics | v=Hide | q=Quit", (10, 710),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.imshow('Roulette Tracker - Live View', display)
        cv2.setWindowProperty('Roulette Tracker - Live View', cv2.WND_PROP_TOPMOST, 1)

def get_chrome_windows():
    """Get list of Chrome tabs - specifically Chrome browser tabs"""
    windows = []
    if platform.system() == 'Darwin':
        try:
            from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGWindowListExcludeDesktopElements, kCGNullWindowID

            window_list = CGWindowListCopyWindowInfo(
                kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
                kCGNullWindowID
            )

            chrome_windows = []
            for window in window_list:
                owner = window.get('kCGWindowOwnerName', '')
                if owner and ('Chrome' in owner or 'Chromium' in owner):
                    bounds = window.get('kCGWindowBounds', {})
                    name = window.get('kCGWindowName', 'Untitled')
                    layer = window.get('kCGWindowLayer', 0)

                    if layer == 0 and name and name != 'Untitled' and bounds:
                        width = int(bounds.get('Width', 0))
                        height = int(bounds.get('Height', 0))

                        if width > 400 and height > 300:
                            chrome_windows.append({
                                'title': str(name),
                                'x': int(bounds.get('X', 0)),
                                'y': int(bounds.get('Y', 0)),
                                'width': width,
                                'height': height
                            })

            chrome_windows.sort(key=lambda w: w['title'])
            windows = chrome_windows

        except ImportError:
            windows.append({
                'title': 'Full Screen',
                'x': 0,
                'y': 0,
                'width': 2560,
                'height': 1440
            })
        except Exception as e:
            print(f"Error getting windows: {e}")
            windows.append({
                'title': 'Full Screen',
                'x': 0,
                'y': 0,
                'width': 2560,
                'height': 1440
            })
    else:
        windows.append({
            'title': 'Full Screen',
            'x': 0,
            'y': 0,
            'width': 1920,
            'height': 1080
        })

    if not windows:
        windows.append({
            'title': 'Full Screen Fallback',
            'x': 0,
            'y': 0,
            'width': 1920,
            'height': 1080
        })

    return windows

if __name__ == "__main__":
    print("\n" + "="*60)
    print("ROULETTE TRACKER - TERMINAL MODE")
    print("="*60)

    tracker = ProfessionalRouletteTracker()
    tracker.initialize_calibration()

    print("\n" + "="*60)
    print("KEYBOARD SHORTCUTS:")
    print("  'v' - Toggle live tracking view")
    print("  'd' - Toggle Physics View (debug window)")
    print("  'q' - Quit")
    print("="*60 + "\n")

    tracker.run()
