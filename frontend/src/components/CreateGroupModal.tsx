import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesAPI, roomsAPI, usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

interface Candidate {
  id: string;
  name: string;
  photo_url?: string;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}

export function CreateGroupModal({ open, onClose, onCreated }: CreateGroupModalProps) {
  const navigate = useNavigate();
  const isPremium = useAuthStore((s) => Boolean(s.user?.is_premium));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName('');
    setDescription('');
    setSelected(new Set());
    if (!isPremium) return;

    setLoadingCandidates(true);
    Promise.all([usersAPI.getMatches(), messagesAPI.getConversations()])
      .then(([matchesRes, convsRes]) => {
        const byId = new Map<string, Candidate>();
        for (const match of matchesRes.data ?? []) {
          byId.set(match.id, {
            id: match.id,
            name: match.name,
            photo_url: match.photo_url,
          });
        }
        for (const conv of convsRes.data ?? []) {
          if (!byId.has(conv.other_user_id)) {
            byId.set(conv.other_user_id, {
              id: conv.other_user_id,
              name: conv.other_user_name,
              photo_url: conv.photo_url,
            });
          }
        }
        setCandidates(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoadingCandidates(false));
  }, [open, isPremium]);

  if (!open) return null;

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPremium) {
      navigate('/premium');
      return;
    }
    if (!name.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const memberIds = Array.from(selected);
      const res = await roomsAPI.createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        is_location_based: false,
        member_ids: memberIds.length ? memberIds : undefined,
      });
      const roomId = res.data.id as string;
      const rawErrors: string[] = Array.isArray(res.data.member_errors)
        ? res.data.member_errors
        : [];

      const addErrors: string[] = rawErrors.map((entry: string) => {
        const [uid, code] = entry.split(':');
        const candidate = candidates.find((c) => c.id === uid);
        if (code === 'member_premium_required') {
          return `${candidate?.name ?? 'Member'} needs Premium to join groups.`;
        }
        return `${candidate?.name ?? 'Member'} could not be added${code ? `: ${code}` : '.'}`;
      });

      onClose();
      onCreated?.(roomId);
      if (addErrors.length > 0) {
        navigate(`/rooms/${roomId}`, { state: { groupNotice: addErrors.join(' ') } });
      } else {
        navigate(`/rooms/${roomId}`);
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (code === 'premium_required') {
        navigate('/premium');
        return;
      }
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not create group.',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={() => !creating && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6"
        style={{
          background: '#1E1508',
          border: '1px solid #3D2B0E',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: '#F0E0C0' }}>
          Create group
        </h2>
        <p className="text-xs mb-5 leading-relaxed" style={{ color: '#A89070' }}>
          Premium members can create private groups. Only Premium members can be added.
        </p>

        {!isPremium ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#F0E0C0' }}>
              Upgrade to Premium to create groups and invite other Premium members.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#3D2B0E', color: '#A89070' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => navigate('/premium')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                  color: '#FFF5E6',
                }}
              >
                Go Premium
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A89070' }}>
                Group name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend crew"
                required
                maxLength={60}
                className="w-full text-sm px-4 py-3 rounded-xl focus:outline-none"
                style={{
                  background: '#0D0A06',
                  border: '1px solid #3D2B0E',
                  color: '#F0E0C0',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#A89070' }}>
                Description <span style={{ color: '#6B5035', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full text-sm px-4 py-3 rounded-xl resize-none focus:outline-none"
                style={{
                  background: '#0D0A06',
                  border: '1px solid #3D2B0E',
                  color: '#F0E0C0',
                }}
              />
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#A89070' }}>
                Add Premium members
              </p>
              {loadingCandidates ? (
                <p className="text-xs py-4 text-center" style={{ color: '#6B5035' }}>
                  Loading matches…
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-xs py-3 px-3 rounded-xl" style={{ color: '#6B5035', background: '#0D0A06' }}>
                  Match with someone first, then invite them here.
                </p>
              ) : (
                <div
                  className="max-h-40 overflow-y-auto rounded-xl border"
                  style={{ borderColor: '#3D2B0E' }}
                >
                  {candidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#3D2B0E]/30 border-b last:border-b-0"
                      style={{ borderColor: '#3D2B0E' }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleMember(c.id)}
                        className="accent-[#C4832A]"
                      />
                      <span className="text-sm truncate" style={{ color: '#F0E0C0' }}>
                        {c.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-xl" style={{ color: '#F87171', background: 'rgba(239,68,68,0.1)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-1">
              <button
                type="button"
                disabled={creating}
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border disabled:opacity-50"
                style={{ borderColor: '#3D2B0E', color: '#A89070' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || creating}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                  color: '#FFF5E6',
                }}
              >
                {creating ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
