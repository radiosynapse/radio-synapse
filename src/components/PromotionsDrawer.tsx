import { useState, useEffect } from 'react';
import { 
  Tag, ShoppingBag, 
  Loader2, AlertCircle, RefreshCw, Flame, Check, Lock, Copy
} from 'lucide-react';
import Drawer from './Drawer';
import { fetchSupabasePromotions, AdminPromotion, getAdminPromotions } from '../utils/adminStore';
import { SynapseUser, ConnectedAccount } from '../types';
import { getUserPoints, spendUserPoints, isPromoPurchasedByUser } from '../utils/loyaltyStore';

interface PromotionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  currentUser?: SynapseUser | null;
  connectedAccount?: ConnectedAccount | null;
  onOpenConnectModal?: () => void;
  onOpenAdminPanel?: () => void;
}

export default function PromotionsDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
  currentUser,
  connectedAccount,
  onOpenConnectModal,
}: PromotionsDrawerProps) {
  const [promotions, setPromotions] = useState<AdminPromotion[]>(() => getAdminPromotions());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(() => getUserPoints(currentUser));
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [purchaseSuccessId, setPurchaseSuccessId] = useState<string | null>(null);

  const isUserConnected = !!currentUser || !!connectedAccount;
  const activeUserId = currentUser?.id || currentUser?.email || connectedAccount?.userId || '';

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
      setUserPoints(getUserPoints(currentUser));
    }
  }, [isOpen, currentUser]);

  // Sync live points updates
  useEffect(() => {
    const handlePointsChange = (e: any) => {
      if (typeof e.detail?.points === 'number') {
        setUserPoints(e.detail.points);
      } else {
        setUserPoints(getUserPoints(currentUser));
      }
    };
    window.addEventListener('synapse_points_changed', handlePointsChange);
    return () => window.removeEventListener('synapse_points_changed', handlePointsChange);
  }, [currentUser]);

  const handlePurchaseWithPoints = (promo: AdminPromotion) => {
    if (!isUserConnected || !activeUserId) {
      onOpenConnectModal?.();
      return;
    }

    const cost = promo.pointsCost || 100;
    if (userPoints < cost) return;

    const success = spendUserPoints(activeUserId, cost, promo.id);
    if (success) {
      // Update local promo remaining stock if limited
      if (promo.isStockLimited && typeof promo.remainingStock === 'number') {
        setPromotions((prev) =>
          prev.map((p) =>
            p.id === promo.id
              ? { ...p, remainingStock: Math.max(0, (p.remainingStock ?? 1) - 1) }
              : p
          )
        );
      }
      setPurchaseSuccessId(promo.id);
      setTimeout(() => setPurchaseSuccessId(null), 4000);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

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
      subtitle="Codes promos et privilèges partenaires à débloquer avec vos points de fidélité"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-3.5 py-1">

        {/* 1. NON-CONNECTED LOCK STATE */}
        {!isUserConnected ? (
          <div className="py-12 px-6 rounded-3xl bg-zinc-950/80 border border-amber-500/30 flex flex-col items-center justify-center text-center gap-4 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-white font-futuristic">
                Offres Réservées aux Membres Connectés
              </h3>
              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Les promotions partenaires, réductions vinyles, places de concert et codes exclusifs 
                sont réservés aux auditeurs identifiés. Connectez-vous pour échanger vos points de fidélité 
                gagnés sur les défis !
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenConnectModal?.();
              }}
              className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-futuristic font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all cursor-pointer transform active:scale-95"
            >
              Se connecter ou Créer un compte
            </button>
          </div>
        ) : (
          <>
            {/* 2. CONNECTED USER POINTS BALANCE HEADER */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-amber-950/30 border border-emerald-500/30 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-inner">
                  <Flame className="w-5 h-5 fill-amber-500/20 text-amber-400" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                    Vos Points Fidélité Disponibles
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-futuristic font-black text-white">
                      {userPoints.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">PTS</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  disabled={isLoading}
                  title="Actualiser"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {isLoading && promotions.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Chargement des offres promotionnelles...</span>
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
                    Revenez régulièrement pour découvrir les nouveaux codes promos déblocables avec vos points.
                  </p>
                </div>
              </div>
            )}

            {/* PROMOTIONS LIST */}
            <div className="flex flex-col gap-3">
              {promotions.map((p, idx) => {
                const isPurchased = isPromoPurchasedByUser(activeUserId, p.id);
                const hasCost = typeof p.pointsCost === 'number' && p.pointsCost > 0;
                const cost = p.pointsCost || 0;
                const canAfford = userPoints >= cost;
                const isStockExhausted = p.isStockLimited && typeof p.remainingStock === 'number' && p.remainingStock <= 0;
                const hasJustPurchased = purchaseSuccessId === p.id;
                const isCopied = copiedCodeId === p.id;

                return (
                  <div
                    key={`promo-${p.id || 'promo'}-${idx}`}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-3 ${
                      isPurchased || hasJustPurchased
                        ? 'bg-emerald-950/25 border-emerald-500/40'
                        : 'bg-zinc-950/90 border-white/10'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                            {p.tag || 'Offre Spéciale'}
                          </span>
                          
                          {/* Cost Badge */}
                          {hasCost ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400" />
                              <span>{cost} PTS</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-mono font-bold">
                              Gratuit
                            </span>
                          )}

                          {/* Stock Badge */}
                          {p.isStockLimited ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                              isStockExhausted 
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}>
                              {isStockExhausted ? 'Stock Épuisé' : `${p.remainingStock ?? p.initialStock ?? 10} restants`}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-mono">
                              Stock illimité
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-white font-futuristic mt-0.5">
                          {p.title}
                        </h4>
                      </div>

                      {/* Price indicator */}
                      <div className="flex flex-col items-end text-right flex-shrink-0">
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {p.price}
                        </span>
                        {p.oldPrice && (
                          <span className="text-[11px] font-mono text-zinc-500 line-through">
                            {p.oldPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                      {p.desc}
                    </p>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2 flex-wrap">
                      <div className="text-[11px] font-mono text-zinc-400">
                        {p.type || 'Partenariat'}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* If already purchased or free: show code */}
                        {isPurchased || hasJustPurchased || !hasCost ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                              Code : {p.codePromo || 'SYNAPSEVIP'}
                            </span>
                            <button
                              onClick={() => handleCopyCode(p.codePromo || 'SYNAPSEVIP', p.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Copier le code promo"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                            </button>
                          </div>
                        ) : (
                          /* Purchase with points button */
                          <button
                            disabled={!canAfford || isStockExhausted}
                            onClick={() => handlePurchaseWithPoints(p)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                              isStockExhausted
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                                : canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5" />
                            {isStockExhausted
                              ? 'Stock épuisé'
                              : canAfford
                              ? `Acheter (${cost} pts)`
                              : `Manque ${cost - userPoints} pts`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </Drawer>
  );
}
