import { useState } from 'react';
import { 
  ToggleLeft, 
  ToggleRight, 
  ShieldAlert, 
  Sparkles, 
  RotateCcw, 
  Radio, 
  Check, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { 
  SITE_FEATURES_CATALOG, 
  SiteFeatureId, 
  useSiteFeatureFlags, 
  updateSiteFeatureFlags 
} from '../utils/siteFeatureFlagsStore';

interface AdminFeatureFlagsViewProps {
  showToast: (msg: string) => void;
}

export function AdminFeatureFlagsView({ showToast }: AdminFeatureFlagsViewProps) {
  const { flags, toggleFlag, resetFlags } = useSiteFeatureFlags();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'community' | 'audience' | 'audio' | 'interactive'>('all');

  const activeCount = Object.values(flags).filter(Boolean).length;
  const totalCount = SITE_FEATURES_CATALOG.length;

  const handleApplyPresetV1 = () => {
    updateSiteFeatureFlags({
      challenges: false, // Explicitly disabled for v1 as requested by user
      promotions: true,
      events: true,
      programming: true,
      webdj: true,
      messages: true,
      equalizer: true,
      cast: true,
      minidisc_stories: true,
      history_replay: true,
      song_requests: true,
    });
    showToast('🚀 Préréglage Version 1.0 appliqué (Défis masqués)');
  };

  const handleApplyPresetAll = () => {
    const allOn: Partial<Record<SiteFeatureId, boolean>> = {};
    SITE_FEATURES_CATALOG.forEach((item) => {
      allOn[item.id] = true;
    });
    updateSiteFeatureFlags(allOn);
    showToast('✨ Toutes les fonctionnalités ont été activées');
  };

  const handleApplyPresetMinimal = () => {
    updateSiteFeatureFlags({
      challenges: false,
      promotions: false,
      events: false,
      programming: true,
      webdj: false,
      messages: true,
      equalizer: true,
      cast: true,
      minidisc_stories: false,
      history_replay: true,
      song_requests: false,
    });
    showToast('🎧 Mode Minimaliste activé (Audio & Direct)');
  };

  const filteredFeatures = SITE_FEATURES_CATALOG.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="flex flex-col w-full min-w-0">
      
      {/* 1. STICKY TOP BAR - FIRST ELEMENT, FLUSH TO TOP HEADER, 100% OPAQUE */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Gestion des Fonctionnalités du Site
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SUPER ADMIN
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span><strong>{activeCount}</strong>/{totalCount} modules</span>
          </div>
        </div>
      </div>

      {/* CONTENT CONTAINER (PASSES BEHIND STICKY TOP BAR) */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 text-left">
        
        {/* PRESETS & ACTION BAR */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            <span className="text-zinc-400 text-[11px]">Préréglages rapides :</span>
            
            <button
              onClick={handleApplyPresetV1}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Version 1.0 (Sans Défis)</span>
            </button>

            <button
              onClick={handleApplyPresetAll}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tout Activer</span>
            </button>

            <button
              onClick={handleApplyPresetMinimal}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mode Minimaliste</span>
            </button>
          </div>

          <button
            onClick={() => {
              resetFlags();
              showToast('Rétablissement des valeurs par défaut');
            }}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto text-xs font-mono"
            title="Rétablir la configuration d'usine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Défaut</span>
          </button>
        </div>

        {/* CATEGORY FILTER CHIPS */}
        <div className="flex flex-wrap items-center gap-1.5 border border-zinc-800/80 bg-zinc-950 p-2 rounded-2xl shadow-md font-mono text-xs">
          {[
            { id: 'all', label: 'Tous les modules' },
            { id: 'community', label: 'Fidélité & Communauté' },
            { id: 'audience', label: 'Programmes & Agenda' },
            { id: 'interactive', label: 'Interactivité & Dédicaces' },
            { id: 'audio', label: 'Moteurs Audio & Diffusion' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

      {/* 3. FEATURE CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFeatures.map((feat) => {
          const isEnabled = flags[feat.id] ?? true;
          const IconComponent = feat.icon;

          return (
            <div
              key={feat.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                isEnabled
                  ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  : 'bg-zinc-950/80 border-zinc-900/80 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    isEnabled 
                      ? 'bg-zinc-800/80 border-zinc-700 text-white' 
                      : 'bg-zinc-950 border-zinc-900 text-zinc-600'
                  }`}>
                    <IconComponent className={`w-5 h-5 ${isEnabled ? feat.color : 'text-zinc-600'}`} />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{feat.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                        isEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {isEnabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>

                {/* TOGGLE SWITCH */}
                <button
                  id={`feature-toggle-${feat.id}`}
                  onClick={() => {
                    const next = toggleFlag(feat.id);
                    showToast(next ? `✅ "${feat.name}" activé` : `🚫 "${feat.name}" désactivé et masqué`);
                  }}
                  className={`shrink-0 p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                  }`}
                  title={isEnabled ? 'Désactiver la fonctionnalité' : 'Activer la fonctionnalité'}
                >
                  {isEnabled ? (
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-zinc-500" />
                  )}
                </button>
              </div>

              {/* IMPACT & LOCATIONS BANNER */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-1.5 text-[10.5px] font-mono">
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="flex items-center gap-1">
                    {isEnabled ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-rose-400" />}
                    {isEnabled ? 'Visible sur :' : 'Masqué pour les utilisateurs et l\'admin :'}
                  </span>
                  <span className="text-zinc-400">ID: {feat.id}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {feat.userFacingLocations.map((loc) => (
                    <span 
                      key={loc}
                      className={`px-2 py-0.5 rounded text-[9.5px] border ${
                        isEnabled
                          ? 'bg-zinc-950 text-zinc-300 border-zinc-800'
                          : 'bg-zinc-950 text-zinc-600 border-zinc-900 line-through'
                      }`}
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      </div>
    </div>
  );
}
