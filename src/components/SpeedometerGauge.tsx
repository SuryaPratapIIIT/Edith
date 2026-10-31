import React from 'react';
import { AlertLevel, CameraFOVStatus, ChallanEvent } from '../types/pace';
import { Camera, AlertTriangle, ShieldCheck, Zap, Clock } from 'lucide-react';

interface SpeedometerGaugeProps {
  currentSpeed: number;
  ceilingSpeed: number | null;
  postedLimit: number;
  alert: AlertLevel;
  state: string;
  cameraFOV?: CameraFOVStatus;
  hasSpotChallan?: boolean;
  challanHistory?: ChallanEvent[];
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  currentSpeed,
  ceilingSpeed,
  postedLimit,
  alert,
  state,
  cameraFOV,
  hasSpotChallan,
  challanHistory = []
}) => {
  // Speedometer ranges from 0 to 140 km/h over a 240-degree arc (-210 deg to 30 deg)
  const maxScale = 140;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240 deg

  const speedToAngle = (speed: number) => {
    const clamped = Math.min(Math.max(speed, 0), maxScale);
    return startAngle + (clamped / maxScale) * totalAngle;
  };

  const needleAngle = speedToAngle(currentSpeed);
  const ceilingAngle = ceilingSpeed !== null ? speedToAngle(ceilingSpeed) : null;
  const limitAngle = speedToAngle(postedLimit);

  // SVG arc parameters
  const radius = 120;
  const cx = 160;
  const cy = 160;

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const startPoint = polarToCartesian(x, y, r, end);
    const endPoint = polarToCartesian(x, y, r, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return ['M', startPoint.x, startPoint.y, 'A', r, r, 0, largeArcFlag, 0, endPoint.x, endPoint.y].join(' ');
  };

  const alertColor =
    alert === 'red' ? '#ef4444' : alert === 'amber' ? '#f59e0b' : '#10b981';
  const alertGlow =
    alert === 'red'
      ? 'rgba(239, 68, 68, 0.4)'
      : alert === 'amber'
      ? 'rgba(245, 158, 11, 0.4)'
      : 'rgba(16, 185, 129, 0.4)';

  // Generate tick marks
  const ticks = [0, 20, 40, 60, 80, 100, 120, 140];

  return (
    <div className="relative flex flex-col items-center justify-center p-4 bg-gray-900/90 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-md">
      {/* Header status badge */}
      <div className="w-full flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full animate-pulse`}
            style={{ backgroundColor: alertColor, boxShadow: `0 0 10px ${alertColor}` }}
          />
          <span className="text-xs uppercase tracking-widest font-mono font-bold text-gray-400">
            {state === 'done' ? 'SECTION FINISHED' : `ALERT: ${alert.toUpperCase()}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>POSTED: <strong className="text-cyan-300">{postedLimit}</strong></span>
        </div>
      </div>

      {/* Speedometer SVG */}
      <div className="relative w-80 h-72 flex items-center justify-center">
        <svg
          viewBox="0 0 320 320"
          className="w-full h-full filter drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          {/* Background track arc */}
          <path
            d={describeArc(cx, cy, radius, startAngle, endAngle)}
            fill="none"
            stroke="#1f2937"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active speed progress arc */}
          <path
            d={describeArc(cx, cy, radius, startAngle, Math.min(needleAngle, endAngle))}
            fill="none"
            stroke={alertColor}
            strokeWidth="14"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${alertGlow})`,
              transition: 'stroke 0.3s ease, stroke-dashoffset 0.1s ease'
            }}
          />

          {/* Ticks and numerical markers */}
          {ticks.map((t) => {
            const angle = speedToAngle(t);
            const outer = polarToCartesian(cx, cy, radius + 14, angle);
            const inner = polarToCartesian(cx, cy, radius - 2, angle);
            const labelPos = polarToCartesian(cx, cy, radius - 22, angle);
            const isLimit = t === postedLimit;
            return (
              <g key={t}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={isLimit ? '#38bdf8' : '#4b5563'}
                  strokeWidth={isLimit ? 3 : 1.5}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y + 4}
                  fill={isLimit ? '#38bdf8' : '#9ca3af'}
                  fontSize="11"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight={isLimit ? 'bold' : 'normal'}
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Posted Speed Limit Marker (Cyan Diamond) */}
          {(() => {
            const pt = polarToCartesian(cx, cy, radius, limitAngle);
            return (
              <g>
                <circle cx={pt.x} cy={pt.y} r="6" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
              </g>
            );
          })()}

          {/* Live Safe Ceiling Marker (Gold Indicator) */}
          {ceilingAngle !== null && (
            (() => {
              const pt = polarToCartesian(cx, cy, radius, ceilingAngle);
              return (
                <g>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="8"
                    fill="#f59e0b"
                    stroke="#fbbf24"
                    strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}
                  />
                  <line
                    x1={polarToCartesian(cx, cy, radius - 15, ceilingAngle).x}
                    y1={polarToCartesian(cx, cy, radius - 15, ceilingAngle).y}
                    x2={polarToCartesian(cx, cy, radius + 15, ceilingAngle).x}
                    y2={polarToCartesian(cx, cy, radius + 15, ceilingAngle).y}
                    stroke="#fbbf24"
                    strokeWidth="3"
                  />
                </g>
              );
            })()
          )}

          {/* Needle */}
          {(() => {
            const needleTip = polarToCartesian(cx, cy, radius - 10, needleAngle);
            const baseLeft = polarToCartesian(cx, cy, 14, needleAngle - 90);
            const baseRight = polarToCartesian(cx, cy, 14, needleAngle + 90);
            return (
              <polygon
                points={`${needleTip.x},${needleTip.y} ${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y}`}
                fill={alertColor}
                style={{
                  filter: `drop-shadow(0 0 6px ${alertGlow})`,
                  transition: 'points 0.15s ease-out'
                }}
              />
            );
          })()}

          {/* Center Hub */}
          <circle cx={cx} cy={cy} r="20" fill="#111827" stroke="#374151" strokeWidth="4" />
          <circle cx={cx} cy={cy} r="10" fill={alertColor} />
        </svg>

        {/* Digital Readout Center Overlay */}
        <div className="absolute bottom-6 flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span
              className="text-5xl font-black font-mono tracking-tight"
              style={{ color: alertColor, textShadow: `0 0 20px ${alertGlow}` }}
            >
              {Math.round(currentSpeed)}
            </span>
            <span className="text-xs uppercase font-mono text-gray-400">KM/H</span>
          </div>
          <span className="text-[10px] tracking-widest uppercase font-mono text-gray-500 mt-0.5">
            INSTANT SPEED
          </span>
        </div>
      </div>

      {/* Camera 15m Field of View (FOV) & Spot Challan Status Banner */}
      {challanHistory.length > 0 ? (
        <div className="w-full mt-2 p-2.5 rounded-xl bg-red-950/80 border border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)] flex flex-col gap-1.5 animate-pulse">
          <div className="flex items-center justify-between text-left">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-red-200">
              <Zap className="w-3.5 h-3.5 text-red-400 animate-bounce" />
              <span>🚨 {challanHistory.length} CHALLAN RISKS DETECTED</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-red-900/80 text-white font-mono font-black text-[10px] border border-red-400">
              HIGH RISK IN THIS REGION
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
            <div className="bg-red-900/30 p-1.5 rounded-lg border border-red-500/20 text-red-300">
              <span className="font-bold block text-red-200">1. Speed Challan Risk</span>
              <span>{challanHistory.filter(c => c.type === 'speed_challan').length} Corridor Violations</span>
            </div>
            <div className="bg-red-900/30 p-1.5 rounded-lg border border-red-500/20 text-red-300">
              <span className="font-bold block text-red-200">2. Spot Challan Risk</span>
              <span>{challanHistory.filter(c => c.type === 'spot_challan').length} Camera Spot Violations</span>
            </div>
          </div>
        </div>
      ) : hasSpotChallan ? (
        <div className="w-full mt-2 p-2 rounded-xl bg-red-950/80 border border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2 animate-pulse">
          <Zap className="w-4 h-4 text-red-400 flex-shrink-0 animate-bounce" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[11px] font-mono font-bold text-red-200">
              🚨 SPOT CHALLAN RISK RECORDED!
            </div>
            <div className="text-[9px] font-mono text-red-300/80">
              Speed exceeded limit in 15m camera field of view. High risk of spot challan in this region.
            </div>
          </div>
        </div>
      ) : cameraFOV?.inCameraFOV ? (
        <div className={`w-full mt-2 p-2 rounded-xl border flex items-center gap-2 ${
          cameraFOV.spotViolation
            ? 'bg-red-950/80 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
            : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200'
        }`}>
          <Camera className={`w-4 h-4 flex-shrink-0 ${cameraFOV.spotViolation ? 'text-red-400' : 'text-cyan-400 animate-pulse'}`} />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[11px] font-mono font-bold">
              {cameraFOV.spotViolation ? '🚨 FOV OVER-SPEEDING VIOLATION!' : `📷 IN ${cameraFOV.cameraName?.toUpperCase()} (15m FOV)`}
            </div>
            <div className="text-[9px] font-mono opacity-80">
              {cameraFOV.spotViolation
                ? `Speed ${Math.round(currentSpeed)} km/h > ${postedLimit} km/h! Spot challan triggered!`
                : `Range: ${cameraFOV.distanceToCamera_m}m · Spot limit: keep speed ≤ ${postedLimit} km/h`}
            </div>
          </div>
        </div>
      ) : null}

      {/* Ceiling Speed & Target Summary Box */}
      <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800">
        <div className="bg-gray-800/60 p-2.5 rounded-xl border border-gray-700/60 flex flex-col items-center">
          <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold tracking-wider">
            LIVE CEILING SPEED
          </span>
          <span className="text-2xl font-bold font-mono text-amber-300 mt-0.5">
            {ceilingSpeed !== null ? `${ceilingSpeed.toFixed(1)}` : 'DONE'}
            {ceilingSpeed !== null && <span className="text-xs font-normal text-amber-400/80 ml-1">km/h</span>}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5 text-center">
            Max safe average for remaining section
          </span>
        </div>

        <div className="bg-gray-800/60 p-2.5 rounded-xl border border-gray-700/60 flex flex-col items-center">
          <span className="text-[10px] uppercase font-mono text-cyan-400 font-semibold tracking-wider">
            POSTED SPEED LIMIT
          </span>
          <span className="text-2xl font-bold font-mono text-cyan-300 mt-0.5">
            {postedLimit}
            <span className="text-xs font-normal text-cyan-400/80 ml-1">km/h</span>
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5 text-center">
            Highway posted maximum
          </span>
        </div>
      </div>
    </div>
  );
};
