import { Link, useLocation } from "wouter";
import { useGetMe, useGetWallet, useGetSession } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  PlusCircle, 
  Send, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  Settings, 
  LogOut,
  Landmark,
  Wallet,
  Menu
} from "lucide-react";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/add-money", label: "Add Money", icon: PlusCircle },
  { href: "/send", label: "Send Money", icon: Send },
  { href: "/payees", label: "Saved Payees", icon: Users },
  { href: "/kyc", label: "KYC & Limits", icon: ShieldCheck },
  { href: "/admin", label: "Ledger Admin", icon: Landmark },
];

function SidebarContent() {
  const [location] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
        <div className="h-8 w-8 bg-sidebar-primary rounded flex items-center justify-center text-sidebar-primary-foreground font-bold">
          <Wallet size={20} />
        </div>
        <span className="font-bold text-xl tracking-tight">CoinWallet</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-sidebar-accent/50 p-4 rounded-xl border border-sidebar-accent">
          <p className="text-xs text-sidebar-foreground/70 uppercase tracking-wider font-semibold mb-1">Available Balance</p>
          {walletLoading ? (
            <Skeleton className="h-8 w-24 bg-sidebar-accent" />
          ) : (
            <div className="text-2xl font-bold">{wallet ? formatInr(wallet.balanceInr) : '₹0.00'}</div>
          )}
        </div>

        {me && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-sidebar-foreground/70">KYC Status</span>
              <span className={`font-semibold ${me.kycStatus === 'VERIFIED' ? 'text-green-400' : me.kycStatus === 'PENDING' ? 'text-amber-400' : 'text-red-400'}`}>
                {me.kycStatus}
              </span>
            </div>
            {me.kycStatus !== 'VERIFIED' && (
               <Link href="/kyc">
                <Button variant="outline" size="sm" className="w-full text-xs h-7 bg-sidebar text-sidebar-foreground border-sidebar-accent hover:bg-sidebar-accent hover:text-sidebar-foreground">
                  Complete KYC
                </Button>
               </Link>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}>
                <item.icon size={18} className={isActive ? "text-sidebar-primary" : ""} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <Link href="/settings">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            {meLoading ? (
              <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent" />
            ) : (
              <Avatar className="h-8 w-8 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-accent text-xs">
                  {me?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{me?.name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{me?.email}</p>
            </div>
            <Settings size={16} />
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const [location, setLocation] = useLocation();

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!session && location !== '/login') {
    setLocation('/login');
    return null;
  }

  if (location === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground selection:bg-primary/20">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 fixed inset-y-0 z-10">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
          <div className="flex items-center gap-2">
             <div className="h-8 w-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              <Wallet size={18} />
            </div>
            <span className="font-bold text-lg">CoinWallet</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
