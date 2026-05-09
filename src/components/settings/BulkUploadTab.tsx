import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';

interface BulkUploadTabProps {
  store: any;
  token: string | null;
}

export const BulkUploadTab = React.memo(function BulkUploadTab({ store, token }: BulkUploadTabProps) {
  const { showToast } = useToast();
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; mappingUsed: Record<string, string> } | null>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store?.id) return;
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch(`/api/stores/${store.id}/bulk-import`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ imported: data.imported, skipped: data.skipped, mappingUsed: data.mappingUsed });
        showToast(`✓ ${data.imported} products imported${data.skipped ? `, ${data.skipped} skipped` : ''}`, { type: 'success' });
      } else {
        showToast(data.error || 'Import failed', { type: 'error' });
      }
    } catch {
      showToast('Upload failed. Check your connection.', { type: 'error' });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Import from Excel / CSV</h3>
            <p className="text-xs text-gray-500">AI auto-detects your columns — any format works</p>
          </div>
        </div>

        <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors ${importLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {importLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              AI is reading your file…
            </>
          ) : (
            <><Upload size={15} /> Import from Excel / CSV</>
          )}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importLoading} onChange={handleBulkUpload} />
        </label>

        <p className="text-xs text-gray-400 text-center mt-2">
          Supports any .xlsx, .xls or .csv format · Max 1,000 rows · 5 MB
        </p>

        {importResult && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
            <p className="font-semibold text-green-800">
              ✓ {importResult.imported} products imported{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}
            </p>
            <p className="text-green-700 text-xs mt-1">
              Columns detected: {Object.entries(importResult.mappingUsed).map(([k, v]) => `${v} → ${k}`).join(', ')}
            </p>
            <Link to="/profile" className="text-indigo-600 text-xs font-medium mt-1 inline-block hover:underline">
              View imported products →
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-2">Add Products Manually</h3>
        <p className="text-sm text-gray-500 mb-4">Type or paste your product details below. This text will be searchable by customers.</p>
        <textarea
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
          rows={8}
          maxLength={6000}
          placeholder="Example:&#10;Samsung Galaxy S24 - ₹79,999&#10;iPhone 15 Pro Max - ₹1,59,900&#10;OnePlus 12 - ₹64,999&#10;&#10;List your products, prices, brands, categories..."
          defaultValue={store?.manualProductText || ''}
          id="manualProductText"
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-xs text-gray-400">Max 6,000 characters</span>
          <button
            onClick={async () => {
              const text = (document.getElementById('manualProductText') as HTMLTextAreaElement)?.value || '';
              if (!store?.id) { showToast('Store not found', { type: 'error' }); return; }
              try {
                const res = await apiFetch(`/api/stores/${store.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ manualProductText: text }),
                });
                if (res.ok) {
                  showToast('✅ Products saved successfully!', { type: 'success' });
                } else {
                  showToast('Failed to save. Please try again.', { type: 'error' });
                }
              } catch (e) { console.error(e); showToast('Error saving products.', { type: 'error' }); }
            }}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors flex items-center"
          >
            <Plus size={14} className="mr-1.5" /> Save Products
          </button>
        </div>
      </div>
    </div>
  );
});
