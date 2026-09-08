import { useState, useEffect } from 'react';
import { Tag, ShoppingBag, Sparkles, ExternalLink, Ticket, Disc, Loader2, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import Drawer from './Drawer';
import { fetchSupabasePromotions, AdminPromotion, getAdminPromotions } from '../utils/adminStore';

interface PromotionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  onOpenAdminPanel?: () => void;
}

export default function PromotionsDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
  onOpenAdminPanel,
}: PromotionsDrawerProps) {
  const [promotions, setPromotions] = useState<AdminPromotion[]>(() => getAdminPromotions());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchSupabasePromotions();
    if (res.error && res.data.length === 0) {
      setError(res.error);
    } else {
      setPromotions(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  return (
    <Drawer
      id="promotions-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div 
            className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300"
            style={{ borderColor: `${accentColor}60` }}
          >
            <Tag className="w-4 h-4" />
          </div>
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100">
            PROMOTIONS & OFFRES EXCLUSIVES
          </span>
        </div>
      }
      subtitle="Bons plans auditeurs, merch officiel, vinyles et réductions partenaires"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-3 py-1">

        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Privilèges Membres Synapse ({promotions.length})
          </span>
          <button
            onClick={loadData}
            disabled={isLoading}
            title="Actualiser depuis Supabase"
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading && promotions.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Chargement des offres depuis Supabase...</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && promotions.length === 0 && (
          <div className="py-10 px-4 rounded-2xl bg-zinc-950/60 border border-dashed border-white/15 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-white font-futuristic">
                Aucune promotion enregistrée
              </span>
              <p className="text-xs text-zinc-400 font-mono max-w-sm">
                Les offres partenaires, disques vinyles et codes promos configurés dans le tableau de bord apparaîtront ici.
              </p>
            </div>
            {onOpenAdminPanel && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une promotion dans l'Admin</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {promotions.map((p, index) => {
            const IconComponent = p.type === 'Merchandising' ? Disc : p.type === 'Billetterie' ? Ticket : ShoppingBag;
            return (
              <div
                key={`promo-${p.id || 'promo'}-${index}`}
                className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 flex flex-col gap-2.5 text-left shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex-shrink-0">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        {p.tag}
                      </span>
                      <h4 className="text-sm font-bold text-white font-futuristic mt-1">
                        {p.title}
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                  {p.desc}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-bold text-white font-mono">{p.price}</span>
                    {p.oldPrice && (
                      <span className="text-xs font-mono text-zinc-500 line-through">{p.oldPrice}</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (p.codePromo) {
                        navigator.clipboard?.writeText(p.codePromo);
                        alert(`Code promo "${p.codePromo}" copié !`);
                      } else {
                        alert(`Profiter de l'offre : ${p.title}`);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{p.codePromo ? `Code: ${p.codePromo}` : 'Profiter'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </Drawer>
  );
}
