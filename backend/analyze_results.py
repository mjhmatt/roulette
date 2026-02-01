import csv
import os
from collections import defaultdict

POCKETS = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]

def get_distance(predicted, actual):
    if predicted == -1 or actual == -1:
        return -1
    try:
        pred_idx = POCKETS.index(predicted)
        actual_idx = POCKETS.index(actual)
        diff = abs(pred_idx - actual_idx)
        return min(diff, 38 - diff)
    except ValueError:
        return -1

def analyze_results(csv_file=None):
    if csv_file is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        csv_file = os.path.join(script_dir, 'spin_results.csv')

    if not os.path.exists(csv_file):
        print(f"CSV file not found: {csv_file}")
        return

    results = []
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                if 'predicted' in row and 'actual' in row:
                    predicted = int(row.get('predicted', -1))
                    actual = int(row.get('actual', -1))
                    distance_str = row.get('distance', '')

                    if actual != -1 and actual >= 0 and actual <= 37:
                        if predicted == -1:
                            continue

                        if distance_str and distance_str != '' and distance_str.strip() != '':
                            try:
                                dist = int(distance_str)
                            except ValueError:
                                dist = get_distance(predicted, actual)
                        else:
                            dist = get_distance(predicted, actual)

                        if dist == -1:
                            continue

                        results.append({
                            'predicted': predicted,
                            'actual': actual,
                            'distance': dist,
                            'timestamp': row.get('timestamp', '')
                        })
                elif 'number' in row:
                    actual = int(row.get('number', -1))
                    if actual != -1 and actual >= 0 and actual <= 37:
                        results.append({
                            'predicted': -1,
                            'actual': actual,
                            'distance': -1,
                            'timestamp': row.get('timestamp', '')
                        })
            except (ValueError, KeyError) as e:
                continue

    if not results:
        print("No valid results found in CSV file.")
        return

    print(f"\n=== ACCURACY ANALYSIS ===")
    print(f"Total valid spins: {len(results)}")
    print(f"\nAccuracy breakdown:")

    for range_size in [1, 2, 3, 4, 5]:
        within_range = sum(1 for r in results if r['distance'] <= range_size)
        pct = (within_range / len(results)) * 100
        print(f"  Within {range_size} number(s): {within_range}/{len(results)} ({pct:.1f}%)")

    avg_distance = sum(r['distance'] for r in results) / len(results)
    print(f"\nAverage distance: {avg_distance:.2f} pockets")

    exact_matches = sum(1 for r in results if r['distance'] == 0)
    print(f"Exact matches: {exact_matches}/{len(results)} ({(exact_matches/len(results)*100):.1f}%)")

    within5 = sum(1 for r in results if r['distance'] <= 5)
    pct5 = (within5 / len(results)) * 100
    print(f"\n{'✅' if pct5 >= 80 else '❌'} Within 5 numbers: {pct5:.1f}% (Requirement: >= 80%)")

    if pct5 < 80:
        print(f"\n⚠️  WARNING: Accuracy is below 80% threshold!")
    else:
        print(f"\n✅ SUCCESS: Accuracy meets 80% requirement!")

    print(f"\nRecent results (last 10):")
    for r in results[-10:]:
        print(f"  Predicted={r['predicted']}, Actual={r['actual']}, Distance={r['distance']}")

if __name__ == '__main__':
    analyze_results()
