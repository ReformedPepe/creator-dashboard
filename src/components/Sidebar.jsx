// Sidebar — minimalistyczny, ciemny, ikony w kontenerach (Attio/Linear style)
import { useState } from 'react';
import { LayoutDashboard, Radio, Settings, PanelLeft, PanelRight, BarChart2, User } from 'lucide-react';

const SIDEBAR_KEY = 'creator-dashboard-sidebar-collapsed';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Kanały', icon: Radio },
  { id: 'settings', label: 'Ustawienia', icon: Settings },
];

export default function Sidebar({ currentView, onNavigate, onCollapseChange }) {
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
      className={`fixed left-0 top-0 h-screen bg-[#111111] border-r border-[#1E1E1E] flex flex-col items-center transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 shrink-0 border-b border-[#2A2A2A] w-full ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
        <button
          onClick={toggleCollapse}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shrink-0 cursor-pointer hover:bg-accent-light transition-colors"
          title={collapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
        >
          <BarChart2 className="h-[18px] w-[18px] text-white" />
        </button>
        {!collapsed && (
          <span className="text-sm font-bold text-white whitespace-nowrap">
            Statflow
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-2 ${collapsed ? 'px-0 flex flex-col items-center' : 'px-3 w-full'}`}>
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentView === id;

          if (collapsed) {
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-accent border border-transparent'
                    : 'bg-[#1C1C1C] border border-[#2A2A2A] hover:bg-[#252525]'
                }`}
                title={label}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-[#888]'}`} />
              </button>
            );
          }

          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-accent text-white'
                  : 'text-[#888] hover:text-white hover:bg-[#1C1C1C]'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toggle button (PanelLeft/PanelRight) */}
      <div className={`py-2 border-t border-[#2A2A2A] w-full ${collapsed ? 'flex justify-center' : 'px-3'}`}>
        <button
          onClick={toggleCollapse}
          className={`flex items-center justify-center rounded-xl transition-colors cursor-pointer bg-[#1C1C1C] border border-[#2A2A2A] hover:bg-[#252525] ${
            collapsed ? 'h-9 w-9' : 'w-full gap-2 px-3 py-2'
          }`}
          title={collapsed ? 'Rozwiń' : 'Zwiń'}
        >
          {collapsed ? (
            <PanelRight className="h-[18px] w-[18px] text-[#888]" />
          ) : (
            <>
              <PanelLeft className="h-[18px] w-[18px] text-[#888]" />
              <span className="text-xs text-[#888]">Zwiń panel</span>
            </>
          )}
        </button>
      </div>

      {/* User avatar */}
      <div className={`py-3 border-t border-[#2A2A2A] w-full ${collapsed ? 'flex justify-center' : 'px-3 flex items-center gap-3'}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1C1C] border border-[#2A2A2A] shrink-0">
          <User className="h-4 w-4 text-[#888]" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-white truncate">Użytkownik</p>
            <p className="text-[10px] text-[#888] truncate">user@example.com</p>
          </div>
        )}
      </div>
    </aside>
  );
}
