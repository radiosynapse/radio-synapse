import { useState, useEffect } from 'react';
import { 
  Heart, Calendar, Trophy, Tag, CalendarDays, Mail, 
  ChevronDown, ShieldCheck 
} from 'lucide-react';
import BrandLogo from './BrandLogo';

export type NavMenuItemId = 'liked-tracks' | 'programming' | 'challenges' | 'promotions' | 'events' | 'contact' | 'admin';

interface FullscreenNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMenuItem: (id: NavMenuItemId) => void;
  likedTracksCount?: number;
  isAdmin?: boolean;
}

export default function FullscreenNavMenu({
  isOpen,
  onClose,
  onSelectMenuItem,
  isAdmin = false,
}: FullscreenNavMenuProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const menuItems = [
    {
      id: 'liked-tracks' as const,
      label: 'Mes Titres Likés',
      icon: Heart,
      color: 'text-pink-400',
      hoverGlow: 'hover:text-pink-300 group-hover:border-pink-500/40',
    },
    {
      id: 'programming' as const,
      label: 'Programmation',
      icon: Calendar,
      color: 'text-purple-400',
      hoverGlow: 'hover:text-purple-300 group-hover:border-purple-500/40',
    },
    {
      id: 'challenges' as const,
      label: 'Défis',
      icon: Trophy,
      color: 'text-amber-400',
      hoverGlow: 'hover:text-amber-300 group-hover:border-amber-500/40',
    },
    {
      id: 'promotions' as const,
      label: 'Promotions',
      icon: Tag,
      color: 'text-emerald-400',
      hoverGlow: 'hover:text-emerald-300 group-hover:border-emerald-500/40',
    },
    {
      id: 'events' as const,
      label: 'Évènements',
      icon: CalendarDays,
      color: 'text-rose-400',
      hoverGlow: 'hover:text-rose-300 group-hover:border-rose-500/40',
    },
    {
      id: 'contact' as const,
      label: 'Contact',
      icon: Mail,
      color: 'text-sky-400',
      hoverGlow: 'hover:text-sky-300 group-hover:border-sky-500/40',
    },
    ...(isAdmin ? [{
      id: 'admin' as const,
      label: 'Panel Admin',
      icon: ShieldCheck,
      color: 'text-amber-400',
      hoverGlow: 'hover:text-amber-300 group-hover:border-amber-500/40',
    }] : []),
  ];

  const handleItemClick = (id: NavMenuItemId) => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      onSelectMenuItem(id);
    }, 250);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black/88 backdrop-blur-2xl flex flex-col justify-between p-3.5 sm:p-5 md:p-6 select-none overflow-hidden h-screen h-[100dvh] max-h-[100dvh] w-full max-w-full ${
        isClosing ? 'animate-slide-down-full' : 'animate-slide-up-full'
      }`}
      style={{
        backgroundColor: 'rgba(5, 5, 10, 0.92)',
      }}
    >
      {/* Top Bar of Overlay */}
      <div className="w-full max-w-md sm:max-w-lg mx-auto flex items-center justify-between relative z-10 pb-2.5 border-b border-white/10 flex-shrink-0">
        <div className="absolute -bottom-[1px] left-0 right-0 h-[1.5px] chromatic-line opacity-75 pointer-events-none" />
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" withStar={true} />
        </div>

        <button
          onClick={handleClose}
          className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer group flex items-center justify-center active:scale-95"
          aria-label="Fermer le menu"
        >
          <ChevronDown className="w-5 h-5 text-zinc-300 group-hover:text-white group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Centered Minimalist High-End Navigation Menu List - Fixed without scroll */}
      <div className="w-full max-w-md sm:max-w-lg mx-auto flex-1 min-h-0 flex flex-col justify-center gap-2 sm:gap-2.5 py-2 my-auto">
        {menuItems.map((item) => {
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl bg-zinc-950/60 hover:bg-zinc-900/90 border border-white/10 ${item.hoverGlow} transition-all duration-200 cursor-pointer flex items-center gap-3 sm:gap-4 group text-left shadow-lg relative overflow-hidden active:scale-[0.98]`}
            >
              <div className={`p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 ${item.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                <IconComp className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>

              <span className="text-sm sm:text-base font-bold font-futuristic text-white group-hover:text-white transition-colors">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
