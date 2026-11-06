import React, { useState, useEffect, useRef } from 'react';
import { GurgaonPlace, GURGAON_PLACES, getPlaceById, searchGurgaonPlaces } from '../data/gurgaonPlaces';
import { geocodeWithNominatim, mergePlaceLists, resolveTextToPlace } from '../services/geocodingService';
import { PlannedJourney } from '../services/journeyService';
import { BolnaTelemetryContext, bolnaVoiceService } from '../services/bolnaVoiceService';
import { CallState } from '@bolna/web-call';
import {
  MapPin,
  ArrowUpDown,
  Clock,
  X,
  Radio,
  Wifi,
  BatteryMedium,
  Loader2,
  Navigation,
  Crosshair,
  ArrowRight
} from 'lucide-react';

interface RoutePlanningViewProps {
  journey: PlannedJourney;
  isLoadingRoute: boolean;
  isMapPickActive: boolean;
  onToggleMapPick: (target: 'origin' | 'destination') => void;
  onUseCurrentLocation: () => void;
  onSelectOriginPlace: (place: GurgaonPlace) => void;
  onSelectDestinationPlace: (place: GurgaonPlace) => void;
  onSwapPlaces: () => void;
  onStartNavigation: () => void;
  bolnaTelemetryContext: BolnaTelemetryContext;
}

