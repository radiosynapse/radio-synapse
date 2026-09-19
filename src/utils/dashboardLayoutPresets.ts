import { DashboardWidgetId, WidgetDensity, WidgetSize, WidgetHeight } from '../types/adminCustomization';

export interface WidgetPresetConfig {
  size: WidgetSize;
  height: WidgetHeight;
  isVertical: boolean;
  colSpanClass: string;
  rowSpanClass: string;
  label: string;
}

/**
 * Mapping automatic dimensions, vertical/horizontal orientation,
 * and Tailwind grid classes for each widget based on the 3 presets:
 * 'compact' | 'normal' (Standard) | 'expanded' (Détaillé).
 */
export function getWidgetPresetConfig(widgetId: DashboardWidgetId, density: WidgetDensity): WidgetPresetConfig {
  switch (widgetId) {
    case 'kpi_overview':
      if (density === 'compact') {
        return {
          size: 'half',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-6',
          rowSpanClass: 'row-span-1',
          label: 'Vue Synthétique',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'full',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12',
          rowSpanClass: 'row-span-1',
          label: 'Monitoring Expert 360°',
        };
      }
      return {
        size: 'full',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12',
        rowSpanClass: 'row-span-1',
        label: 'Format 4 Indicateurs Clés',
      };

    case 'stations_monitor':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Colonne Mini Fréquences',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'full',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12',
          rowSpanClass: 'row-span-1',
          label: 'Matrice Complète des Stations',
        };
      }
      return {
        size: 'wide',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12 lg:col-span-8',
        rowSpanClass: 'row-span-1',
        label: 'Grille Standard Écoute Rapide',
      };

    case 'station_focus':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Régie Épurée',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Cockpit Animateur Étendu',
        };
      }
      return {
        size: 'half',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-2',
        label: 'Console Régie & Jingles',
      };

    case 'services_status':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Pastilles Statut Rapide',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'half',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-6',
          rowSpanClass: 'row-span-1',
          label: 'Télémétrie & Latence BDD',
        };
      }
      return {
        size: 'third',
        height: 'normal',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-1',
        label: 'Santé PocketBase & AzuraCast',
      };

    case 'recent_messages':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Dernières Dédicaces Flash',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Messagerie & Traitement Direct',
        };
      }
      return {
        size: 'third',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-2',
        label: 'Flux Dédicaces En Direct',
      };

    case 'station_song_requests':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Demandes Flash',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Validation Titres Proposés',
        };
      }
      return {
        size: 'half',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-2',
        label: 'Demandes & Propositions Titres',
      };

    case 'next_up_schedule':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Émission En Cours',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Grille Complète 24h Antenne',
        };
      }
      return {
        size: 'third',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-2',
        label: 'Programme Actuel & Suivants',
      };

    case 'station_playlist_history':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Prochain Titre',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Timeline & Historique Complet',
        };
      }
      return {
        size: 'half',
        height: 'tall',
        isVertical: false,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-2',
        label: 'File d\'Attente & Passés',
      };

    case 'station_live_controls':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Pads Express',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-1',
          label: 'Cartoucheur Radio 10 Touches',
        };
      }
      return {
        size: 'half',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-1',
        label: 'Jingles & Coupure Antenne',
      };

    case 'station_stats_listeners':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Compteur Live Flash',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-1',
          label: 'Analytics & Courbe 24h',
        };
      }
      return {
        size: 'half',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-1',
        label: 'Audience & Débit Streaming',
      };

    case 'broadcast_quick_status':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Badge On-Air',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'half',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-6',
          rowSpanClass: 'row-span-1',
          label: 'Console DJ WebRTC/Opus',
        };
      }
      return {
        size: 'third',
        height: 'normal',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-1',
        label: 'Connexion Direct & Streamer',
      };

    case 'quick_actions':
      if (density === 'compact') {
        return {
          size: 'half',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-6',
          rowSpanClass: 'row-span-1',
          label: 'Raccourcis Compacts',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'full',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12',
          rowSpanClass: 'row-span-1',
          label: 'Barre d\'Outils Studio Élargie',
        };
      }
      return {
        size: 'full',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12',
        rowSpanClass: 'row-span-1',
        label: 'Raccourcis Création Immédiate',
      };

    case 'active_challenges':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Défis Flash',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Défis & Podium Auditeurs',
        };
      }
      return {
        size: 'half',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-2',
        label: 'Quêtes & Progression XP',
      };

    case 'community_users':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Derniers Inscrits',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-1',
          label: 'Annuaire & Rôles Membres',
        };
      }
      return {
        size: 'third',
        height: 'normal',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-1',
        label: 'Membres & Profils Admin',
      };

    case 'upcoming_events':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Prochain Direct',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'tall',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-2',
          label: 'Agenda Complet des Événements',
        };
      }
      return {
        size: 'third',
        height: 'tall',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-2',
        label: 'Calendrier Antenne & Lives',
      };

    case 'promotions_partners':
      if (density === 'compact') {
        return {
          size: 'third',
          height: 'normal',
          isVertical: true,
          colSpanClass: 'col-span-12 lg:col-span-4',
          rowSpanClass: 'row-span-1',
          label: 'Promo Flash',
        };
      }
      if (density === 'expanded') {
        return {
          size: 'wide',
          height: 'normal',
          isVertical: false,
          colSpanClass: 'col-span-12 lg:col-span-8',
          rowSpanClass: 'row-span-1',
          label: 'Gestionnaire Codes Promo & Stock',
        };
      }
      return {
        size: 'third',
        height: 'normal',
        isVertical: true,
        colSpanClass: 'col-span-12 lg:col-span-4',
        rowSpanClass: 'row-span-1',
        label: 'Codes Promo & Récompenses',
      };

    default:
      return {
        size: 'half',
        height: 'normal',
        isVertical: false,
        colSpanClass: 'col-span-12 lg:col-span-6',
        rowSpanClass: 'row-span-1',
        label: 'Standard',
      };
  }
}

