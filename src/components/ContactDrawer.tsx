import { useState } from 'react';
import { Mail, Send, Radio, Check, Globe } from 'lucide-react';
import Drawer from './Drawer';
import { addListenerMessage } from '../utils/adminStore';

interface ContactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

export default function ContactDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
}: ContactDrawerProps) {
  const [authorName, setAuthorName] = useState('');
  const [email, setEmail] = useState('');
  const [dedicationMessage, setDedicationMessage] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dedicationMessage.trim()) return;

    addListenerMessage(
      authorName || 'Auditeur Synapse',
      email,
      dedicationMessage,
      'dedicace'
    );

    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setDedicationMessage('');
      setAuthorName('');
      setEmail('');
    }, 4000);
  };

  return (
    <Drawer
      id="contact-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div 
            className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-400/40 text-pink-300"
            style={{ borderColor: `${accentColor}60` }}
          >
            <Mail className="w-4 h-4" />
          </div>
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100">
            CONTACT & DÉDICACES STUDIO
          </span>
        </div>
      }
      subtitle="Envoyez un message direct à l'antenne, contactez l'équipe ou soumettez un titre"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-4 py-1">

        {/* Live Studio Dedication Form */}
        <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Message ou Dédicace à l'Antenne
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              DIRECT STUDIO
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono text-zinc-400 text-left">
                Prénom / Pseudo :
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ex: Thomas de Nantes"
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono text-zinc-400 text-left">
                Adresse E-mail (facultatif) :
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="thomas@exemple.fr"
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-zinc-400 text-left">
              Votre Message / Dédicace / Demande de titre :
            </label>
            <textarea
              rows={3}
              value={dedicationMessage}
              onChange={(e) => setDedicationMessage(e.target.value)}
              placeholder="Un petit coucou pour la session Nu-Disco..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-all resize-none"
            />
          </div>

          {isSent ? (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Votre message a été transmis aux animateurs en régie ! Merci.</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!dedicationMessage.trim()}
              className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Transmettre au studio</span>
            </button>
          )}
        </form>

        {/* Contact Info & Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-1 text-left">
            <div className="flex items-center gap-2 text-pink-400 text-xs font-mono font-bold uppercase">
              <Mail className="w-3.5 h-3.5" />
              <span>Courriel Rédaction</span>
            </div>
            <span className="text-sm font-mono text-white font-bold">contact@radiosynapse.fr</span>
            <span className="text-[10px] font-mono text-zinc-400">Pour partenariats & programmation</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-1 text-left">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase">
              <Globe className="w-3.5 h-3.5" />
              <span>Réseaux Sociaux</span>
            </div>
            <span className="text-sm font-mono text-white font-bold">@RadioSynapseLive</span>
            <span className="text-[10px] font-mono text-zinc-400">Instagram, Soundcloud, X</span>
          </div>

        </div>

      </div>
    </Drawer>
  );
}
