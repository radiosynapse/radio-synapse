import { useState } from 'react';
import { 
  X, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, 
  Check, MoveVertical, ShieldCheck, LucideIcon 
} from 'lucide-react';
import { SidebarItemConfig, AdminTab } from '../types/adminCustomization';
import { resetSidebarOrder } from '../utils/adminCustomizationStore';
import { TAB_COLOR_CONFIGS } from './AdminPanelDrawer';

interface AdminSidebarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SidebarItemConfig[];
  tabsMeta: Record<AdminTab, { label: string; sublabel: string; icon: LucideIcon }>;
  onSave: (newItems: SidebarItemConfig[]) => void;
}

export default function AdminSidebarEditorModal({
  isOpen,
  onClose,
  items,
  tabsMeta,
  onSave,
}: AdminSidebarEditorModalProps) {
  const [localItems, setLocalItems] = useState<SidebarItemConfig[]>(items);

  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localItems.length) return;

    const updated = [...localItems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setLocalItems(updated);
  };

  const toggleVisibility = (index: number) => {
    const updated = [...localItems];
    // Don't allow hiding dashboard completely
    if (updated[index].id === 'dashboard' && updated[index].visible) {
      return;
    }
    updated[index] = {
      ...updated[index],
      visible: !updated[index].visible,
    };
    setLocalItems(updated);
  };

  const handleReset = () => {
    const defaults = resetSidebarOrder();
    setLocalItems(defaults);
  };

  const handleSave = () => {
    onSave(localItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60 relative">
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] chromatic-line opacity-75 pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white relative">
              <MoveVertical className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full synapse-star-dot" />
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-base font-futuristic font-black text-white tracking-wide">
                Personnaliser le Menu Latéral
              </h3>
              <p className="text-xs font-mono text-zinc-400">
                Organisez l'ordre des sections et gérez leur visibilité
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-white/5 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-300 shrink-0" />
            <span>Utilisez les flèches pour déplacer les éléments vers le haut ou le bas. L'icône œil permet de masquer une section.</span>
          </div>

          {localItems.map((item, index) => {
            const meta = tabsMeta[item.id] || { label: item.id, sublabel: '', icon: MoveVertical };
            const Icon = meta.icon;
            const isFirst = index === 0;
            const isLast = index === localItems.length - 1;
            const isProtected = item.id === 'dashboard';

            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  item.visible
                    ? 'bg-zinc-900/80 border-zinc-800 text-white'
                    : 'bg-zinc-950/60 border-zinc-900 text-zinc-500 opacity-60'
                }`}
              >
                {/* ICON & TITLE */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-6 text-xs font-mono font-bold text-zinc-500">
                    #{index + 1}
                  </div>
                  {(() => {
                    const colorScheme = TAB_COLOR_CONFIGS[item.id as AdminTab] || {
                      text: 'text-zinc-200',
                      bg: 'bg-zinc-800',
                      border: 'border-zinc-700',
                    };
                    return (
                      <div className={`p-2 rounded-lg border transition-colors ${
                        item.visible
                          ? `${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`
                          : 'bg-zinc-900 border-zinc-850 text-zinc-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    );
                  })()}
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-mono font-bold truncate">
                      {meta.label}
                    </span>
                    {meta.sublabel && (
                      <span className="text-[10px] font-mono text-zinc-500 truncate">
                        {meta.sublabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* CONTROLS */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* MOVE UP */}
                  <button
                    onClick={() => moveItem(index, 'up')}
                    disabled={isFirst}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                    title="Déplacer vers le haut"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>

                  {/* MOVE DOWN */}
                  <button
                    onClick={() => moveItem(index, 'down')}
                    disabled={isLast}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                    title="Déplacer vers le bas"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* VISIBILITY TOGGLE */}
                  <button
                    onClick={() => toggleVisibility(index)}
                    disabled={isProtected}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isProtected
                        ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500'
                        : item.visible
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-zinc-500'
                    }`}
                    title={isProtected ? 'Tableau de bord obligatoire' : item.visible ? 'Masquer du menu' : 'Afficher dans le menu'}
                  >
                    {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-950 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-mono transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer l'ordre</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
