// Sidebar — collapsible, icons NEVER move position
// Key insight: icons are always positioned at the center of a 64px column (the collapsed width).
// When expanded, text appears to the right of that fixed 64px icon zone.
// This means: padding-left is always calculated so icon center = 32px from left edge.
import { useState } from 'react';
import { LayoutDashboard, Radio, Settings, BarChart2, User, LogOut, PanelLeft, PanelRight } from 'lucide-react';

const SIDEBAR_KEY = 'creator-dashboard-sidebar-collapsed';
// Icon zone: 64px wide. Icon is 20px. Center = (64 - 20) / 2 = 22px from left.
const ICON_PL = 'pl-[22px]';
// Logo icon is 36px (w-9). Center = (64 - 36) / 2 = 14px from left.
const LOGO_PL = 'pl-[14px]';
// User avatar is 32px (w-8). Center = (64 - 32) / 2 = 16px from left.
const USER_PL = 'pl-[16px]';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Kanały', icon: Radio },
  { id: 'settings', label: 'Ustawienia', icon: Settings },
];

export default function Sidebar({ currentView, onNavigate, onCollapseChange, user, onSignOut }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (onCollapseChange) onCollapseChange(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(next));
    } catch {}
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0D0D0D] border-r border-[#1A1A1A] flex flex-col transition-[width] duration-300 z-40 overflow-hidden ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo — always same left position */}
      <div className={`flex items-center h-14 shrink-0 border-b border-[#1A1A1A] ${LOGO_PL} gap-3`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A1A] shrink-0">
          <BarChart2 className="h-[18px] w-[18px] text-white" />
        </div>
        <span className={`text-sm font-bold text-white whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
          Statflow
        </span>
      </div>

      {/* Navigation — icons always at same X position */}
      <nav className="flex-1 flex flex-col py-4 gap-1 w-full">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentView === id;

          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`relative flex items-center gap-3 h-10 ${ICON_PL} pr-3 rounded-none transition-colors cursor-pointer w-full ${
                isActive ? 'text-white bg-[#161616]' : 'text-[#666] hover:text-white hover:bg-[#111]'
              }`}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
              )}
              <Icon className={`h-[20px] w-[20px] shrink-0 ${isActive ? 'text-white' : 'text-[#555]'}`} />
              <span className={`whitespace-nowrap text-sm font-medium transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle — icon at same X */}
      <div className="border-t border-[#1A1A1A] py-2">
        <button
          onClick={toggleCollapse}
          className={`flex items-center gap-3 h-9 ${ICON_PL} pr-3 w-full transition-colors cursor-pointer hover:bg-[#161616]`}
          title={collapsed ? 'Rozwiń' : 'Zwiń'}
        >
          {collapsed ? (
            <PanelRight className="h-[18px] w-[18px] text-[#555] shrink-0" />
          ) : (
            <PanelLeft className="h-[18px] w-[18px] text-[#555] shrink-0" />
          )}
          <span className={`text-xs text-[#555] whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
            Zwiń panel
          </span>
        </button>
      </div>

      {/* User — avatar at same X */}
      <div className={`border-t border-[#1A1A1A] py-3 flex items-center gap-3 ${USER_PL} pr-3`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] shrink-0">
          <User className="h-4 w-4 text-[#666]" />
        </div>
        <div className={`overflow-hidden flex-1 min-w-0 transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-xs font-medium text-white truncate">
            {user?.email?.split('@')[0] || 'Użytkownik'}
          </p>
          <p className="text-[10px] text-[#555] truncate">{user?.email || ''}</p>
        </div>
        <button
          onClick={onSignOut}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-opacity cursor-pointer hover:bg-[#161616] shrink-0 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          title="Wyloguj"
        >
          <LogOut className="h-4 w-4 text-[#555]" />
        </button>
      </div>
    </aside>
  );
}
