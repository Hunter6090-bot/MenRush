import React, { useState } from 'react';
import { hotSpotsAPI, HotSpotDTO, VenueClaimDTO } from '../api/client';

export const LEGAL_ATTESTATION_STATEMENT =
  'I attest that I am an authorized owner, manager, or representative of this venue. I understand that submitting a false or fraudulent claim will result in immediate suspension or permanent freeze/ban of my MenRush account and forfeiture of venue rights.';

interface VenueClaimModalProps {
  spot: HotSpotDTO | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (claim: VenueClaimDTO) => void;
}

export const VenueClaimModal: React.FC<VenueClaimModalProps> = ({
  spot,
  open,
  onClose,
  onSuccess,
}) => {
  const [role, setRole] = useState('General Manager');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [attestationAgreed, setAttestationAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');

  if (!open || !spot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attestationAgreed) {
      setError('You must agree to the legal attestation to claim this venue.');
      return;
    }
    if (!contactName.trim() || !contactEmail.trim()) {
      setError('Contact name and business email are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await hotSpotsAPI.submitClaim(spot.id, {
        venue_role: role,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || null,
        website_or_social_proof: proofUrl.trim() || null,
        attestation_agreed: true,
        attestation_text: LEGAL_ATTESTATION_STATEMENT,
      });

      setSubmittedMessage(
        res.data.message ||
          'Venue claim submitted for ops review. You will receive calendar management rights once approved.',
      );
      onSuccess(res.data.claim);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Could not submit claim. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-claim-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--copper)]/40 bg-[var(--bg-card)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-xl font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#E0A14A]">
            Claim this venue
          </p>
          <h2 id="venue-claim-title" className="mt-1 text-xl font-extrabold text-[var(--cream)]">
            Claim {spot.name}
          </h2>
          <p className="text-xs text-[var(--cream-muted)]">
            {spot.city ? `${spot.city} · ` : ''}Commercial Hot Spot pin
          </p>
        </div>

        {submittedMessage ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(196,131,42,0.2)] text-2xl text-[#E0A14A]">
              ✓
            </div>
            <p className="text-sm font-bold text-[var(--cream)]">{submittedMessage}</p>
            <p className="mt-2 text-xs text-[var(--cream-muted)]">
              Face copy on approval: &ldquo;Venue claimed&rdquo; · &ldquo;Calendar managed by venue&rdquo;
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-[#C4832A] px-6 py-2.5 text-xs font-bold text-[#1A0E03]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs leading-relaxed text-[var(--cream-muted)]">
              Authorized representatives can claim this venue to publish their schedule to
              the MenRush Events calendar. Ops human approval is required before publishing rights are granted.
            </p>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">
                Your role at {spot.name}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
              >
                <option value="General Manager">General Manager</option>
                <option value="Owner">Owner / Licensee</option>
                <option value="Event Promoter">Event Promoter</option>
                <option value="Staff">Authorized Staff</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Turner"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">
                  Business Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@venue.co.uk"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+44 20 ..."
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">
                  Website / Social Proof (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.06)] p-3">
              <label className="flex items-start gap-2.5 text-xs text-[var(--cream)] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={attestationAgreed}
                  onChange={(e) => setAttestationAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--copper)] text-[#C4832A] focus:ring-0"
                />
                <span className="leading-relaxed">
                  <strong className="text-[#E0A14A]">Legal Attestation:</strong>{' '}
                  {LEGAL_ATTESTATION_STATEMENT}
                </span>
              </label>
            </div>

            <p className="text-[11px] text-[var(--cream-muted)]">
              False claims result in immediate account freeze/ban. Venue posts are User Generated Content (UGC).
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-[var(--border-default)] py-2.5 text-xs font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !attestationAgreed}
                className="mr-cta-gradient flex-1 rounded-full py-2.5 text-xs font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Claim'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
