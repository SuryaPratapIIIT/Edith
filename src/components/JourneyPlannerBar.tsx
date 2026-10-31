import React, { useState, useRef, useEffect } from 'react';
import { GurgaonPlace, searchGurgaonPlaces } from '../data/gurgaonPlaces';
import { PlannedJourney } from '../services/journeyService';
import {
  MapPin,
  ArrowLeftRight,
  Camera,
  Compass,
  MousePointerClick,
  Loader2,
  X,
  Radio,
  AlertCircle
} from 'lucide-react';

interface JourneyPlannerBarProps {
  journey: PlannedJourney;
  activeSectionIndex: number;
  isLoadingRoute?: boolean;
  isMapPickActive?: boolean;
  mapPickTarget?: 'origin' | 'destination' | null;
  trackingMode?: 'simulated' | 'live_gps';
  isLocatingUser?: boolean;
  gpsNotice?: string | null;
  gpsError?: string | null;
  onToggleTrackingMode?: (mode: 'simulated' | 'live_gps') => void;
  onUseCurrentLocation?: () => void;
  onToggleMapPick?: (target: 'origin' | 'destination') => void;
  onSelectOriginPlace: (place: GurgaonPlace) => void;
  onSelectDestinationPlace: (place: GurgaonPlace) => void;
  onSwapPlaces: () => void;
  onSelectPreset?: (originId: string, destinationId: string) => void;
}

