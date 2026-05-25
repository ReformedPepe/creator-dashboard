// Sidebar — collapsible on desktop, slide-out drawer on mobile
// Desktop: icons always positioned at center of 64px column (collapsed width).
// Mobile: always full width (240px), hidden off-screen by default, overlay when open.
import { useState, useEffect } from 'react';
import { LayoutDashboard, Radio, Settings, BarChart2, User, LogOut, PanelLeft, PanelRight, X, Wrench, FileText, Scissors, Download, Sparkles } from 'lucide-react';

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
  { id: 'youtube-downloader', label: 'YouTube Downloader', icon: Download, section: 'tools' },
  { id: 'social-downloader', label: 'Social Downloader', icon: Sparkles, section: 'tools' },
  { id: 'transcript', label: 'Transkrypcja', icon: FileText, section: 'tools' },
  { id: 'silence-remover', label: 'Silence Remover', icon: Scissors, section: 'tools' },
  { id: 'settings', label: 'Ustawienia', icon: Settings },
];

export default function Sidebar({ currentView, onNavigate, onCollapseChange, user, onSignOut, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose?.();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen, onMobileClose]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (onCollapseChange) onCollapseChange(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(next));
    } catch {}
  };

  const handleNavClick = (id) => {
    onNavigate(id);
    // Close sidebar on mobile after navigation
    onMobileClose?.();
  };

  // On mobile: always show full (w-60), translate based on mobileOpen
  // On desktop: translate always 0, width based on collapsed
  const sidebarClasses = [
    'fixed left-0 top-0 h-screen bg-[#0D0D0D] border-r border-[#1A1A1A] flex flex-col z-50 overflow-hidden',
    'w-60 transition-transform duration-300 ease-in-out',
    'md:transition-[width] md:duration-300 md:translate-x-0',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
    collapsed ? 'md:w-16' : 'md:w-56',
  ].join(' ');

  // Text visibility: always visible on mobile, depends on collapsed on desktop
  const textVisibility = collapsed ? 'opacity-100 md:opacity-0' : 'opacity-100';
  const actionVisibility = collapsed ? 'opacity-100 md:opacity-0 md:pointer-events-none' : 'opacity-100';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Logo — always same left position */}
        <div className={`flex items-center h-14 shrink-0 border-b border-[#1A1A1A] ${LOGO_PL} gap-3`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A1A] shrink-0">
            <BarChart2 className="h-[18px] w-[18px] text-white" />
          </div>
          <span className={`text-sm font-bold text-white whitespace-nowrap transition-opacity duration-200 ${textVisibility}`}>
            Statflow
          </span>
          {/* Close button on mobile */}
          <button
            onClick={onMobileClose}
            className="ml-auto mr-3 flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer md:hidden"
            aria-label="Zamknij menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation — icons always at same X position */}
        <nav className="flex-1 flex flex-col py-4 gap-1 w-full">
          {navItems.map(({ id, label, icon: Icon, section }, index) => {
            const isActive = currentView === id;
            // Show section label before first tools item
            const showSectionLabel = section === 'tools' && (index === 0 || navItems[index - 1]?.section !== 'tools');

            return (
              <div key={id}>
                {showSectionLabel && (
                  <div className={`${ICON_PL} pr-3 pt-3 pb-1`}>
                    <span className={`text-[10px] font-semibold tracking-widest uppercase text-[#444] whitespace-nowrap transition-opacity duration-200 ${textVisibility}`}>
                      Narzędzia
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleNavClick(id)}
                  className={`relative flex items-center gap-3 h-10 ${ICON_PL} pr-3 rounded-none transition-colors cursor-pointer w-full ${
                    isActive ? 'text-white bg-[#161616]' : 'text-[#666] hover:text-white hover:bg-[#111]'
                  }`}
                  title={collapsed ? label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
                  )}
                  <Icon className={`h-[20px] w-[20px] shrink-0 ${isActive ? 'text-white' : 'text-[#555]'}`} />
                  <span className={`whitespace-nowrap text-sm font-medium transition-opacity duration-200 ${textVisibility}`}>
                    {label}
                  </span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle — hidden on mobile */}
        <div className="border-t border-[#1A1A1A] py-2 hidden md:block">
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
          <div className={`overflow-hidden flex-1 min-w-0 transition-opacity duration-200 ${textVisibility}`}>
            <p className="text-xs font-medium text-white truncate">
              {user?.email?.split('@')[0] || 'Użytkownik'}
            </p>
            <p className="text-[10px] text-[#555] truncate">{user?.email || ''}</p>
          </div>
          <button
            onClick={onSignOut}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-opacity cursor-pointer hover:bg-[#161616] shrink-0 ${actionVisibility}`}
            title="Wyloguj"
          >
            <LogOut className="h-4 w-4 text-[#555]" />
          </button>
        </div>
      </aside>
    </>
  );
}