export const RoutePlanningView: React.FC<RoutePlanningViewProps> = ({
  journey,
  isLoadingRoute,
  isMapPickActive,
  onToggleMapPick,
  onUseCurrentLocation,
  onSelectOriginPlace,
  onSelectDestinationPlace,
  onSwapPlaces,
  onStartNavigation,
  bolnaTelemetryContext
}) => {
  const [originSearch, setOriginSearch] = useState<string>(journey.origin.name);
  const [destSearch, setDestSearch] = useState<string>(journey.destination.name);
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState<boolean>(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);

  // Dynamic place search results
  const [originResults, setOriginResults] = useState<GurgaonPlace[]>(() => searchGurgaonPlaces(journey.origin.name));
  const [destResults, setDestResults] = useState<GurgaonPlace[]>(() => searchGurgaonPlaces(journey.destination.name));
  const [isGeocodingOrigin, setIsGeocodingOrigin] = useState<boolean>(false);
  const [isGeocodingDest, setIsGeocodingDest] = useState<boolean>(false);

  // Active highlighted item index for keyboard navigation
  const [originActiveIdx, setOriginActiveIdx] = useState<number>(0);
  const [destActiveIdx, setDestActiveIdx] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Bolna FRIDAY Voice Call state
  const [callState, setCallState] = React.useState<CallState>('idle');
  useEffect(() => {
    const unsub = bolnaVoiceService.subscribeState((st) => setCallState(st));
    return unsub;
  }, []);

  // Sync inputs whenever selected journey origin or destination changes externally (e.g. Map Pick)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOriginSearch(journey.origin.name);
    }, 0);
    return () => clearTimeout(timer);
  }, [journey.origin.name]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDestSearch(journey.destination.name);
    }, 0);
    return () => clearTimeout(timer);
  }, [journey.destination.name]);

  // Dynamic search & geocoding for Origin
  useEffect(() => {
    const local = searchGurgaonPlaces(originSearch);
    setOriginResults(local);
    setOriginActiveIdx(0);

    const q = originSearch.trim();
    if (!q || q.length < 2 || q.toLowerCase() === journey.origin.name.toLowerCase()) {
      setIsGeocodingOrigin(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocodingOrigin(true);
      try {
        const remote = await geocodeWithNominatim(q);
        if (remote.length > 0) {
          setOriginResults((prev) => mergePlaceLists(prev, remote));
        }
      } finally {
        setIsGeocodingOrigin(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [originSearch, journey.origin.name]);

  // Dynamic search & geocoding for Destination
  useEffect(() => {
    const local = searchGurgaonPlaces(destSearch);
    setDestResults(local);
    setDestActiveIdx(0);

    const q = destSearch.trim();
    if (!q || q.length < 2 || q.toLowerCase() === journey.destination.name.toLowerCase()) {
      setIsGeocodingDest(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocodingDest(true);
      try {
        const remote = await geocodeWithNominatim(q);
        if (remote.length > 0) {
          setDestResults((prev) => mergePlaceLists(prev, remote));
        }
      } finally {
        setIsGeocodingDest(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [destSearch, journey.destination.name]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOriginDropdownOpen(false);
        setIsDestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selection handlers
  const handleSelectOrigin = (place: GurgaonPlace) => {
    onSelectOriginPlace(place);
    setOriginSearch(place.name);
    setIsOriginDropdownOpen(false);
  };

  const handleSelectDest = (place: GurgaonPlace) => {
    onSelectDestinationPlace(place);
    setDestSearch(place.name);
    setIsDestDropdownOpen(false);
  };

  // Keyboard navigation for Origin
  const handleOriginKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (originResults.length > 0) {
        handleSelectOrigin(originResults[originActiveIdx] || originResults[0]);
      } else {
        const resolved = await resolveTextToPlace(originSearch);
        if (resolved) handleSelectOrigin(resolved);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOriginActiveIdx((prev) => Math.min(prev + 1, Math.max(0, originResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOriginActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setIsOriginDropdownOpen(false);
    }
  };

  // Keyboard navigation for Destination (handles Enter for "Sector 45", "Ambedkar Chowk", etc.)
  const handleDestKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (destResults.length > 0) {
        handleSelectDest(destResults[destActiveIdx] || destResults[0]);
      } else {
        const resolved = await resolveTextToPlace(destSearch);
        if (resolved) handleSelectDest(resolved);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestActiveIdx((prev) => Math.min(prev + 1, Math.max(0, destResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setIsDestDropdownOpen(false);
    }
  };

  // Start ride with auto-resolution of any uncommitted typed destination
  const handleStartRide = async () => {
    const trimmedDest = destSearch.trim();
    if (trimmedDest && trimmedDest.toLowerCase() !== journey.destination.name.toLowerCase()) {
      const resolved = await resolveTextToPlace(trimmedDest);
      if (resolved) {
        onSelectDestinationPlace(resolved);
      }
    }
    onStartNavigation();
  };

  const handleToggleFridayCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (callState === 'active' || callState === 'connecting' || callState === 'ringing') {
      await bolnaVoiceService.stopCall();
    } else {
      await bolnaVoiceService.startCall(bolnaTelemetryContext);
    }
  };

  const isFridayActive = callState === 'active';
  const isFridayConnecting = callState === 'connecting' || callState === 'ringing';

  // Quick preset shortcuts
  const handleQuickPreset = (originId: string, destId: string) => {
    const orig = getPlaceById(originId);
    const dest = getPlaceById(destId);
    if (orig && dest) {
      onSelectOriginPlace(orig);
      onSelectDestinationPlace(dest);
      setOriginSearch(orig.name);
      setDestSearch(dest.name);
    }
  };

  // Category badge formatting
  const getCategoryLabel = (category: GurgaonPlace['category']) => {
    switch (category) {
      case 'sector':
        return 'Sector';
      case 'junction':
        return 'Chowk';
      case 'hospital':
        return 'Hospital';
      case 'metro':
        return 'Metro';
      case 'mall':
        return 'Mall';
      case 'landmark':
        return 'Landmark';
      default:
        return 'Location';
    }
  };

  // Recent 3 destinations matching design
  const recentDestinations = [
    {
      id: 'place-rajiv-chowk',
      title: 'Rajiv Chowk Underpass',
      subtitle: 'Gurugram',
      distance: '8.5 km',
      place: getPlaceById('place-rajiv-chowk')
    },
    {
      id: 'place-shankar-chowk',
      title: 'Shankar Chowk (Cyber Hub)',
      subtitle: 'Gurugram',
      distance: '3.3 km',
      place: getPlaceById('place-shankar-chowk')
    },
    {
      id: 'place-signature-tower',
      title: 'Signature Tower',
      subtitle: 'Gurugram',
      distance: '4.2 km',
      place: getPlaceById('place-signature-tower')
    }
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[420px] lg:mx-0 h-full flex flex-col justify-between select-none pointer-events-none p-2 sm:p-3 transition-all duration-300"
    >
      {/* 1. Sleek Compact Top Search & Controls Container */}
      <div className="pointer-events-auto flex flex-col gap-2">
        {/* Top Navigation & Search Card (Deep Matte Blue Container - Space-Wise) */}
        <div className="bg-[#0c3973]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 shadow-2xl border border-[#1b4d8f]/60 flex flex-col gap-2">
          {/* Header Row: Title & Status + Sleek FRIDAY Voice Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <h1 className="text-white text-lg sm:text-xl font-bold tracking-tight leading-tight">
                Plan Your Route
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-gray-300 font-semibold truncate">
                  ANPR SPEED TRAP ACTIVE
                </span>
              </div>
            </div>

            {/* FRIDAY Bolna Voice AI Compact Pill Button */}
            <button
              onClick={handleToggleFridayCall}
              title={isFridayActive ? 'Click to disconnect FRIDAY call' : 'Click to talk with FRIDAY Voice AI'}
              className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-white font-mono cursor-pointer transition-all shadow-md flex-shrink-0 active:scale-95 ${
                isFridayActive
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                  : isFridayConnecting
                  ? 'bg-amber-600 animate-pulse border border-amber-400'
                  : 'bg-[#1a73e8] hover:bg-blue-600 border border-blue-400/50'
              }`}
            >
              <span className="text-[10px] font-extrabold tracking-wider uppercase">
                {isFridayActive ? 'ONLINE' : isFridayConnecting ? 'CALLING...' : 'FRIDAY'}
              </span>

              {/* Compact Waveform */}
              <div className="flex items-end gap-0.5 h-3.5">
                <span className={`w-0.5 bg-white rounded-full transition-all ${isFridayActive ? 'h-3.5 animate-pulse' : 'h-2'}`} />
                <span className={`w-0.5 bg-white rounded-full transition-all ${isFridayActive ? 'h-4 animate-pulse' : 'h-3'}`} />
                <span className={`w-0.5 bg-white rounded-full transition-all ${isFridayActive ? 'h-2.5 animate-pulse' : 'h-1.5'}`} />
                <span className={`w-0.5 bg-white rounded-full transition-all ${isFridayActive ? 'h-3.5 animate-pulse' : 'h-2.5'}`} />
              </div>
            </button>
          </div>

          {/* Stacked Input Fields with Swap Icon (Compact Sleek Design) */}
          <div className="bg-[#082850]/90 rounded-xl p-2 flex items-center justify-between gap-1.5 border border-[#143a6d]">
            <div className="flex-1 flex flex-col gap-1.5">
              {/* Origin Row */}
              <div className="relative flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#1a73e8] flex-shrink-0" />
                  <input
                    type="text"
                    value={originSearch}
                    onChange={(e) => {
                      setOriginSearch(e.target.value);
                      setIsOriginDropdownOpen(true);
                    }}
                    onFocus={() => setIsOriginDropdownOpen(true)}
                    onKeyDown={handleOriginKeyDown}
                    placeholder="Your Location..."
                    className="bg-transparent text-white text-xs sm:text-sm font-medium w-full focus:outline-none placeholder-gray-400 truncate py-0.5"
                  />
                  {originSearch && (
                    <button
                      onClick={() => {
                        setOriginSearch('');
                        setIsOriginDropdownOpen(true);
                      }}
                      className="p-0.5 text-gray-400 hover:text-white"
                      title="Clear origin"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  onClick={onUseCurrentLocation}
                  className="bg-[#1a73e8] hover:bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer flex-shrink-0 transition-colors shadow-sm"
                >
                  My Location
                </button>

                {/* Dropdown for origin selection */}
                {isOriginDropdownOpen && (
                  <div className="absolute top-7 left-0 right-0 bg-[#061e3d] border border-blue-500/40 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                    {isGeocodingOrigin && (
                      <div className="px-3 py-1.5 text-[11px] text-blue-300 flex items-center gap-1.5 border-b border-gray-800 bg-[#082245]/80">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        <span>Searching places & sectors...</span>
                      </div>
                    )}
                    {originResults.slice(0, 8).map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectOrigin(p)}
                        className={`px-3 py-1.5 text-xs cursor-pointer transition-colors border-b border-gray-800 last:border-none flex items-center justify-between ${
                          idx === originActiveIdx
                            ? 'bg-[#1a73e8] text-white'
                            : 'text-gray-200 hover:bg-[#13427c]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="font-semibold truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40 flex-shrink-0 ml-1">
                          {getCategoryLabel(p.category)}
                        </span>
                      </div>
                    ))}
                    {originResults.length === 0 && !isGeocodingOrigin && (
                      <div className="px-3 py-2 text-xs text-gray-400 text-center">
                        Press Enter to resolve address
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-[#143a6d]" />

              {/* Destination Row */}
              <div className="relative flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#ea4335] flex-shrink-0" />
                <input
                  type="text"
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    setIsDestDropdownOpen(true);
                  }}
                  onFocus={() => setIsDestDropdownOpen(true)}
                  onKeyDown={handleDestKeyDown}
                  placeholder="Destination (Sector 45, Cyber Hub)..."
                  className="bg-transparent text-white text-xs sm:text-sm font-medium w-full focus:outline-none placeholder-gray-400 truncate py-0.5"
                />
                {destSearch && (
                  <button
                    onClick={() => {
                      setDestSearch('');
                      setIsDestDropdownOpen(true);
                    }}
                    className="p-0.5 text-gray-400 hover:text-white"
                    title="Clear destination"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Dropdown for destination selection */}
                {isDestDropdownOpen && (
                  <div className="absolute top-7 left-0 right-0 bg-[#061e3d] border border-blue-500/40 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                    {isGeocodingDest && (
                      <div className="px-3 py-1.5 text-[11px] text-blue-300 flex items-center gap-1.5 border-b border-gray-800 bg-[#082245]/80">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        <span>Searching places & sectors...</span>
                      </div>
                    )}
                    {destResults.slice(0, 8).map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectDest(p)}
                        className={`px-3 py-1.5 text-xs cursor-pointer transition-colors border-b border-gray-800 last:border-none flex items-center justify-between ${
                          idx === destActiveIdx
                            ? 'bg-[#1a73e8] text-white'
                            : 'text-gray-200 hover:bg-[#13427c]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <div className="flex flex-col truncate">
                            <span className="font-semibold truncate">{p.name}</span>
                            <span className="text-[10px] text-gray-400 truncate">{p.corridor}</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40 flex-shrink-0 ml-1">
                          {getCategoryLabel(p.category)}
                        </span>
                      </div>
                    ))}
                    {destResults.length === 0 && !isGeocodingDest && (
                      <div className="px-3 py-2 text-xs text-gray-400 text-center">
                        Press Enter to plot on map
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vertical Swap Button */}
            <button
              onClick={() => {
                onSwapPlaces();
                const temp = originSearch;
                setOriginSearch(destSearch);
                setDestSearch(temp);
              }}
              title="Swap origin and destination"
              className="p-1.5 text-gray-300 hover:text-white hover:bg-[#11386b] rounded-lg cursor-pointer transition-colors flex-shrink-0 active:scale-90"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions Row: Map Pick, Home, Work */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onToggleMapPick('destination')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1 active:scale-95 ${
                isMapPickActive
                  ? 'bg-cyan-400 text-black shadow-md animate-pulse'
                  : 'bg-[#1a73e8] hover:bg-blue-600 text-white'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>{isMapPickActive ? 'Tap on Map...' : 'Map Pick'}</span>
            </button>

            <button
              onClick={() => handleQuickPreset('place-ambience', 'place-rajiv-chowk')}
              className="bg-[#143a6d] hover:bg-[#1a73e8] text-white px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors active:scale-95 border border-blue-400/20"
            >
              Home
            </button>

            <button
              onClick={() => handleQuickPreset('place-cyber-city', 'place-signature-tower')}
              className="bg-[#143a6d] hover:bg-[#1a73e8] text-white px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors active:scale-95 border border-blue-400/20"
            >
              Work
            </button>
          </div>
        </div>

        {/* 2. Sleek Horizontal Recent Destinations Chips (Frees 140px+ of map space!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> Recent:
          </span>
          {recentDestinations.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.place) {
                  onSelectDestinationPlace(item.place);
                  setDestSearch(item.place.name);
                }
              }}
              className="px-2.5 py-1 rounded-full bg-[#0c3973]/90 hover:bg-[#144788] border border-[#1b4d8f]/60 text-[11px] text-white flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <span className="font-semibold">{item.title.split('(')[0].trim()}</span>
              <span className="text-[9px] text-blue-200 font-mono">({item.distance})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Floating Bottom Action Dock (Clean, Space-Wise, Modern Automotive UI) */}
      <div className="pointer-events-auto w-full bg-white/95 backdrop-blur-md text-gray-900 rounded-2xl p-2 px-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] border border-white/80 flex items-center justify-between gap-2.5 mb-2 transition-all">
        {/* Left: Clear / Reset Route Button */}
        <button
          onClick={() => {
            setOriginSearch(GURGAON_PLACES[0].name);
            setDestSearch(GURGAON_PLACES[8].name);
            onSelectOriginPlace(GURGAON_PLACES[0]);
            onSelectDestinationPlace(GURGAON_PLACES[8]);
          }}
          title="Reset route to default"
          className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-red-500 cursor-pointer shadow-sm transition-all flex-shrink-0 active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Center: Glowing Start Simulation Button with Route Stats */}
        <button
          onClick={handleStartRide}
          disabled={isLoadingRoute}
          className="flex-1 bg-gradient-to-r from-[#1a73e8] to-[#1258b5] hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-2 px-3 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] min-w-0"
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight">
                {isLoadingRoute ? 'Calculating Route...' : 'Start Simulation'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-blue-100 font-medium">
              {(journey.totalDistance_m / 1000).toFixed(1)} km • {journey.cameras.length} ANPR Cameras
            </span>
          </div>
        </button>

        {/* Right: Map Pick or Corridor Fork Button */}
        <button
          onClick={() => onToggleMapPick('destination')}
          title="Pick destination on map"
          className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer shadow-sm transition-all flex-shrink-0 active:scale-95 ${
            isMapPickActive
              ? 'bg-cyan-400 text-black border-cyan-500 shadow-md animate-pulse'
              : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-[#1a73e8]'
          }`}
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
