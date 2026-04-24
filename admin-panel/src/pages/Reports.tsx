import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { ChevronLeft, ChevronRight, Trash2, Flag, AlertTriangle } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';


interface Report {
  id: string; reason: string; createdAt: string;
  reportedByUser: { id: string; name: string; phone: string };
  reportedUser?: { id: string; name: string; phone: string } | null;
  reportedStore?: { id: string; storeName: string } | null;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/reports', { 
        headers: getAdminHeaders(), 
        params: { page, limit: 15 } 
      });
      setReports(res.data.reports);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { 
    fetchReports(); 
  }, [fetchReports]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/reports/${id}`, { headers: getAdminHeaders() });
      setDeleteConfirm(null);
      showToast('Report dismissed', { type: 'success' });
      fetchReports();
    } catch {
      showToast('Failed to dismiss report', { type: 'error' });
    }
  };

  const reportedEntity = (r: Report) => {
    if (r.reportedUser) return { type: 'User', name: r.reportedUser.name };
    if (r.reportedStore) return { type: 'Store', name: r.reportedStore.storeName };
    return { type: 'Unknown', name: '—' };
  };

  return (
    <AdminLayout title="Content Moderation">
      <p className="text-xs text-gray-500 mb-4">{total} reports found</p>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Flag size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No reports</p>
          <p className="text-sm text-gray-400 mt-1">Everything looks clean!</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reported</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reported By</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(r => {
                  const entity = reportedEntity(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
                            <AlertTriangle size={14} className="text-red-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{entity.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${entity.type === 'User' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{entity.type}</span></td>
                      <td className="px-5 py-3 text-sm text-gray-600">{r.reportedByUser.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 max-w-[250px] truncate">{r.reason}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setDeleteConfirm(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Dismiss"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {reports.map(r => {
              const entity = reportedEntity(r);
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
                        <AlertTriangle size={14} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entity.name}</p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${entity.type === 'User' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{entity.type}</span>
                      </div>
                    </div>
                    <button onClick={() => setDeleteConfirm(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 line-clamp-2">{r.reason}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>By {r.reportedByUser.name}</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Dismiss Report?</h3>
            <p className="text-sm text-gray-500 mb-4">This will permanently remove the report from the system.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
