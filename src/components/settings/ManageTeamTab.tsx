import React from 'react';
import { Users, Plus, UserMinus, Phone, Lock, AlertTriangle } from 'lucide-react';

interface ManageTeamTabProps {
  teamMembers: any[];
  loading: boolean;
  showAddMember: boolean;
  newMemberPhone: string;
  newMemberPassword: string;
  newMemberName: string;
  teamError: string;
  ownerName: string;
  ownerEmail: string;
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onToggleAddForm: () => void;
}

const SkeletonList = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 animate-pulse flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-2 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export const ManageTeamTab = React.memo(function ManageTeamTab({
  teamMembers, loading, showAddMember, newMemberPhone, newMemberPassword, newMemberName,
  teamError, ownerName, ownerEmail, onAddMember, onRemoveMember, onFieldChange, onToggleAddForm,
}: ManageTeamTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center space-x-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{ownerName?.charAt(0) || 'O'}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">{ownerName}</h3>
          <p className="text-xs text-gray-500">{ownerEmail}</p>
        </div>
        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Owner</span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Team Members ({teamMembers.length}/{3})</h3>
          {teamMembers.length < 3 ? (
            <button onClick={onToggleAddForm} className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center hover:bg-indigo-100 transition-colors">
              <Plus size={14} className="mr-1" /> Add Member
            </button>
          ) : (
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">Limit reached (3/3)</span>
          )}
        </div>

        {teamError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3 flex items-start">
            <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />{teamError}
          </div>
        )}

        {loading ? <SkeletonList /> : teamMembers.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm">No team members yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add members so they can manage your business account.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teamMembers.map(member => (
              <div key={member.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">
                  {member.name?.charAt(0) || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-gray-900 truncate">{member.name}</h4>
                  <div className="flex items-center text-xs text-gray-500 mt-0.5">
                    <Phone size={10} className="mr-1" />{member.phone}
                  </div>
                </div>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">{member.role}</span>
                <button onClick={() => onRemoveMember(member.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <UserMinus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={onToggleAddForm}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Team Member</h3>
            <form onSubmit={(e) => { e.preventDefault(); onAddMember(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text" required value={newMemberName}
                  onChange={e => onFieldChange('newMemberName', e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  placeholder="e.g. Rahul"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel" required value={newMemberPhone}
                    onChange={e => onFieldChange('newMemberPhone', e.target.value)}
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password" required minLength={4} value={newMemberPassword}
                    onChange={e => onFieldChange('newMemberPassword', e.target.value)}
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    placeholder="Minimum 4 characters"
                  />
                </div>
              </div>
              {teamError && <p className="text-xs text-red-500">{teamError}</p>}
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={onToggleAddForm} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
