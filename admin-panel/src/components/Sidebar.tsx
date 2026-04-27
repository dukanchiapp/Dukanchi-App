import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Store, Flag, LogOut, X, Shield, ShieldCheck, MessageSquare, Settings, FileText, AlertTriangle, UserCheck, Layout } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { default: api } = await import('../lib/api');
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error(err);
    }
    // Refresh page to clear auth state
    window.location.href = '/login';
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  return (
    <div className="w-64 h-full bg-white border-r border-gray-100 flex flex-col">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Admin</h1>
            <p className="text-[11px] text-gray-400 -mt-0.5">Control Panel</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Main</p>
        <NavLink to="/dashboard" className={navClass} onClick={onClose}>
          <LayoutDashboard size={18} /> Overview
        </NavLink>

        <p className="px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Management</p>
        <NavLink to="/users" className={navClass} onClick={onClose}>
          <Users size={18} /> Users
        </NavLink>
        <NavLink to="/stores" className={navClass} onClick={onClose}>
          <Store size={18} /> Stores
        </NavLink>
        <NavLink to="/store-members" className={navClass} onClick={onClose}>
          <UserCheck size={18} /> Store Members
        </NavLink>
        <NavLink to="/posts" className={navClass} onClick={onClose}>
          <FileText size={18} /> Posts
        </NavLink>
        <NavLink to="/reports" className={navClass} onClick={onClose}>
          <Flag size={18} /> Reports
        </NavLink>
        <NavLink to="/complaints" className={navClass} onClick={onClose}>
          <AlertTriangle size={18} /> Complaints
        </NavLink>
        <NavLink to="/kyc" className={navClass} onClick={onClose}>
          <ShieldCheck size={18} /> KYC Review
        </NavLink>
        <NavLink to="/chats" className={navClass} onClick={onClose}>
          <MessageSquare size={18} /> Chat Monitoring
        </NavLink>

        <p className="px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Configuration</p>
        <NavLink to="/landing-page" className={navClass} onClick={onClose}>
          <Layout size={18} /> Landing Page
        </NavLink>
        <NavLink to="/settings" className={navClass} onClick={onClose}>
          <Settings size={18} /> App Settings
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}
