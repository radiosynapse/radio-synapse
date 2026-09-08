export type AdminTab = 
  | 'dashboard' 
  | 'stations' 
  | 'services' 
  | 'users' 
  | 'challenges' 
  | 'promotions' 
  | 'programming' 
  | 'events' 
  | 'messages' 
  | 'azuracast' 
  | 'database';

export interface SidebarItemConfig {
  id: AdminTab;
  visible: boolean;
  order: number;
}

export type WidgetSize = 'full' | 'half' | 'third';
export type WidgetDensity = 'compact' | 'normal' | 'expanded';

export type DashboardWidgetId =
  | 'kpi_overview'
  | 'quick_actions'
  | 'stations_monitor'
  | 'station_focus'
  | 'next_up_schedule'
  | 'broadcast_quick_status'
  | 'services_status'
  | 'recent_messages'
  | 'active_challenges'
  | 'upcoming_events'
  | 'promotions_partners'
  | 'community_users';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  title: string;
  description: string;
  size: WidgetSize;
  density: WidgetDensity;
  visible: boolean;
  order: number;
}
