import type { TestCaseScenario } from '../types/pace';

export const TEST_CASE_SCENARIOS: TestCaseScenario[] = [
  {
    id: 'TC-01',
    title: 'Sprint 1 Spec Reference Test (Doc Baseline)',
    description:
      'Evaluates vehicle GPS coordinates along Bengaluru-Mysuru Expressway against the ground truth specification (20 km, 100 km/h limit, 4% safety margin, T_min = 750s) across all 4 timestamps.',
    persona: 'Standard Driver / Algorithm Ground Truth',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 150,
          speed_kmh: 110
        },
        elapsed_s: 150,
        covered_m: 5000,
        speed_kmh: 110,
        expectedCeiling_kmh: 90.0,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Red alert! You are driving at 110 km/h. Maximum legal ceiling is 90 km/h. Slow down immediately.',
          hinglish: 'Red alert! Aap 110 pe hain. Legal ceiling 90 km/h ho gayi hai. Turant speed kam karein.'
        },
        explanation:
          'Vehicle GPS at [12.6680°N, 77.2420°E] (5.0 km from Gantry 1). Engine calculates 15,000m remaining in 600s budget = (15000/600)*3.6 = 90.0 km/h ceiling. Current speed 110 > 90.0 triggers RED alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 380,
          speed_kmh: 95
        },
        elapsed_s: 380,
        covered_m: 10000,
        speed_kmh: 95,
        expectedCeiling_kmh: 97.3,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Amber caution! Current speed is 95 km/h near the ceiling of 97.3 km/h. Hold steady.',
          hinglish: 'Amber caution! Aapki speed 95 km/h hai, ceiling 97.3 km/h ke paas. Speed maintain rakhein.'
        },
        explanation:
          'Vehicle GPS at [12.6280°N, 77.2150°E] (10.0 km mid-point). Engine calculates 10,000m remaining in 370s = 97.3 km/h ceiling. Speed 95 > (97.3 - 5 = 92.3) triggers AMBER alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 600,
          speed_kmh: 85
        },
        elapsed_s: 600,
        covered_m: 15000,
        speed_kmh: 85,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Optimal pace. Ceiling is restored to full posted limit 100 km/h. You are safely compliant.',
          hinglish: 'Badhiya pace. Safe ceiling wapas 100 km/h hai. Aap bilkul compliant hain.'
        },
        explanation:
          'Vehicle GPS at [12.6110°N, 77.2020°E] (15.0 km). Remaining 5,000m in 150s = 120 km/h raw, but engine strictly caps ceiling at posted limit 100.0 km/h. Speed 85 <= 95 triggers GREEN.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 780,
          speed_kmh: 80
        },
        elapsed_s: 780,
        covered_m: 20000,
        speed_kmh: 80,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Section complete! Total time 13 minutes. Average speed 92.3 km/h. Safe and challan-free.',
          hinglish: 'Section complete! Total time 13 minutes. Average speed 92.3 km/h raha. Zero challan!'
        },
        explanation:
          'Vehicle GPS at Channapatna Exit Gantry [12.6012°N, 77.1950°E]. Total time 780s >= T_min (750s). Average speed 92.3 km/h is below 96 km/h safe limit. State is done with GREEN.'
      }
    ]
  },
  {
    id: 'TC-02',
    title: 'Aggressive Start & Voice Pace Recovery (The YC Pitch Demo)',
    description:
      'Vehicle GPS trajectory shows rapid initial speed through Gantry 1, dynamically calculated pace deficit, subsequent recovery across Checkpoints 2 & 3, and challan-free exit.',
    persona: 'Expressway Rider (Bengaluru-Mysuru NH-275)',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 140,
          speed_kmh: 115
        },
        elapsed_s: 140,
        covered_m: 5000,
        speed_kmh: 115,
        expectedCeiling_kmh: 88.5,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Warning! Gantry 1 cleared too fast. Live ceiling reduced to 88.5 km/h. Slow down immediately.',
          hinglish: 'Warning! Gantry 1 bohot tez nikla. Maximum allowed speed ab 88.5 km/h hai. Turant dhere karein.'
        },
        explanation:
          'Vehicle reached 5km GPS waypoint in 140s. Engine calculates 610s budget remaining for 15km -> (15000/610)*3.6 = 88.5 km/h ceiling. Speed 115 > 88.5 triggers immediate RED warning.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 360,
          speed_kmh: 90
        },
        elapsed_s: 360,
        covered_m: 10000,
        speed_kmh: 90,
        expectedCeiling_kmh: 92.3,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Caution. Maintain pace below 92.3 km/h. You are recovering time budget.',
          hinglish: 'Dhyan deinge. Speed 92.3 km/h ke andar rakhein. Aapka time budget cover ho raha hai.'
        },
        explanation:
          'Vehicle reached 10km waypoint at elapsed 360s. Need 390s for remaining 10,000m -> (10000/390)*3.6 = 92.3 km/h ceiling. Speed 90 is within amber gap (92.3 - 5 = 87.3).'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 570,
          speed_kmh: 82
        },
        elapsed_s: 570,
        covered_m: 15000,
        speed_kmh: 82,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Pace normalized. Legal ceiling restored to 100 km/h. Keep cruising.',
          hinglish: 'Pace normal ho gaya hai. Safe speed wapas 100 km/h. Normal drive karein.'
        },
        explanation:
          'Vehicle reached 15km waypoint at 570s. Engine calculates time budget normalized to 100 km/h. Current speed 82 is comfortably below 95 km/h. GREEN state reached.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 775,
          speed_kmh: 85
        },
        elapsed_s: 775,
        covered_m: 20000,
        speed_kmh: 85,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Gantry 2 passed! Section completed legally. Average speed 92.9 km/h. Zero challan!',
          hinglish: 'Gantry 2 clear! Section safe complete hua. Average speed 92.9 km/h. Koi challan nahi!'
        },
        explanation:
          'Gantry 2 crossed at 775s (> 750s T_min). Sectional average 92.9 km/h is below 96 km/h safety limit. Zero challan!'
      }
    ]
  },
  {
    id: 'TC-03',
    title: 'The Law-Abiding Steady Cruise (Optimal Smooth Pace)',
    description:
      'Vehicle GPS locations stream at steady 90 km/h along the expressway. Demonstrates minimal alert disturbance and smooth banking of time.',
    persona: 'Family Commuter / Fleet Logistics',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 200,
          speed_kmh: 90
        },
        elapsed_s: 200,
        covered_m: 5000,
        speed_kmh: 90,
        expectedCeiling_kmh: 98.2,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Pace green. You are cruising comfortably at 90 km/h within the 98.2 km/h ceiling.',
          hinglish: 'Pace green hai. 90 km/h par comfortable cruising. Sab theek hai.'
        },
        explanation:
          'GPS location at 5km reached at 200s. Ceiling calculated as 98.2 km/h. Speed 90 <= 93.2 triggers calm GREEN.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 400,
          speed_kmh: 90
        },
        elapsed_s: 400,
        covered_m: 10000,
        speed_kmh: 90,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Halfway checkpoint reached. 50 seconds banked. Maintain steady throttle.',
          hinglish: 'Aadha section poora hua. 50 second banked hain. Smooth chalte rahein.'
        },
        explanation:
          'GPS location at 10km reached at 400s. Ceiling calculated as 100.0 km/h. Speed 90 <= 95 triggers GREEN.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 600,
          speed_kmh: 90
        },
        elapsed_s: 600,
        covered_m: 15000,
        speed_kmh: 90,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Three quarters complete. 5 kilometers remaining. Speed is optimal.',
          hinglish: 'Teen chauthai complete. Bas 5 km bacha hai. Speed ekdum badhiya hai.'
        },
        explanation:
          'GPS location at 15km reached at 600s. Ceiling is 100.0 km/h. Speed 90 km/h triggers GREEN.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 800,
          speed_kmh: 90
        },
        elapsed_s: 800,
        covered_m: 20000,
        speed_kmh: 90,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Section successfully cleared. Average speed 90.0 km/h. Perfect compliance.',
          hinglish: 'Section clear ho gaya. Average speed 90.0 km/h. Perfect compliance!'
        },
        explanation:
          'Total time 800s. 50s banked beyond T_min. Average speed 90.0 km/h is below 96 km/h. Perfect compliance.'
      }
    ]
  },
  {
    id: 'TC-04',
    title: 'Traffic Jam & Banked Time Rule (Ceiling Capped at Limit)',
    description:
      'Tests the core requirement: "Banked time carries forward, and the app never advises exceeding the posted limit." Slow crawl in Q1/Q2 banks massive time, but ceiling never exceeds 100 km/h.',
    persona: 'Commercial Driver / Heavy Traffic Scenario',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 500,
          speed_kmh: 40
        },
        elapsed_s: 500,
        covered_m: 5000,
        speed_kmh: 40,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Heavy congestion noted. 312 seconds banked. Ceiling remains at posted 100 km/h limit.',
          hinglish: 'Bhari traffic hai. Kaafi time bank ho chuka hai. Ceiling 100 km/h par locked hai.'
        },
        explanation:
          'Elapsed 500s. Remaining 15,000m in 250s mathematically equals 216 km/h! However, the algorithm strictly caps ceiling at posted limit 100.0 km/h. Never advises exceeding posted limit.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 760,
          speed_kmh: 75
        },
        elapsed_s: 760,
        covered_m: 10000,
        speed_kmh: 75,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Time budget satisfied. Total elapsed time already exceeds minimum section time. Posted limit applies.',
          hinglish: 'Time budget poora ho gaya. Elapsed time minimum time se zyada ho chuka hai. 100 limit follow karein.'
        },
        explanation:
          'Elapsed 760s > T_min (750s). need_s <= 0. Ceiling is locked to posted limit 100.0 km/h. Speed 75 triggers GREEN.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 940,
          speed_kmh: 96
        },
        elapsed_s: 940,
        covered_m: 15000,
        speed_kmh: 96,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Caution. Expressway is clear now. You are driving at 96 km/h near the 100 km/h posted limit.',
          hinglish: 'Caution. Road khul gayi hai. Aap 96 pe hain jo 100 km/h limit ke paas hai.'
        },
        explanation:
          'Road opened up. Speed 96 km/h. Ceiling is 100.0 km/h. Speed 96 > (100 - 5 = 95) triggers AMBER caution.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 1120,
          speed_kmh: 90
        },
        elapsed_s: 1120,
        covered_m: 20000,
        speed_kmh: 90,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Section completed. Total time 18 minutes 40 seconds. Safe average speed 64.3 km/h.',
          hinglish: 'Section poora hua. Total time 18 minute. Average speed 64.3 km/h. Bilkul safe.'
        },
        explanation:
          'Section completed with massive safety buffer. Average speed 64.3 km/h. 100% challan immune.'
      }
    ]
  },
  {
    id: 'TC-05',
    title: 'Chronic Violator / Challan Guaranteed (Extreme Over-Speeding)',
    description:
      'Driver GPS updates show continuous 125-130 km/h speed, resulting in dynamically plunging speed ceilings and guaranteed challan.',
    persona: 'Reckless Driver / Violation Case',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 138,
          speed_kmh: 130
        },
        elapsed_s: 138,
        covered_m: 5000,
        speed_kmh: 130,
        expectedCeiling_kmh: 88.2,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Critical speed warning! Current speed 130 km/h. Legal ceiling is 88.2 km/h. Brake now!',
          hinglish: 'Khatarnak speed! Aap 130 pe hain. Maximum allowed speed 88.2 km/h hai. Brake lagayein!'
        },
        explanation:
          'Covered 5km in 138s. Need 612s for remaining 15km -> ceiling 88.2 km/h. Speed 130 > limit 100 & > ceiling 88.2 -> Loud RED alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 276,
          speed_kmh: 128
        },
        elapsed_s: 276,
        covered_m: 10000,
        speed_kmh: 128,
        expectedCeiling_kmh: 75.9,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Emergency pace deficit! Ceiling dropped to 75.9 km/h. Sectional average violation in progress.',
          hinglish: 'Bhari deficit! Ceiling gir kar 75.9 km/h ho gayi hai. Challan pakka aayega agar speed kam nahi ki.'
        },
        explanation:
          'Covered 10km in 276s. Need 474s for 10km -> ceiling drops further to 75.9 km/h! Speed 128 triggers high-severity RED alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 415,
          speed_kmh: 125
        },
        elapsed_s: 415,
        covered_m: 15000,
        speed_kmh: 125,
        expectedCeiling_kmh: 53.7,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Severe speed violation! Required ceiling is 53.7 km/h to prevent challan. Immediate slowdown needed.',
          hinglish: 'Severe speed violation! Challan se bachne ke liye 53.7 km/h pe aana hoga. Turant dhere karein.'
        },
        explanation:
          'Covered 15km in 415s. Need 335s for remaining 5km -> ceiling plummets to (5000/335)*3.6 = 53.7 km/h! Continuous RED alert.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 555,
          speed_kmh: 120
        },
        elapsed_s: 555,
        covered_m: 20000,
        speed_kmh: 120,
        expectedCeiling_kmh: null,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Challan generated! Section completed in 9 minutes 15 seconds. Average speed 129.7 km/h. Exceeded limit by 33.7 km/h.',
          hinglish: 'Challan ho gaya! Section 9 minute 15 second me poora hua. Average speed 129.7 km/h. Limit se 33.7 km/h zyada!'
        },
        explanation:
          'Section completed in only 555s, 195s faster than legal minimum (750s). Average speed 129.7 km/h far exceeds 96 km/h. Challan generated.'
      }
    ]
  },
  {
    id: 'TC-06',
    title: 'Dwarka Expressway Urban Section (10 km, 80 km/h Limit)',
    description:
      'Tests engine calculation directly on Dwarka Expressway (NH-248BB) GPS coordinates (10 km, 80 km/h limit, 4% margin: eff_ms = 21.33 m/s, T_min = 468.75s).',
    persona: 'Urban Commuter (Dwarka NH-248BB Elevated Section)',
    section: {
      length_m: 10000,
      limit_kmh: 80,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (2.5 km / 25%)',
        gpsLocation: {
          lat: 28.53,
          lon: 77.035,
          timestamp_s: 100,
          speed_kmh: 90
        },
        elapsed_s: 100,
        covered_m: 2500,
        speed_kmh: 90,
        expectedCeiling_kmh: 73.2,
        expectedAlert: 'red',
        voicePrompt: {
          english: 'Urban speed alert! 90 km/h exceeds 80 km/h limit. Required ceiling is 73.2 km/h.',
          hinglish: 'Urban speed alert! 90 km/h limit 80 se upar hai. Ab legal ceiling 73.2 km/h hai.'
        },
        explanation:
          'GPS at [28.5300°N, 77.0350°E] (2.5km). Reached in 100s. Need 368.75s for remaining 7,500m -> ceiling 73.2 km/h. Speed 90 > 73.2 -> RED alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (5.0 km / 50%)',
        gpsLocation: {
          lat: 28.515,
          lon: 77.019,
          timestamp_s: 230,
          speed_kmh: 74
        },
        elapsed_s: 230,
        covered_m: 5000,
        speed_kmh: 74,
        expectedCeiling_kmh: 75.4,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Amber caution. Speed 74 km/h is near the 75.4 km/h ceiling. Keep below 75 km/h.',
          hinglish: 'Amber caution. Speed 74 km/h hai, ceiling 75.4 ke paas. 75 ke niche rakhein.'
        },
        explanation:
          'GPS at [28.5150°N, 77.0190°E] (5.0km). Elapsed 230s. Need 238.75s for remaining 5,000m -> ceiling is 75.4 km/h. Speed 74 > (75.4 - 5 = 70.4) -> AMBER alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (7.5 km / 75%)',
        gpsLocation: {
          lat: 28.511,
          lon: 77.015,
          timestamp_s: 360,
          speed_kmh: 70
        },
        elapsed_s: 360,
        covered_m: 7500,
        speed_kmh: 70,
        expectedCeiling_kmh: 80.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Pace green. Safe ceiling restored to 80 km/h. Smooth driving.',
          hinglish: 'Pace green hai. Safe speed limit wapas 80 km/h. Badhiya chal rahe hain.'
        },
        explanation:
          'GPS at [28.5110°N, 77.0150°E] (7.5km). Elapsed 360s. Need 108.75s for 2,500m -> raw 82.7 km/h, capped at 80.0 km/h posted limit. Speed 70 triggers GREEN alert.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (10.0 km / 100% Bajghera Exit)',
        gpsLocation: {
          lat: 28.508,
          lon: 77.012,
          timestamp_s: 490,
          speed_kmh: 72
        },
        elapsed_s: 490,
        covered_m: 10000,
        speed_kmh: 72,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Dwarka Expressway section cleared! Time 8 minutes 10 seconds. Average speed 73.5 km/h. Clean run.',
          hinglish: 'Dwarka Expressway section clear! Time 8 minute 10 second. Average 73.5 km/h. No challan.'
        },
        explanation:
          'Total time 490s > 468.75s minimum. Average speed 73.5 km/h is below 76.8 km/h safe limit. Done with GREEN.'
      }
    ]
  },
  {
    id: 'TC-07',
    title: 'Amber Boundary & Edge Precision Test (5 km/h Gap)',
    description:
      'Tests mathematical boundary precision of the amber_gap_kmh = 5 threshold: confirms exact transition when speed is above vs below (ceiling - 5).',
    persona: 'QA Precision Test / Boundary Verification',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5.0 km / 25%)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 200,
          speed_kmh: 95
        },
        elapsed_s: 200,
        covered_m: 5000,
        speed_kmh: 95,
        expectedCeiling_kmh: 98.2,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Amber boundary confirmed: speed 95 km/h is above 93.2 km/h amber threshold.',
          hinglish: 'Amber boundary test: speed 95 km/h 93.2 threshold se upar hai, amber active.'
        },
        explanation:
          'Elapsed 200s, 5,000m. Ceiling = 98.2 km/h. Amber threshold is 98.2 - 5 = 93.2 km/h. Speed 95 > 93.2 -> AMBER alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10.0 km / 50%)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 390,
          speed_kmh: 92
        },
        elapsed_s: 390,
        covered_m: 10000,
        speed_kmh: 92,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Green boundary confirmed: speed 92 km/h is below 95 km/h amber threshold.',
          hinglish: 'Green boundary test: speed 92 km/h 95 threshold ke niche hai, green active.'
        },
        explanation:
          'Elapsed 390s, Need 360s for 10km -> ceiling 100.0 km/h. Amber threshold is 100 - 5 = 95.0 km/h. Speed 92 <= 95.0 -> GREEN alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15.0 km / 75%)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 590,
          speed_kmh: 96
        },
        elapsed_s: 590,
        covered_m: 15000,
        speed_kmh: 96,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'amber',
        voicePrompt: {
          english: 'Amber transition: speed 96 km/h is slightly above 95 km/h threshold.',
          hinglish: 'Amber transition: speed 96 km/h 95 threshold se thoda upar hai.'
        },
        explanation:
          'Elapsed 590s. Ceiling is 100.0 km/h. Amber threshold is 95.0 km/h. Speed 96.0 > 95.0 -> AMBER alert.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20.0 km / 100% Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 780,
          speed_kmh: 85
        },
        elapsed_s: 780,
        covered_m: 20000,
        speed_kmh: 85,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        voicePrompt: {
          english: 'Test complete: all 4 boundaries verified with zero margin of error.',
          hinglish: 'Test complete: saari 4 boundaries bina kisi error ke verify ho gayi.'
        },
        explanation:
          'Elapsed 780s >= 750s. State is done. Alert is GREEN.'
      }
    ]
  },
  {
    id: 'TC-08',
    title: 'NH-48 Urban ANPR Section (Shankar Chowk → Atlas Chowk Road Path)',
    description:
      'Evaluates shortest driving path via NH-48 expressway (3,450 m road network distance vs 3,091 m direct chord displacement, 70 km/h limit, 4% margin: eff_ms = 18.67 m/s, T_min = 184.8s).',
    persona: 'Gurugram Expressway Commuter (Cyber City to Atlas Chowk)',
    section: {
      length_m: 3450,
      limit_kmh: 70,
      margin: 0.04,
      amber_gap_kmh: 5,
      displacement_m: 3091,
      detourFactor: 1.12
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (862m Road / Cyber Hub Flyover)',
        gpsLocation: {
          lat: 28.4980,
          lon: 77.0850,
          timestamp_s: 42,
          speed_kmh: 80
        },
        elapsed_s: 42,
        covered_m: 862,
        remaining_road_m: 2588,
        chord_displacement_m: 760,
        speed_kmh: 80,
        expectedCeiling_kmh: 65.2,
        expectedAlert: 'red',
        timelineEvent:
          'T = 42s: Vehicle crossed Shankar Chowk entry and covered 862m road distance at 80 km/h. Budget remaining: 142.8s for 2,588m. Pace ceiling calculated at 65.2 km/h. Instantaneous speed 80 km/h triggers RED alert.',
        voicePrompt: {
          english: 'Speed warning! Cyber Hub flyover cleared at 80 km/h. Ceiling dropped to 65.2 km/h. Slow down immediately.',
          hinglish: 'Speed warning! Shankar Chowk se 80 pe nikle. Allowed ceiling ab 65.2 km/h hai. Turant slow karein.'
        },
        explanation:
          'Vehicle GPS at [28.4930°N, 77.0870°E]. Road distance 862m in 42s. Remaining 2,588m in 142.8s -> ceiling 65.2 km/h. Speed 80 > 65.2 -> RED alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (1,725m Road / Midpoint)',
        gpsLocation: {
          lat: 28.4903,
          lon: 77.0781,
          timestamp_s: 92,
          speed_kmh: 65
        },
        elapsed_s: 92,
        covered_m: 1725,
        remaining_road_m: 1725,
        chord_displacement_m: 1520,
        speed_kmh: 65,
        expectedCeiling_kmh: 66.9,
        expectedAlert: 'amber',
        timelineEvent:
          'T = 92s: Vehicle covered 1,725m road distance (50% midpoint) in 92 seconds. Driver reduced speed to 65 km/h. Safe ceiling is 66.9 km/h. Speed is within 5 km/h buffer of ceiling -> AMBER caution active.',
        voicePrompt: {
          english: 'Amber caution! Current speed is 65 km/h near the ceiling of 66.9 km/h. Maintain steady pace.',
          hinglish: 'Amber caution! Speed 65 km/h hai, ceiling 66.9 km/h ke paas. Speed maintain rakhein.'
        },
        explanation:
          'Vehicle GPS at [28.4870°N, 77.0810°E]. Road distance 1,725m in 92s. Remaining 1,725m in 92.8s -> ceiling 66.9 km/h. Speed 65 > (66.9 - 5 = 61.9) -> AMBER alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (2,588m Road / Curve Approach)',
        gpsLocation: {
          lat: 28.4809,
          lon: 77.0712,
          timestamp_s: 145,
          speed_kmh: 60
        },
        elapsed_s: 145,
        covered_m: 2588,
        remaining_road_m: 862,
        chord_displacement_m: 2300,
        speed_kmh: 60,
        expectedCeiling_kmh: 70.0,
        expectedAlert: 'green',
        timelineEvent:
          'T = 145s: Vehicle reached 2,588m road distance. Driver recovered time budget with banked time. Ceiling restored to full 70 km/h limit. Speed 60 km/h triggers GREEN. Geofence pre-alert: remaining road distance 862m to Atlas Chowk gantry.',
        voicePrompt: {
          english: 'Pace optimal. Safe ceiling restored to 70 km/h. Atlas Chowk gantry ahead in 860 meters.',
          hinglish: 'Safe pace. Speed ceiling wapas 70 km/h par hai. Aage Atlas Chowk gantry 860 meter door hai.'
        },
        explanation:
          'Vehicle GPS at [28.4810°N, 77.0750°E]. Road distance 2,588m in 145s. Remaining 862m in 39.8s -> raw 77.9 km/h, capped at 70.0 km/h limit. Speed 60 <= 65 -> GREEN alert.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (3,450m Road / Atlas Chowk Exit)',
        gpsLocation: {
          lat: 28.4777,
          lon: 77.0693,
          timestamp_s: 192,
          speed_kmh: 62
        },
        elapsed_s: 192,
        covered_m: 3450,
        remaining_road_m: 0,
        chord_displacement_m: 3091,
        speed_kmh: 62,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        timelineEvent:
          'T = 192s: Vehicle crossed Atlas Chowk Exit Gantry. Total road distance 3,450m completed in 192 seconds (greater than minimum legal time 184.8s). Sectional average speed 64.7 km/h is below 67.2 km/h safe limit. Zero challan issued!',
        voicePrompt: {
          english: 'Section cleared! Total time 3 minutes 12 seconds. Average speed 64.7 km/h. Zero challan.',
          hinglish: 'NH-48 section clear! Total time 3 minute 12 second. Average speed 64.7 km/h raha. Challan free!'
        },
        explanation:
          'Total time 192s >= T_min (184.8s). Average speed 64.7 km/h < 67.2 km/h limit. Completed legally with GREEN.'
      }
    ]
  },
  {
    id: 'TC-09',
    title: 'Road Network Shortest Distance vs. Chord Displacement Benchmark',
    description:
      'Direct mathematical proof comparing shortest road distance (20,000 m) vs straight-line chord displacement (16,400 m, 3.6 km error). Proves why road geometry calculation prevents false challan warnings.',
    persona: 'Algorithm Auditor & Precision Verification',
    section: {
      length_m: 20000,
      limit_kmh: 100,
      margin: 0.04,
      amber_gap_kmh: 5,
      displacement_m: 16400,
      detourFactor: 1.22
    },
    fourTimestamps: [
      {
        timestampIndex: 1,
        checkpointPercent: 25,
        checkpointName: 'Checkpoint 1 (5,000m Road vs 4,100m Chord)',
        gpsLocation: {
          lat: 12.668,
          lon: 77.242,
          timestamp_s: 180,
          speed_kmh: 92
        },
        elapsed_s: 180,
        covered_m: 5000,
        remaining_road_m: 15000,
        chord_displacement_m: 4100,
        speed_kmh: 92,
        expectedCeiling_kmh: 94.7,
        expectedAlert: 'amber',
        timelineEvent:
          'T = 180s: Vehicle reached 5,000m road distance. Straight chord displacement is only 4,100m (900m discrepancy). Road engine computes 15,000m remaining in 570s = 94.7 km/h ceiling. Speed 92 km/h triggers AMBER caution.',
        voicePrompt: {
          english: 'Road path verified: 5.0 km covered. Safe ceiling is 94.7 km/h. Speed 92 km/h is near amber threshold.',
          hinglish: 'Road path verified: 5.0 km road distance pura hua. Safe ceiling 94.7 km/h. Speed control mein rakhein.'
        },
        explanation:
          'Road distance 5,000m in 180s. Remaining road distance 15,000m in 570s -> ceiling 94.7 km/h. Speed 92 > (94.7 - 5 = 89.7) -> AMBER alert.'
      },
      {
        timestampIndex: 2,
        checkpointPercent: 50,
        checkpointName: 'Checkpoint 2 (10,000m Road vs 8,200m Chord)',
        gpsLocation: {
          lat: 12.628,
          lon: 77.215,
          timestamp_s: 375,
          speed_kmh: 90
        },
        elapsed_s: 375,
        covered_m: 10000,
        remaining_road_m: 10000,
        chord_displacement_m: 8200,
        speed_kmh: 92,
        expectedCeiling_kmh: 96.0,
        expectedAlert: 'amber',
        timelineEvent:
          'T = 375s: Vehicle reached 10,000m midpoint along expressway curvature. Remaining road distance: 10,000m in 375s budget = 96.0 km/h ceiling. Speed 92 km/h triggers AMBER.',
        voicePrompt: {
          english: 'Midpoint reached via road network. Ceiling is 96.0 km/h. Hold steady pace.',
          hinglish: 'Midpoint complete via road network. Ceiling 96.0 km/h hai. Pace maintain rakhein.'
        },
        explanation:
          'Road distance 10,000m in 375s. Remaining road distance 10,000m in 375s -> ceiling 96.0 km/h. Speed 92 > (96 - 5 = 91) -> AMBER alert.'
      },
      {
        timestampIndex: 3,
        checkpointPercent: 75,
        checkpointName: 'Checkpoint 3 (15,000m Road vs 12,300m Chord)',
        gpsLocation: {
          lat: 12.611,
          lon: 77.202,
          timestamp_s: 580,
          speed_kmh: 88
        },
        elapsed_s: 580,
        covered_m: 15000,
        remaining_road_m: 5000,
        chord_displacement_m: 12300,
        speed_kmh: 88,
        expectedCeiling_kmh: 100.0,
        expectedAlert: 'green',
        timelineEvent:
          'T = 580s: Vehicle reached 15,000m road distance. Banked time positive (+22s). Safe ceiling restored to 100 km/h. Speed 88 km/h is comfortably GREEN.',
        voicePrompt: {
          english: 'Road path optimal. 5.0 km remaining to exit. Ceiling restored to 100 km/h.',
          hinglish: 'Road path safe. Exit gantry 5 km door hai. Safe speed limit full 100 km/h.'
        },
        explanation:
          'Road distance 15,000m in 580s. Remaining 5,000m in 170s -> raw 105.8 km/h, capped at 100.0 km/h. Speed 88 <= 95 -> GREEN alert.'
      },
      {
        timestampIndex: 4,
        checkpointPercent: 100,
        checkpointName: 'Checkpoint 4 (20,000m Road / Exit Gantry)',
        gpsLocation: {
          lat: 12.6012,
          lon: 77.195,
          timestamp_s: 770,
          speed_kmh: 82
        },
        elapsed_s: 770,
        covered_m: 20000,
        remaining_road_m: 0,
        chord_displacement_m: 16400,
        speed_kmh: 82,
        expectedCeiling_kmh: null,
        expectedAlert: 'green',
        timelineEvent:
          'T = 770s: Exit Gantry crossed. Total road network distance 20,000m traversed in 770 seconds (T_min was 750s). Sectional average speed 93.5 km/h < 96 km/h. Safe compliance confirmed!',
        voicePrompt: {
          english: 'Benchmark passed! True road distance calculation verified 100% compliant and challan-free.',
          hinglish: 'Benchmark pass! Road distance calculation 100% accurate aur bina challan verify hua.'
        },
        explanation:
          'Elapsed 770s >= 750s. State is done. Alert is GREEN. Verified road network distance eliminates chord displacement error.'
      }
    ]
  }
];
