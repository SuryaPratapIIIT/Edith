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
  GitFork,
  Radio,
  Wifi,
  BatteryMedium,
  Loader2,
  Navigation,
  Building2,
  Crosshair
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
      className="relative w-full max-w-[420px] lg:mx-0 min-h-[780px] flex flex-col justify-between select-none pointer-events-none p-2 sm:p-4 transition-all duration-300"
    >
      {/* 1. Phone Top Status Bar + Main Card Container */}
      <div className="pointer-events-auto flex flex-col gap-3">
        {/* Smartphone Status Bar (11:00, Signal, Battery) */}
        <div className="flex items-center justify-between px-3 text-white text-xs font-semibold drop-shadow-md">
          <span>11:00</span>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <BatteryMedium className="w-4 h-4" />
          </div>
        </div>

        {/* Top Navigation & Search Card (Deep Matte Blue Container) */}
        <div className="bg-[#0c3973] rounded-[28px] p-4 shadow-2xl border border-[#1b4d8f]/50 flex flex-col gap-3">
          {/* Header Row: Back Link + Large Heading + FRIDAY Button */}
          <div className="flex items-start justify-between">
            <div className="pt-2">
              <h1 className="text-white text-2xl font-bold tracking-tight">
                Plan Your Route
              </h1>
            </div>

            {/* FRIDAY Bolna Voice AI Square Button */}
            <button
              onClick={handleToggleFridayCall}
              title={isFridayActive ? 'Click to disconnect FRIDAY call' : 'Click to talk with FRIDAY Voice AI'}
              className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-between p-2 text-white font-mono cursor-pointer transition-all shadow-md ${
                isFridayActive
                  ? 'bg-gradient-to-b from-emerald-600 to-teal-700 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : isFridayConnecting
                  ? 'bg-amber-600 animate-pulse border border-amber-400'
                  : 'bg-[#1a73e8] hover:bg-blue-600 border border-blue-400/50'
              }`}
            >
              <span className="text-[10px] font-bold tracking-wider uppercase">
                {isFridayActive ? 'ONLINE' : 'FRIDAY'}
              </span>

              {/* Waveform graphic */}
              <div className="flex items-end gap-1 h-6 px-1 my-auto">
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-5 animate-pulse' : 'h-3'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-6 animate-pulse' : 'h-5'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-4 animate-pulse' : 'h-2'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-5 animate-pulse' : 'h-4'}`} />
              </div>

              <span className="text-[8px] font-extrabold tracking-tight text-center leading-tight">
                {isFridayActive ? 'CONNECTED' : isFridayConnecting ? 'CONNECTING...' : 'TALK TO FRIDAY'}
              </span>
            </button>
          </div>

          {/* Status Banner Strip with Red Dot */}
          <div className="bg-[#071933] rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs font-semibold text-gray-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="truncate">ANPR SPEED TRAP ACTIVE • Route Safe</span>
          </div>

          {/* Stacked Input Fields with Swap Icon */}
          <div className="bg-[#082850] rounded-2xl p-2.5 flex items-center justify-between gap-2 border border-[#143a6d]">
            <div className="flex-1 flex flex-col gap-2">
              {/* Origin Row */}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MapPin className="w-4 h-4 text-[#1a73e8] flex-shrink-0" />
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
                    className="bg-transparent text-white text-sm font-medium w-full focus:outline-none placeholder-gray-400 truncate"
                  />
                  {originSearch && (
                    <button
                      onClick={() => {
                        setOriginSearch('');
                        setIsOriginDropdownOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Clear origin"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={onUseCurrentLocation}
                  className="bg-[#1a73e8] hover:bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer flex-shrink-0 transition-colors shadow-sm"
                >
                  My Location
                </button>

                {/* Dropdown for origin selection */}
                {isOriginDropdownOpen && (
                  <div className="absolute top-8 left-0 right-0 bg-[#061e3d] border border-blue-500/40 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto">
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
                        className={`px-3 py-2 text-xs cursor-pointer transition-colors border-b border-gray-800 last:border-none flex items-center justify-between ${
                          idx === originActiveIdx
                            ? 'bg-[#1a73e8] text-white'
                            : 'text-gray-200 hover:bg-[#13427c]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="font-semibold truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40 flex-shrink-0 ml-1">
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
              <div className="relative flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#ea4335] flex-shrink-0" />
                <input
                  type="text"
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    setIsDestDropdownOpen(true);
                  }}
                  onFocus={() => setIsDestDropdownOpen(true)}
                  onKeyDown={handleDestKeyDown}
                  placeholder="Search destination (e.g. Sector 45, Cyber Hub)..."
                  className="bg-transparent text-white text-sm font-medium w-full focus:outline-none placeholder-gray-400 truncate"
                />
                {destSearch && (
                  <button
                    onClick={() => {
                      setDestSearch('');
                      setIsDestDropdownOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                    title="Clear destination"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Dropdown for destination selection */}
                {isDestDropdownOpen && (
                  <div className="absolute top-8 left-0 right-0 bg-[#061e3d] border border-blue-500/40 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto">
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
                        className={`px-3 py-2 text-xs cursor-pointer transition-colors border-b border-gray-800 last:border-none flex items-center justify-between ${
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40 flex-shrink-0 ml-1">
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
              className="p-2 text-gray-300 hover:text-white hover:bg-[#11386b] rounded-xl cursor-pointer transition-colors flex-shrink-0"
            >
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions Row: Map Pick, Home, Work */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onToggleMapPick('destination')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                isMapPickActive
                  ? 'bg-cyan-400 text-black shadow-md animate-pulse'
                  : 'bg-[#1a73e8] hover:bg-blue-600 text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isMapPickActive ? 'Tap on Map...' : 'Map Pick'}</span>
            </button>

            <button
              onClick={() => handleQuickPreset('place-ambience', 'place-rajiv-chowk')}
              className="bg-[#1a73e8] hover:bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
            >
              Home
            </button>

            <button
              onClick={() => handleQuickPreset('place-cyber-city', 'place-signature-tower')}
              className="bg-[#1a73e8] hover:bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
            >
              Work
            </button>
          </div>
        </div>

        {/* 2. Recent Destinations List (Middle Floating Card) */}
        <div className="bg-[#0c3973]/95 backdrop-blur-md rounded-2xl p-1 shadow-2xl border border-[#1b4d8f]/50 flex flex-col">
          {recentDestinations.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.place) {
                  onSelectDestinationPlace(item.place);
                  setDestSearch(item.place.name);
                }
              }}
              className={`p-3 flex items-center justify-between cursor-pointer hover:bg-[#144788] transition-colors rounded-xl ${
                idx !== recentDestinations.length - 1 ? 'border-b border-[#184883]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-white text-sm font-semibold leading-tight">
                    {item.title}
                  </span>
                  <span className="text-gray-300 text-xs">{item.subtitle}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-gray-300 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{item.distance}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Bottom Action Sheet (Fixed White Card with Rounded Top Corners) */}
      <div className="pointer-events-auto bg-white text-gray-900 rounded-t-[32px] p-4 shadow-[0_-10px_35px_rgba(0,0,0,0.5)] flex flex-col gap-2 mt-4">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-1" />

        <div className="flex items-center justify-between gap-3">
          {/* Left Close Button */}
          <button
            onClick={() => {
              setOriginSearch(GURGAON_PLACES[0].name);
              setDestSearch(GURGAON_PLACES[8].name);
              onSelectOriginPlace(GURGAON_PLACES[0]);
              onSelectDestinationPlace(GURGAON_PLACES[8]);
            }}
            title="Clear route"
            className="w-12 h-12 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-[#1a73e8] cursor-pointer shadow-sm transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Center: Large Bright Blue Button */}
          <button
            onClick={handleStartRide}
            disabled={isLoadingRoute}
            className="flex-1 bg-[#1a73e8] hover:bg-blue-600 text-white rounded-2xl py-3 px-4 shadow-lg flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
          >
            <span className="text-base font-bold tracking-tight">
              {isLoadingRoute ? 'Calculating Route...' : 'Start Simulation'}
            </span>
            <span className="text-xs text-blue-100 font-medium">
              or Choose on Map
            </span>
          </button>

          {/* Right Route Fork Button */}
          <button
            onClick={handleStartRide}
            title="Inspect road corridor"
            className="w-12 h-12 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-[#1a73e8] cursor-pointer shadow-sm transition-all flex-shrink-0"
          >
            <GitFork className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
