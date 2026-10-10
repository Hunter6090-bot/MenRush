import React, { useState, useEffect } from 'react';
import { adminVenueAPI, VenueClaimDTO } from '../api/client';
import { Layout } from '../components/Layout';

export const AdminVenueClaims: React.FC = () => {
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem('menrush_admin_token') || '',
  );
  const [tokenInput, setTokenInput] = useState('');
  const [claims, setClaims] = useState<VenueClaimDTO[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'frozen' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Action states
  const [selectedClaim, setSelectedClaim] = useState<VenueClaimDTO | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'freeze' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [banUser, setBanUser] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchClaims = async (token = adminToken, status = filter) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res =
        status === 'all'
          ? await adminVenueAPI.listAllClaims(token)
          : await adminVenueAPI.listAllClaims(token, status);
      setClaims(res.data.claims || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load claims. Check admin token.');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      void fetchClaims(adminToken, filter);
    }
  }, [adminToken, filter]);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    localStorage.setItem('menrush_admin_token', trimmed);
    setAdminToken(trimmed);
  };

  const handleClearToken = () => {
    localStorage.removeItem('menrush_admin_token');
    setAdminToken('');
    setClaims([]);
  };

  const executeAction = async () => {
    if (!selectedClaim || !actionType) return;
    setProcessing(true);
    setError('');
    setActionSuccess('');

    try {
      if (actionType === 'approve') {
        await adminVenueAPI.approveClaim(selectedClaim.id, adminToken, actionNote.trim() || undefined);
        setActionSuccess(`Approved claim for ${selectedClaim.spot_name || 'venue'}. Calendar rights granted.`);
      } else if (actionType === 'reject') {
        await adminVenueAPI.rejectClaim(selectedClaim.id, adminToken, actionNote.trim() || undefined);
        setActionSuccess(`Rejected claim for ${selectedClaim.spot_name || 'venue'}.`);
      } else if (actionType === 'freeze') {
        await adminVenueAPI.freezeClaim(selectedClaim.id, adminToken, {
          frozen_reason: actionNote.trim() || 'Ops administrative freeze',
          ban_user: banUser,
        });
        setActionSuccess(`Frozen claim for ${selectedClaim.spot_name || 'venue'}.${banUser ? ' User account banned.' : ''}`);
      }

      setSelectedClaim(null);
      setActionType(null);
      setActionNote('');
      setBanUser(false);
      await fetchClaims();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--cream)]">Venue Claims · Ops Review</h1>
            <p className="text-xs text-[var(--cream-muted)]">
              Gate A: Ops human approval before calendar rights are activated. Face copy lock: &ldquo;Venue claimed&rdquo; / &ldquo;Calendar managed by venue&rdquo;.
            </p>
          </div>

          {adminToken ? (
            <button
              type="button"
              onClick={handleClearToken}
              className="rounded-full border border-[var(--border-default)] px-4 py-1.5 text-xs text-[var(--cream-muted)] hover:text-red-400"
            >
              Sign out of Ops
            </button>
          ) : null}
        </div>

        {!adminToken ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[var(--copper)]/40 bg-[var(--bg-card)] p-6 shadow-xl">
            <h2 className="mb-2 text-base font-bold text-[var(--cream)]">Operations Access Required</h2>
            <p className="mb-4 text-xs text-[var(--cream-muted)]">
              Enter your <code className="text-[#E0A14A]">ADMIN_TOKEN</code> to access the venue claims verification queue.
            </p>
            <form onSubmit={handleSaveToken} className="space-y-3">
              <input
                type="password"
                placeholder="Enter ADMIN_TOKEN"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
              />
              <button
                type="submit"
                className="mr-cta-gradient w-full rounded-full py-2.5 text-xs font-bold"
              >
                Enter Ops Panel
              </button>
            </form>
          </div>
        ) : (
          <div>
            {actionSuccess ? (
              <div role="status" className="mb-4 rounded-xl border border-green-500/40 bg-green-950/40 p-3 text-xs text-green-300">
                {actionSuccess}
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
                {error}
              </div>
            ) : null}

            <div className="mb-6 flex flex-wrap gap-2">
              {(['pending', 'approved', 'rejected', 'frozen', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase transition-colors ${
                    filter === tab
                      ? 'bg-[#C4832A] text-[#1A0E03]'
                      : 'border border-[var(--border-default)] text-[var(--cream-muted)] hover:border-[var(--copper)]/40'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="py-12 text-center text-xs text-[var(--cream-muted)]">Loading claims queue…</p>
            ) : claims.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-12 text-center">
                <p className="text-base font-bold text-[var(--cream)]">No claims in this category</p>
                <p className="mt-1 text-xs text-[var(--cream-muted)]">
                  Pending claims from venue representatives will appear here for review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim) => (
                  <article
                    key={claim.id}
                    className="mr-card flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            claim.status === 'approved'
                              ? 'bg-green-900/50 text-green-300'
                              : claim.status === 'pending'
                                ? 'bg-amber-900/50 text-amber-300'
                                : claim.status === 'frozen'
                                  ? 'bg-red-900/50 text-red-300'
                                  : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {claim.status}
                        </span>
                        <span className="text-xs text-[var(--cream-muted)]">
                          Submitted {new Date(claim.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[var(--cream)]">
                        {claim.spot_name || 'Unknown Venue'} {claim.spot_city ? `· ${claim.spot_city}` : ''}
                      </h3>

                      <div className="text-xs text-[var(--cream-muted)] space-y-0.5">
                        <p>
                          <strong className="text-[var(--cream)]">Claimant:</strong> {claim.contact_name} ({claim.venue_role})
                        </p>
                        <p>
                          <strong className="text-[var(--cream)]">Email:</strong> {claim.contact_email}
                          {claim.contact_phone ? ` · Tel: ${claim.contact_phone}` : ''}
                        </p>
                        {claim.website_or_social_proof ? (
                          <p>
                            <strong className="text-[var(--cream)]">Proof:</strong>{' '}
                            <a
                              href={claim.website_or_social_proof}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#C4832A] underline"
                            >
                              {claim.website_or_social_proof}
                            </a>
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 text-[11px] text-[var(--cream-soft)]">
                        <p className="font-semibold text-[#E0A14A]">Attestation (Agreed {claim.attestation_agreed ? '✓' : '✗'}):</p>
                        <p className="italic text-[var(--cream-muted)] mt-0.5">&ldquo;{claim.attestation_text}&rdquo;</p>
                      </div>

                      {claim.review_notes ? (
                        <p className="text-xs text-amber-400">Notes: {claim.review_notes}</p>
                      ) : null}
                      {claim.frozen_reason ? (
                        <p className="text-xs text-red-400">Freeze reason: {claim.frozen_reason}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                      {claim.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setActionType('approve');
                              setActionNote('');
                            }}
                            className="rounded-full bg-green-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-600"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setActionType('reject');
                              setActionNote('');
                            }}
                            className="rounded-full border border-red-800 px-4 py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/40"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {claim.status !== 'frozen' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClaim(claim);
                            setActionType('freeze');
                            setActionNote('');
                            setBanUser(false);
                          }}
                          className="rounded-full border border-red-900 px-3 py-1 text-[11px] font-bold text-red-500 hover:bg-red-950/50"
                        >
                          Freeze / Ban
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action confirmation dialog */}
        {selectedClaim && actionType ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl">
              <h3 className="text-base font-bold text-[var(--cream)] capitalize">
                {actionType} Claim for {selectedClaim.spot_name}
              </h3>
              <p className="mt-1 text-xs text-[var(--cream-muted)]">
                {actionType === 'approve'
                  ? 'Approving this claim immediately activates venue calendar rights for the claimant.'
                  : actionType === 'reject'
                    ? 'Rejecting this claim declines calendar access.'
                    : 'Freezing immediately revokes calendar rights and unpublishes venue events.'}
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Notes / Reason (optional for approve, recommended for reject/freeze)"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--cream)]"
                />

                {actionType === 'freeze' ? (
                  <label className="flex items-center gap-2 text-xs text-red-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={banUser}
                      onChange={(e) => setBanUser(e.target.checked)}
                      className="rounded border-red-600 text-red-600"
                    />
                    <span>Ban claimant account (fraudulent attestation / false claim)</span>
                  </label>
                ) : null}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClaim(null);
                    setActionType(null);
                  }}
                  className="flex-1 rounded-full border border-[var(--border-default)] py-2 text-xs font-bold text-[var(--cream-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => void executeAction()}
                  className={`flex-1 rounded-full py-2 text-xs font-bold text-white ${
                    actionType === 'approve'
                      ? 'bg-green-700 hover:bg-green-600'
                      : 'bg-red-800 hover:bg-red-700'
                  }`}
                >
                  {processing ? 'Processing…' : `Confirm ${actionType}`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};
