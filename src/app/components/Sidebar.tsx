"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  Mail, 
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="w-full flex items-center justify-center">
          <img
            src="https://22527425.fs1.hubspotusercontent-na2.net/hubfs/22527425/PurpleSynapz/Screenshot%202025-10-22%20at%202.12.36%20PM.png"
            alt="Logo"
            className="max-h-12 w-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              style={isActive ? { backgroundColor: '#00153D' } : {}}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center justify-center">
          <img
            src="https://cdn-nexlink.s3.us-east-2.amazonaws.com/Nexuses-full-logo-dark_8d412ea3-bf11-4fc6-af9c-bee7e51ef494.png"
            alt="Brand Logo"
            className="max-h-6 w-auto opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
}
