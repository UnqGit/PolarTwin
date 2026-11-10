import React, { useState } from 'react';
import {
  Layers,
  CloudSnow,
  Sun,
  Moon,
  Monitor,
  Activity,
  Maximize2,
  ChevronDown,
  Flame,
  Box,
} from 'lucide-react';
import { useTwinVisual, type VisualMode, type AtmosphereMode } from './TwinVisualContext';
import { useTheme } from './ThemeContext';

interface TwinViewerToolbarProps {
  onResetCamera?: () => void;
  style?: React.CSSProperties;
}

export const TwinViewerToolbar: React.FC<TwinViewerToolbarProps> = ({
  onResetCamera,
  style,
}) => {
  const {
    visualMode,
    setVisualMode,
    explodedFactor,
    setExplodedFactor,
    weatherEnabled,
    setWeatherEnabled,
    atmosphereMode,
    setAtmosphereMode,
    flowAnimationEnabled,
    setFlowAnimationEnabled,
  } = useTwinVisual();

  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [isAtmosphereMenuOpen, setIsAtmosphereMenuOpen] = useState(false);

  const modeButtons: { mode: VisualMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      mode: 'realistic',
      label: 'Polar Pod',
      icon: <Box size={14} />,
      desc: 'Physical modular Antarctic pods on stilts with insulated panel cladding',
    },
    {
      mode: 'holographic',
      label: 'Holo-CAD',
      icon: <Layers size={14} />,
      desc: 'Tactical translucent glass with glowing cyan wireframe edges',
    },
    {
      mode: 'thermal',
      label: 'Thermal',
      icon: <Flame size={14} />,
      desc: 'Telemetry infrared heat gradient mapping component load & temperature',
    },
  ];

  const currentPercent = Math.round(explodedFactor * 100);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* ── Main Glassmorphic Control Bar (Theme-Adaptive) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 30,
          boxShadow: isLight
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 0 15px rgba(2, 132, 199, 0.15)'
            : '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.15)',
          color: isLight ? '#0f172a' : '#f8fafc',
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
          userSelect: 'none',
          transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        }}
      >
        {/* Visual Mode Segmented Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(30, 41, 59, 0.7)',
            borderRadius: 20,
            padding: 2,
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {modeButtons.map(({ mode, label, icon, desc }) => {
            const isActive = visualMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setVisualMode(mode)}
                title={desc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 16,
                  border: 'none',
                  background: isActive
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'transparent',
                  color: isActive ? '#ffffff' : isLight ? '#475569' : '#94a3b8',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(2, 132, 199, 0.4)' : 'none',
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)',
          }}
        />

        {/* Exploded View Slider Controls (0 to 100% with Knob Alignment) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            background: isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(30, 41, 59, 0.5)',
            borderRadius: 16,
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
          }}
          title="Exploded View: Vertically lifts roofs and upper decks to expose interior machinery"
        >
          <Layers size={13} color={isLight ? '#0284c7' : '#38bdf8'} />
          
          {/* Quick Snap to 0% */}
          <button
            onClick={() => setExplodedFactor(0)}
            title="Snap to 0% (Closed)"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 10,
              fontWeight: 600,
              color: currentPercent === 0 ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#94a3b8' : '#64748b'),
              cursor: 'pointer',
            }}
          >
            0%
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={currentPercent}
            onChange={(e) => setExplodedFactor(Number(e.target.value) / 100)}
            className="twin-slider"
            style={{
              width: 80,
              accentColor: isLight ? '#0284c7' : '#38bdf8',
            }}
          />

          {/* Quick Snap to 100% */}
          <button
            onClick={() => setExplodedFactor(1)}
            title="Snap to 100% (Fully Exploded)"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 10,
              fontWeight: 600,
              color: currentPercent === 100 ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#94a3b8' : '#64748b'),
              cursor: 'pointer',
            }}
          >
            100%
          </button>

          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 600,
              color: currentPercent > 0 ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#64748b' : '#94a3b8'),
              width: 32,
              textAlign: 'right',
            }}
          >
            {currentPercent}%
          </span>
        </div>

        {/* Vertical Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)',
          }}
        />

        {/* Telemetry Flow Animation Toggle */}
        <button
          onClick={() => setFlowAnimationEnabled(!flowAnimationEnabled)}
          title={flowAnimationEnabled ? 'Telemetry Flow: Active' : 'Telemetry Flow: Paused'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
            background: flowAnimationEnabled
              ? isLight ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.25)'
              : isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(51, 65, 85, 0.5)',
            color: flowAnimationEnabled ? (isLight ? '#059669' : '#34d399') : (isLight ? '#64748b' : '#94a3b8'),
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
        >
          <Activity size={14} />
        </button>

        {/* Blizzard Snow Storm Toggle */}
        <button
          onClick={() => setWeatherEnabled(!weatherEnabled)}
          title={weatherEnabled ? 'Blizzard Storm: Active' : 'Blizzard Storm: Off'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
            background: weatherEnabled
              ? isLight ? 'rgba(2, 132, 199, 0.18)' : 'rgba(56, 189, 248, 0.2)'
              : isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(51, 65, 85, 0.5)',
            color: weatherEnabled ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#64748b' : '#94a3b8'),
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
        >
          <CloudSnow size={14} />
        </button>

        {/* Atmosphere Preset Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsAtmosphereMenuOpen(!isAtmosphereMenuOpen)}
            title="Atmosphere & Lighting Preset"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 14,
              border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
              background: isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(51, 65, 85, 0.5)',
              color: isLight ? '#1e293b' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {atmosphereMode === 'polar_day' && <Sun size={13} color="#f59e0b" />}
            {atmosphereMode === 'aurora_night' && <Moon size={13} color="#10b981" />}
            {atmosphereMode === 'tactical_dark' && <Monitor size={13} color={isLight ? '#0284c7' : '#38bdf8'} />}
            <ChevronDown size={12} color={isLight ? '#64748b' : '#94a3b8'} />
          </button>

          {isAtmosphereMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(16px)',
                border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 12,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 140,
                boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.12)' : '0 8px 24px rgba(0,0,0,0.6)',
                zIndex: 40,
              }}
            >
              {[
                { mode: 'polar_day' as AtmosphereMode, label: 'Polar Day (Sun)', icon: <Sun size={13} color="#f59e0b" /> },
                { mode: 'aurora_night' as AtmosphereMode, label: 'Aurora Night', icon: <Moon size={13} color="#10b981" /> },
                { mode: 'tactical_dark' as AtmosphereMode, label: 'Tactical Dark', icon: <Monitor size={13} color={isLight ? '#0284c7' : '#38bdf8'} /> },
              ].map((item) => (
                <button
                  key={item.mode}
                  onClick={() => {
                    setAtmosphereMode(item.mode);
                    setIsAtmosphereMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: atmosphereMode === item.mode
                      ? isLight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(56, 189, 248, 0.18)'
                      : 'transparent',
                    color: atmosphereMode === item.mode
                      ? isLight ? '#0284c7' : '#38bdf8'
                      : isLight ? '#1e293b' : '#e2e8f0',
                    fontSize: 11,
                    fontWeight: atmosphereMode === item.mode ? 600 : 400,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset Camera Focus */}
        {onResetCamera && (
          <button
            onClick={onResetCamera}
            title="Reset Camera & Frame Polar Twin"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
              background: isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(51, 65, 85, 0.5)',
              color: isLight ? '#1e293b' : '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
