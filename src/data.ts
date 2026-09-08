export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  coverUrl: string;
  audioUrl: string;
}

export interface StreamChannel {
  id: string;
  stationNumber?: string;
  streamUrl?: string;
  enabled?: boolean;
  name: string;
  genre: string;
  description: string;
  color: string;
  secondaryColor?: string;
  coverUrl?: string;
  tracks: Track[];
}

export interface EqualizerPreset {
  name: string;
  bands: number[]; // 10 frequency band gains in dB (-12 to +12)
  description?: string;
}

export const EQ_FREQUENCIES = [
  '32Hz',
  '64Hz',
  '125Hz',
  '250Hz',
  '500Hz',
  '1kHz',
  '2kHz',
  '4kHz',
  '8kHz',
  '16kHz'
];

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { 
    name: 'DISCO & FUNK', 
    bands: [4, 6, 3, -1, -2, 1, 3, 5, 6, 5],
    description: 'Basses percutantes, slap groove et brillance éclatante des cuivres.'
  },
  { 
    name: 'ROCK & PUNCH', 
    bands: [5, 4, 2, -2, 1, 4, 5, 3, 4, 2],
    description: 'Attaque puissante des guitares électriques et présence scénique.'
  },
  { 
    name: 'CLUB BASS', 
    bands: [8, 7, 5, 2, -1, -2, 1, 3, 6, 4],
    description: 'Sub-basses profondes et rythmique percutante pour systèmes puissants.'
  },
  { 
    name: 'VOCAL BOOST', 
    bands: [-2, -1, 0, 2, 5, 6, 4, 3, 1, 0],
    description: 'Clarté maximale des voix et présence acoustique optimale.'
  },
  { 
    name: 'LOFI CHILL', 
    bands: [4, 5, 3, 0, -2, -1, 1, -2, -4, -6],
    description: 'Chaleur vintage analogique avec adoucissement des aigus.'
  },
  { 
    name: 'NEON WAVE', 
    bands: [6, 5, 2, -1, 1, 3, 5, 6, 7, 6],
    description: 'Courbe en V optimisée pour synthwave et musique rétro-futuriste.'
  },
  { 
    name: 'FLAT (LINÉAIRE)', 
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    description: 'Réponse studio neutre et sans coloration sonore.'
  }
];

export const STREAMS: StreamChannel[] = [];

export const STANDBY_STREAM: StreamChannel = {
  id: 'standby',
  stationNumber: '--',
  streamUrl: '',
  name: 'En attente de diffusion',
  genre: 'Signal en attente',
  description: 'Aucune station active. Ajoutez une station dans le Panel Admin pour démarrer la diffusion.',
  color: '#71717a',
  enabled: false,
  tracks: [
    {
      id: 'standby-track',
      title: 'En attente de diffusion',
      artist: 'Radio Synapse',
      album: 'Signal en attente',
      duration: 0,
      coverUrl: '',
      audioUrl: '',
    },
  ],
};

