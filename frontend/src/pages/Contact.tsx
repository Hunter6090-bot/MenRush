import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { contactAPI } from '../api/client';
import { SiteFooter } from '../components/SiteFooter';

const ENQUIRY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'privacy', label: 'Privacy Request' },
  { value: 'support', label: 'Support' },
  { value: 'press', label: 'Press' },
] as const;

type EnquiryValue = (typeof ENQUIRY_OPTIONS)[number]['value'];

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const Contact = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState<EnquiryValue>('general');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const n = name.trim();
    const e = email.trim();
    const m = message.trim();
    if (n.length < 2) {
      setFieldError('Please enter your full name (at least 2 characters).');
      return false;
    }
    if (!emailOk(e)) {
      setFieldError('Please enter a valid email address.');
      return false;
    }
    if (m.length < 10) {
      setFieldError('Please enter a message of at least 10 characters.');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitError('');
    setSuccess(false);
    if (!validate()) return;
    setLoading(true);
    try {
      await contactAPI.submit({
        name: name.trim(),
        email: email.trim(),
        enquiryType,
        message: message.trim(),
      });
      setSuccess(true);
      setName('');
      setEmail('');
      setEnquiryType('general');
      setMessage('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Something went wrong. Please try again or email us directly.';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[#3D2B0E]/50 bg-[#0a0805]/80 px-4 py-3 text-sm text-[#f0e4cc] placeholder:text-[#a89070]/45 focus:border-[#c8861c]/70 focus:outline-none focus:ring-2 focus:ring-[#c8861c]/25';

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] font-sans text-[#a89070]">
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-lg flex-1">
          <Link
            to="/"
            className="inline-block text-xs uppercase tracking-[0.18em] text-[#a89070] transition-colors hover:text-[#c8861c]"
          >
            ← Back
          </Link>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#f0e4cc] sm:text-4xl">
            Get in touch
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#a89070] sm:text-base">
            We&apos;ll get back to you within 48 hours.
          </p>

          <div className="mt-8 rounded-2xl border border-[#3D2B0E]/40 bg-[#1a1410] p-5 shadow-lg sm:p-8">
            {success && (
              <div
                className="mb-5 rounded-xl border border-[#c8861c]/35 bg-[#c8861c]/10 px-4 py-3 text-sm text-[#f0e4cc]"
                role="status"
              >
                Thanks — your message was sent. We&apos;ll reply within 48 hours.
              </div>
            )}

            {(fieldError || submitError) && (
              <div
                className="mb-5 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-[#f0e4cc]/90"
                role="alert"
              >
                {fieldError || submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#f0e4cc]/90">
                  Full name <span className="text-[#c8861c]">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#f0e4cc]/90">
                  Email address <span className="text-[#c8861c]">*</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="contact-type" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#f0e4cc]/90">
                  Enquiry type
                </label>
                <select
                  id="contact-type"
                  name="enquiryType"
                  value={enquiryType}
                  onChange={(e) => setEnquiryType(e.target.value as EnquiryValue)}
                  className={`${inputClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%23a89070%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                >
                  {ENQUIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#1a1410] text-[#f0e4cc]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#f0e4cc]/90">
                  Message <span className="text-[#c8861c]">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className={`${inputClass} min-h-[120px] resize-y`}
                  placeholder="How can we help?"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#c8861c] py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-[#0a0805] shadow-md transition-all hover:bg-[#d9a038] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? 'Sending…' : 'Submit'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm leading-relaxed text-[#a89070]">
            Prefer email? Reach us at{' '}
            <a
              href="mailto:privacy@menrush.com"
              className="font-semibold text-[#c8861c] underline-offset-2 transition-colors hover:text-[#d9a038] hover:underline"
            >
              privacy@menrush.com
            </a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};
