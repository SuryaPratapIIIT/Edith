import json
import re
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append('backend')
from pace_engine import calculate_pace

with open('src/data/testCases.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Split into test cases by { id: 'TC-
cases_raw = re.split(r"\{\s*id:\s*'(TC-\d+)'", content)

print("=" * 80)
print("VELO AI - COMPREHENSIVE TEST CASE AUDIT REPORT")
print("=" * 80)

total_steps = 0
passed_steps = 0
failed_steps = 0

for i in range(1, len(cases_raw), 2):
    tc_id = cases_raw[i]
    body = cases_raw[i+1]
    
    title_m = re.search(r"title:\s*'([^']+)'", body)
    title = title_m.group(1) if title_m else "Unknown"
    
    len_m = int(re.search(r"length_m:\s*(\d+)", body).group(1))
    lim_kmh = float(re.search(r"limit_kmh:\s*(\d+)", body).group(1))
    margin = float(re.search(r"margin:\s*([0-9.]+)", body).group(1))
    amber_gap = float(re.search(r"amber_gap_kmh:\s*([0-9.]+)", body).group(1))
    
    print(f"\n[{tc_id}] {title}")
    print(f"  Section: {len_m}m | Limit: {lim_kmh} km/h | Margin: {margin*100}% | Amber Gap: {amber_gap} km/h")
    
    # Extract timestamps
    steps_raw = re.findall(
        r"timestampIndex:\s*([1-4]).*?"
        r"checkpointPercent:\s*(\d+).*?"
        r"elapsed_s:\s*([0-9.]+).*?"
        r"covered_m:\s*([0-9.]+).*?"
        r"speed_kmh:\s*([0-9.]+).*?"
        r"expectedCeiling_kmh:\s*(null|[0-9.]+).*?"
        r"expectedAlert:\s*'([^']+)'",
        body,
        re.DOTALL
    )
    
    for s in steps_raw:
        total_steps += 1
        idx, pct, elapsed_s, covered_m, speed_kmh, exp_ceil_raw, exp_alert = s
        elapsed_s = float(elapsed_s)
        covered_m = float(covered_m)
        speed_kmh = float(speed_kmh)
        exp_ceil = None if exp_ceil_raw == "null" else float(exp_ceil_raw)
        
        # Calculate with engine
        res = calculate_pace(len_m, lim_kmh, elapsed_s, covered_m, speed_kmh, margin, amber_gap)
        calc_ceil = res["ceiling_kmh"]
        calc_alert = res["alert"]
        calc_avg = res["current_avg_kmh"]
        banked = res["banked_time_s"]
        
        # Check ceiling
        if exp_ceil is None:
            ceil_ok = (res["state"] == "completed")
        else:
            ceil_ok = abs(calc_ceil - exp_ceil) <= 0.2
            
        alert_ok = (calc_alert == exp_alert)
        
        # Physical consistency check:
        # If speed_kmh at every step was >= 40, can calc_avg ever be 31?
        status = "PASS" if (ceil_ok and alert_ok) else "MISMATCH"
        if status == "PASS":
            passed_steps += 1
        else:
            failed_steps += 1
            
        print(f"  CP {pct}% (t={elapsed_s:.0f}s, dist={covered_m:.0f}m):")
        print(f"     Speed: {speed_kmh:.1f} km/h | Engine Avg: {calc_avg:.1f} km/h | Banked: {banked:+}s")
        print(f"     Ceiling -> Engine: {calc_ceil} | Expected: {exp_ceil} [{'OK' if ceil_ok else 'FAIL'}]")
        print(f"     Alert   -> Engine: {calc_alert} | Expected: {exp_alert} [{'OK' if alert_ok else 'FAIL'}]")
        if status != "PASS":
            print(f"     >>> AUDIT WARNING on {tc_id} CP{pct}%: Expected ceil={exp_ceil}, alert={exp_alert}")

print("\n" + "=" * 80)
print(f"AUDIT SUMMARY: Total: {total_steps} | Passed: {passed_steps} | Failed: {failed_steps}")
print("=" * 80)