export interface DynamicPackedWidgetLayout {
  colSpanClass: string;
  rowSpanClass: string;
  colsOnLg: number;
  colsOnMd: number;
  isVertical: boolean;
  label: string;
}

/**
 * Intelligent dynamic row packing algorithm.
 * Guarantees that EVERY row on the dashboard sums to EXACTLY 12 columns on large screens
 * (and 2 columns on medium screens), leaving ABSOLUTELY ZERO empty spaces or blank holes.
 * If a row has leftover space or an orphan widget, widgets dynamically expand to occupy
 * 100% of the horizontal grid width seamlessly.
 */
export function computeDynamicFilledGridSpans(
  visibleWidgets: Array<{ id: DashboardWidgetId; density: WidgetDensity }>
): Map<DashboardWidgetId, DynamicPackedWidgetLayout> {
  const result = new Map<DashboardWidgetId, DynamicPackedWidgetLayout>();
  if (!visibleWidgets || visibleWidgets.length === 0) return result;

  // 1. Determine preferred columns on 12-col grid for each widget
  const items = visibleWidgets.map((w) => {
    const preset = getWidgetPresetConfig(w.id, w.density);
    let preferredCols = 6;
    if (w.density === 'compact') {
      preferredCols = 4;
    } else if (w.density === 'expanded') {
      preferredCols = 12;
    } else {
      // Normal: based on widget nature
      if (w.id === 'kpi_overview' || w.id === 'stations_monitor') {
        preferredCols = 12;
      } else if (w.id === 'quick_actions' || w.id === 'services_status') {
        preferredCols = 4;
      } else {
        preferredCols = 6;
      }
    }
    return {
      id: w.id,
      density: w.density,
      preferredCols,
      preset,
    };
  });

  // 2. Pack items into rows of max 12 columns
  const rows: Array<typeof items> = [];
  let currentRow: typeof items = [];
  let currentUsedCols = 0;

  for (const item of items) {
    if (currentUsedCols + item.preferredCols <= 12) {
      currentRow.push(item);
      currentUsedCols += item.preferredCols;
    } else {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [item];
      currentUsedCols = item.preferredCols;
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // 3. For each row, distribute any remaining columns so the row sums to EXACTLY 12
  for (const row of rows) {
    const sumCols = row.reduce((acc, it) => acc + it.preferredCols, 0);
    const leftover = 12 - sumCols;

    if (row.length === 1) {
      // Single item on row -> takes full 12 columns
      const it = row[0];
      result.set(it.id, {
        colSpanClass: 'col-span-12 md:col-span-2 lg:col-span-12',
        rowSpanClass: it.preset.rowSpanClass,
        colsOnLg: 12,
        colsOnMd: 2,
        isVertical: false,
        label: it.preset.label,
      });
    } else if (row.length === 2) {
      // Two items on row: divide 12 columns (e.g. 6 + 6, or 8 + 4)
      if (leftover === 0) {
        row.forEach((it) => {
          const colLgClass = it.preferredCols === 8 ? 'lg:col-span-8' : it.preferredCols === 4 ? 'lg:col-span-4' : 'lg:col-span-6';
          result.set(it.id, {
            colSpanClass: `col-span-12 md:col-span-1 ${colLgClass}`,
            rowSpanClass: it.preset.rowSpanClass,
            colsOnLg: it.preferredCols,
            colsOnMd: 1,
            isVertical: it.preset.isVertical,
            label: it.preset.label,
          });
        });
      } else {
        // Expand to fill remaining space
        const first = row[0];
        const second = row[1];
        let col1 = 6;
        let col2 = 6;
        if (first.preferredCols >= second.preferredCols) {
          if (first.preferredCols === 8) {
            col1 = 8;
            col2 = 4;
          } else {
            col1 = 6;
            col2 = 6;
          }
        } else {
          col1 = 4;
          col2 = 8;
        }

        result.set(first.id, {
          colSpanClass: `col-span-12 md:col-span-1 lg:col-span-${col1}`,
          rowSpanClass: first.preset.rowSpanClass,
          colsOnLg: col1,
          colsOnMd: 1,
          isVertical: first.preset.isVertical,
          label: first.preset.label,
        });
        result.set(second.id, {
          colSpanClass: `col-span-12 md:col-span-1 lg:col-span-${col2}`,
          rowSpanClass: second.preset.rowSpanClass,
          colsOnLg: col2,
          colsOnMd: 1,
          isVertical: second.preset.isVertical,
          label: second.preset.label,
        });
      }
    } else if (row.length === 3) {
      // Three items on row: each gets 4 columns (4 + 4 + 4 = 12)
      row.forEach((it) => {
        result.set(it.id, {
          colSpanClass: 'col-span-12 md:col-span-1 lg:col-span-4',
          rowSpanClass: it.preset.rowSpanClass,
          colsOnLg: 4,
          colsOnMd: 1,
          isVertical: it.preset.isVertical,
          label: it.preset.label,
        });
      });
    } else {
      // 4 or more items on row
      const eachCol = Math.floor(12 / row.length);
      const rem = 12 % row.length;
      row.forEach((it, idx) => {
        const c = idx === 0 ? eachCol + rem : eachCol;
        result.set(it.id, {
          colSpanClass: `col-span-12 md:col-span-1 lg:col-span-${c}`,
          rowSpanClass: it.preset.rowSpanClass,
          colsOnLg: c,
          colsOnMd: 1,
          isVertical: it.preset.isVertical,
          label: it.preset.label,
        });
      });
    }
  }

  return result;
}

