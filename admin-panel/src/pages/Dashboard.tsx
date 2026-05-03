import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Users, Store, FileText, Star, Flag, TrendingUp, Clock, UserPlus } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';

interface RecentUser {
  id: string; name: string; role: string; phone: string; createdAt: string;
  kycStoreName?: string | null;
  stores?: { storeName: string }[];
}

interface Stats {
  users: number;
  stores: number;
  posts: number;
  reviews: number;
  reports: number;
  recentUsers: RecentUser[];
  recentReports: Array<{ id: string; reason: string; createdAt: string; reportedByUser: { name: string }; reportedUser?: { name: string }; reportedStore?: { storeName: string } }>;
}

// Helper: show business name for non-customers
const displayName = (user: RecentUser) => {
  if (user.role !== 'customer') {
    const bName = user.stores && user.stores.length > 0 ? user.stores[0].storeName : (user.kycStoreName || user.name);
    return bName;
  }
  return user.name;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/stats', { headers: getAdminHeaders() });
      setStats(res.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const [now] = useState(Date.now());

  const statCards = [
    { label: 'Total Users', value: stats?.users ?? 0, icon: Users, color: 'bg-blue-50 text-blue-600', accent: 'bg-blue-100' },
    { label: 'Active Stores', value: stats?.stores ?? 0, icon: Store, color: 'bg-emerald-50 text-emerald-600', accent: 'bg-emerald-100' },
    { label: 'Total Posts', value: stats?.posts ?? 0, icon: FileText, color: 'bg-violet-50 text-violet-600', accent: 'bg-violet-100' },
    { label: 'Reviews', value: stats?.reviews ?? 0, icon: Star, color: 'bg-amber-50 text-amber-600', accent: 'bg-amber-100' },
    { label: 'Reports', value: stats?.reports ?? 0, icon: Flag, color: 'bg-rose-50 text-rose-600', accent: 'bg-rose-100' },
    { label: 'System Health', value: '100%', icon: TrendingUp, color: 'bg-teal-50 text-teal-600', accent: 'bg-teal-100' },
  ];

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      retailer: 'bg-blue-100 text-blue-700',
      customer: 'bg-gray-100 text-gray-700',
      supplier: 'bg-purple-100 text-purple-700',
      brand: 'bg-amber-100 text-amber-700',
      manufacturer: 'bg-emerald-100 text-emerald-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const timeAgo = (date: string) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard Overview">
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error} — <button onClick={fetchStats} className="underline font-medium">Retry</button>
        </div>
      )}
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 ${card.accent} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon size={20} className={card.color.split(' ')[1]} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Activity sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <UserPlus size={18} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Recent Users</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats?.recentUsers?.map(user => (
              <div key={user.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-600">{user.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName(user)}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">{user.phone}</p>
                      {user.role !== 'customer' && (
                        <span className="text-xs text-indigo-500 flex items-center gap-0.5"><UserPlus size={10} />{user.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${roleBadge(user.role)}`}>
                    {user.role}
                  </span>
                  <span className="text-[11px] text-gray-400 hidden sm:block">{timeAgo(user.createdAt)}</span>
                </div>
              </div>
            ))}
            {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No users yet</div>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Clock size={18} className="text-rose-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Recent Reports</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats?.recentReports?.map(report => (
              <div key={report.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {report.reportedUser?.name || report.reportedStore?.storeName || 'Unknown'}
                  </p>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(report.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  Reported by {report.reportedByUser.name}: {report.reason}
                </p>
              </div>
            ))}
            {(!stats?.recentReports || stats.recentReports.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                <Flag size={24} className="mx-auto text-gray-300 mb-2" />
                No reports — all clear!
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
