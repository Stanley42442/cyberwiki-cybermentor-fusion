import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, User, Menu, X, Brain } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, notifications, unreadCount, markNotificationRead } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) =>
    path === '/tutor'
      ? location.pathname.startsWith('/tutor')
      : location.pathname === path;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const userNotifications = notifications.filter(n => n.userId === user?.mat_number || n.userId === user?.id);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/browse", label: "Browse" },
    { to: "/search", label: "Search", icon: <Search className="h-3.5 w-3.5" /> },
    { to: "/tutor", label: "AI Tutor", icon: <Brain className="h-3.5 w-3.5" />, highlight: true },
    { to: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="h-6 w-6 rounded-full border-2 border-primary flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>
          <span className="font-semibold text-foreground">
            Cyber<span className="text-primary font-bold">Wiki</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm flex items-center gap-1.5 transition-colors font-medium ${
                isActive(link.to)
                  ? "text-primary"
                  : link.highlight
                  ? "text-primary/70 hover:text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.icon}{link.label}
              {link.highlight && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded bg-primary/15 text-primary border border-primary/25">
                  AI
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-3 border-b border-border font-semibold text-sm">Notifications</div>
                  <div className="max-h-64 overflow-y-auto">
                    {userNotifications.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">No notifications</div>
                    ) : (
                      userNotifications.slice(0, 10).map(n => (
                        <button
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`w-full text-left p-3 border-b border-border text-sm hover:bg-secondary/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                        >
                          <p className={`${!n.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {user ? (
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold hover:bg-primary/30 transition-colors"
              >
                {user.display_name.charAt(0).toUpperCase()}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-3 border-b border-border">
                    <p className="font-semibold text-sm text-foreground">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">{user.mat_number}</p>
                  </div>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors" onClick={() => setShowUserMenu(false)}>
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link to="/tutor" className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-secondary/50 transition-colors" onClick={() => setShowUserMenu(false)}>
                    <Brain className="h-4 w-4" /> AI Tutor
                  </Link>
                  {user.tier === 'admin' && (
                    <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors" onClick={() => setShowUserMenu(false)}>
                      ⚙️ Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); navigate('/'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary/50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex px-4 py-1.5 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Login
            </Link>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border bg-background"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${
                    isActive(link.to)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  {link.icon} {link.label}
                  {link.highlight && <span className="ml-auto px-1.5 py-0.5 text-[10px] font-mono rounded bg-primary/15 text-primary border border-primary/25">AI</span>}
                </Link>
              ))}

              <div className="border-t border-border my-2" />

              {user ? (
                <>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground min-h-[44px]">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  {user.tier === 'admin' && (
                    <Link to="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground min-h-[44px]">
                      ⚙️ Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); navigate('/'); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-secondary/50 min-h-[44px]"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px]">
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Header;