export const JourneyPlannerBar: React.FC<JourneyPlannerBarProps> = ({
  journey,
  activeSectionIndex,
  isLoadingRoute = false,
  isMapPickActive = false,
  mapPickTarget = null,
  trackingMode = 'simulated',
  isLocatingUser = false,
  gpsNotice = null,
  gpsError = null,
  onToggleTrackingMode,
  onUseCurrentLocation,
  onToggleMapPick,
  onSelectOriginPlace,
  onSelectDestinationPlace,
  onSwapPlaces,
}) => {
  // Search inputs state
  const [originSearch, setOriginSearch] = useState<string>(journey.origin.name);
  const [destSearch, setDestSearch] = useState<string>(journey.destination.name);
  const [isOriginOpen, setIsOriginOpen] = useState<boolean>(false);
  const [isDestOpen, setIsDestOpen] = useState<boolean>(false);

  // Sync inputs when journey props change
  useEffect(() => {
    setOriginSearch(journey.origin.name);
  }, [journey.origin]);

  useEffect(() => {
    setDestSearch(journey.destination.name);
  }, [journey.destination]);

  const originWrapperRef = useRef<HTMLDivElement>(null);
  const destWrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originWrapperRef.current && !originWrapperRef.current.contains(e.target as Node)) {
        setIsOriginOpen(false);
      }
      if (destWrapperRef.current && !destWrapperRef.current.contains(e.target as Node)) {
        setIsDestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const originSuggestions = searchGurgaonPlaces(originSearch);
  const destSuggestions = searchGurgaonPlaces(destSearch);

  return (
    <div className="w-full bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-800 p-3.5 sm:p-4 shadow-2xl flex flex-col gap-3">
      {/* Mode Switcher: Simulation vs Real-Time Device GPS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pb-2.5 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
            Real Time Mode
          </span>
        </div>

        {onToggleTrackingMode && (
          <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-mono">
            <button
              onClick={() => onToggleTrackingMode('simulated')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                trackingMode === 'simulated'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>🚗 Simulation Cruise</span>
            </button>

            <button
              onClick={() => onToggleTrackingMode('live_gps')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                trackingMode === 'live_gps'
                  ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${trackingMode === 'live_gps' ? 'animate-ping' : ''}`}></span>
              <span>📡 Real-Time GPS Tracking</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Dual Location Search Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Origin / Dest Dual Search Inputs */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* 1. Origin Input Box */}
          <div ref={originWrapperRef} className="relative flex-1">
            <div
              className={`bg-gray-950/90 rounded-xl border p-2 flex items-center gap-2.5 transition-all ${
                isMapPickActive && mapPickTarget === 'origin'
                  ? 'border-cyan-400 ring-2 ring-cyan-500/30'
                  : 'border-gray-800 focus-within:border-cyan-500/60'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="block text-[9px] font-mono uppercase text-gray-500 font-bold tracking-wider">
                  Origin (Starting Point)
                </span>
                <input
                  type="text"
                  value={originSearch}
                  onChange={(e) => {
                    setOriginSearch(e.target.value);
                    setIsOriginOpen(true);
                  }}
                  onFocus={() => setIsOriginOpen(true)}
                  placeholder="Search place, sector, or landmark in Gurugram..."
                  className="w-full bg-transparent text-gray-100 font-mono text-xs font-semibold outline-none truncate placeholder:text-gray-600"
                />
              </div>

              {originSearch && (
                <button
                  onClick={() => {
                    setOriginSearch('');
                    setIsOriginOpen(true);
                  }}
                  className="text-gray-500 hover:text-gray-300 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* 1-Click "My Location" Button */}
              {onUseCurrentLocation && (
                <button
                  type="button"
                  title="Use Device Real-Time Location as Origin"
                  onClick={onUseCurrentLocation}
                  disabled={isLocatingUser}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                >
                  {isLocatingUser ? (
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  ) : (
                    <Compass className="w-3 h-3 text-cyan-400" />
                  )}
                  <span className="hidden sm:inline">My Location</span>
                </button>
              )}

              {onToggleMapPick && (
                <button
                  type="button"
                  title="Pick Origin on Map"
                  onClick={() => onToggleMapPick('origin')}
                  className={`p-1.5 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all flex-shrink-0 ${
                    isMapPickActive && mapPickTarget === 'origin'
                      ? 'bg-cyan-500 text-black font-bold animate-pulse'
                      : 'bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-cyan-300 border border-gray-800'
                  }`}
                >
                  <MousePointerClick className="w-3 h-3" />
                  <span className="hidden xl:inline">Map Pick</span>
                </button>
              )}
            </div>

            {/* Origin Autocomplete Dropdown */}
            {isOriginOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-gray-950/98 border border-gray-800 rounded-xl shadow-2xl z-50 divide-y divide-gray-900/80 backdrop-blur-xl">
                {originSuggestions.length === 0 ? (
                  <div className="p-3 text-xs font-mono text-gray-500 text-center">
                    No matching location in Gurugram
                  </div>
                ) : (
                  originSuggestions.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => {
                        onSelectOriginPlace(place);
                        setOriginSearch(place.name);
                        setIsOriginOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-cyan-950/40 flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-mono font-semibold text-gray-200 group-hover:text-cyan-300 truncate">
                          {place.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 truncate">
                          {place.description}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800 flex-shrink-0">
                        {place.corridor}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <button
            onClick={onSwapPlaces}
            title="Swap Origin and Destination"
            className="self-center p-2 rounded-xl bg-gray-950/80 hover:bg-cyan-950/80 text-gray-400 hover:text-cyan-300 border border-gray-800 hover:border-cyan-500/40 transition-all cursor-pointer flex-shrink-0"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* 2. Destination Input Box */}
          <div ref={destWrapperRef} className="relative flex-1">
            <div
              className={`bg-gray-950/90 rounded-xl border p-2 flex items-center gap-2.5 transition-all ${
                isMapPickActive && mapPickTarget === 'destination'
                  ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                  : 'border-gray-800 focus-within:border-emerald-500/60'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="block text-[9px] font-mono uppercase text-gray-500 font-bold tracking-wider">
                  Destination (To)
                </span>
                <input
                  type="text"
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    setIsDestOpen(true);
                  }}
                  onFocus={() => setIsDestOpen(true)}
                  placeholder="Search destination in Gurugram..."
                  className="w-full bg-transparent text-gray-100 font-mono text-xs font-semibold outline-none truncate placeholder:text-gray-600"
                />
              </div>

              {destSearch && (
                <button
                  onClick={() => {
                    setDestSearch('');
                    setIsDestOpen(true);
                  }}
                  className="text-gray-500 hover:text-gray-300 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {onToggleMapPick && (
                <button
                  type="button"
                  title="Pick Destination on Map"
                  onClick={() => onToggleMapPick('destination')}
                  className={`p-1.5 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all flex-shrink-0 ${
                    isMapPickActive && mapPickTarget === 'destination'
                      ? 'bg-emerald-500 text-black font-bold animate-pulse'
                      : 'bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-emerald-300 border border-gray-800'
                  }`}
                >
                  <MousePointerClick className="w-3 h-3" />
                  <span className="hidden xl:inline">Map Pick</span>
                </button>
              )}
            </div>

            {/* Destination Autocomplete Dropdown */}
            {isDestOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-gray-950/98 border border-gray-800 rounded-xl shadow-2xl z-50 divide-y divide-gray-900/80 backdrop-blur-xl">
                {destSuggestions.length === 0 ? (
                  <div className="p-3 text-xs font-mono text-gray-500 text-center">
                    No matching location in Gurugram
                  </div>
                ) : (
                  destSuggestions.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => {
                        onSelectDestinationPlace(place);
                        setDestSearch(place.name);
                        setIsDestOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-950/40 flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-mono font-semibold text-gray-200 group-hover:text-emerald-300 truncate">
                          {place.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 truncate">
                          {place.description}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800 flex-shrink-0">
                        {place.corridor}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Route Metrics Summary Strip */}
        <div className="flex items-center gap-2.5 bg-gray-950/90 px-3.5 py-2 rounded-xl border border-gray-800 text-xs font-mono flex-shrink-0">
          {isLoadingRoute ? (
            <div className="flex items-center gap-2 text-cyan-400 py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-mono">Routing Road Network...</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase">Road Distance</span>
                <span className="text-cyan-300 font-bold font-mono">
                  {(journey.totalDistance_m / 1000).toFixed(1)} km
                </span>
              </div>

              <div className="w-px h-6 bg-gray-800" />

              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase">ANPR CCTV</span>
                <span className="text-emerald-400 font-bold font-mono flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {journey.cameras.length} Gantries
                </span>
              </div>

              <div className="w-px h-6 bg-gray-800" />

              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase">Enforcement</span>
                <span className="text-amber-300 font-bold font-mono">
                  {journey.enforcementZones.length > 0
                    ? `${journey.enforcementZones.length} Zone${journey.enforcementZones.length > 1 ? 's' : ''}`
                    : 'Normal Map'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Geolocation Notice / Error Banner */}
      {gpsNotice && (
        <div className="bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-mono text-cyan-300 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>{gpsNotice}</span>
        </div>
      )}

      {gpsError && (
        <div className="bg-red-950/60 border border-red-500/40 px-3 py-1.5 rounded-xl text-xs font-mono text-red-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Map Pick Helper Banner (when active) */}
      {isMapPickActive && (
        <div className="bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>
              Click anywhere on the map to set <b>{mapPickTarget === 'origin' ? 'Origin' : 'Destination'}</b>.
            </span>
          </div>
          {onToggleMapPick && (
            <button
              onClick={() => onToggleMapPick(mapPickTarget || 'origin')}
              className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
            >
              Cancel Map Pick
            </button>
          )}
        </div>
      )}
    </div>
  );
};
