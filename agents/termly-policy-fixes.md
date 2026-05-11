# Termly Policy Fixes — Privacy Policy

Action checklist for Al, to be worked through inside the Termly dashboard at https://app.termly.io. Six issues were spotted in the auto-generated MenRush Privacy Policy. Each fix below points to the exact question in Termly's wizard, gives the answer to enter, and explains the consequence of leaving it broken.

When all six are done, scroll to the bottom of the wizard, click **Save & Publish**, then repeat the same review for the **Terms of Service** and **Cookie Policy** generators.

---

## Bonus — Add `privacy@menrush.com` alias in Zoho (do this first, ~1 min)

The privacy policy references `privacy@menrush.com` throughout (Section 9, contact paragraph, etc.). The mailbox does not exist yet. Add it as an alias to `hello@menrush.com` so mail does not bounce.

**Steps:**
1. Sign in to Zoho Mail Admin Console.
2. Users → click the row for `hello@menrush.com`.
3. Email Aliases tab → Add → enter `privacy` → Save.
4. Test by sending an email to `privacy@menrush.com` from any external account; it should land in the `hello@` inbox.

Why it matters: a published privacy policy that lists a non-routable contact address is a GDPR/UK-DPA red flag and an obvious sign of an amateur operation. One minute of work avoids both.

---

## Fix 1 — Founder home address (Section 14, contact)

**Currently shows:**
```
MenRush, 39 Botley Rd, Park Gate, England SO31 1AY
```

**Where in Termly:** Wizard → "Contact Us" question (near the end). The mailing address field will be on a sub-form labelled something like "Postal address for legal notices".

**Action — interim (do today):** replace the full address with just `MenRush · United Kingdom`. Termly may force a more structured format; if so, leave the street fields blank and put `United Kingdom` in the country field only.

**Action — once Icon Offices replies:** swap to the new virtual office address (full street, city, postcode).

**Why it matters:** publishing a personal home address on an adult-adjacent platform is a real-world safety risk. Hostile users, doxxers, and angry account-deactivation senders all read this section. Fix this *before* the next time the policy is republished, even if the virtual office is not ready yet.

---

## Fix 2 — Description prefix typo (Section 1)

**Currently reads:**
```
Use menrush. MenRush is a real-time, location-based social platform for adult men (18+)...
```

The `Use menrush. ` prefix is an artifact of how Termly concatenated the company-name field with the description field. It reads as a typo and undermines the document's credibility on the very first sentence.

**Where in Termly:** Wizard → "Description of your product / service" textarea. The first sentence in that textarea will currently start with `Use menrush.` — that came from the company name field bleeding into the description. Some Termly generators present this as a single combined "Tell us about your business" question.

**Action:** edit the textarea so it begins:
```
MenRush is a real-time, location-based social platform for adult men (18+)...
```
Strip the leading `Use menrush. ` exactly. Leave the rest of the paragraph untouched.

**Why it matters:** the description block is rendered verbatim in Section 1 (Introduction). The current opening sentence is the first thing any auditor, app store reviewer, or user reads. Sloppy copy here makes every subsequent clause look unreviewed.

---

## Fix 3 — Location cache duration blank (Section 4, Google Maps paragraph)

**Currently reads:**
```
We obtain and store on your device ('cache') your location for __________ months.
```

The blank was never filled in.

**Where in Termly:** Wizard → "Do you use the Google Maps Platform APIs?" → if Yes, the follow-up question is "How long do you cache the user's location on their device?". It is a numeric input followed by a unit dropdown.

**Action:** enter `6` and leave the unit on `months`.

**Why it matters:** an unfilled blank in a published policy is the single clearest signal of a generator-with-no-review. Google's Maps Platform Terms of Service specifically require the cache duration to be disclosed. Even if the maps provider is wrong (see Fix 5), this number must not be left as `__________`.

---

## Fix 4 — Minor-contact email blank (Section 9)

**Currently reads:**
```
please contact us at __________
```

This is in the "Children under 13 / 16 / 18" subsection. The clause tells parents how to request deletion of a minor's data.

**Where in Termly:** Wizard → "Do you knowingly collect data from minors?" → No → follow-up "Email for parents to contact you". (Termly still asks for the contact email even when the answer is No, because the policy still publishes a removal-request paragraph.)

**Action:** enter `privacy@menrush.com`.

**Why it matters:** GDPR Article 8 / UK GDPR / COPPA all require a working contact channel for parental data-removal requests. A literal `__________` placeholder is non-compliant on its face and would be the first thing flagged in an Apple App Store privacy review.

---

## Fix 5 — Wrong maps provider (Section 4)

The published policy disclosure references "Google Maps Platform APIs" and links to Google's privacy policy and TOS. MenRush uses **Mapbox**, not Google Maps.

**Where in Termly:** Wizard → same maps API question as Fix 3. Termly's free tier has historically only offered Google Maps as a checkbox; "Mapbox" / "Other" may or may not be available depending on the current generator version.

**Action — preferred:** re-open the question and look for a `Mapbox` or `Other (specify)` option. If present, select it and fill in the provider name + a link to Mapbox's privacy policy: https://www.mapbox.com/legal/privacy

**Action — fallback (free tier only offers Google):** uncheck the Maps API question entirely. The location-collection clause in Section 4 is still produced by the higher-level "Do you collect geolocation data?" question, so unchecking the Google Maps sub-question only removes the inaccurate Google-specific paragraph, not the entire location disclosure.

**Action — worst case:** if Termly will not accept the question being unchecked, leave the Google reference in place and accept the gap until upgrading to a paid Termly tier (or a different generator) that supports Mapbox specifically. Document the gap in `agents/legal-status.md` so it is not forgotten.

**Why it matters:** publishing a privacy policy that names the wrong third-party data processor is materially misleading. If a regulator audits and Mapbox is in the network traffic but Google Maps is in the policy, that is a clear discrepancy. Lower priority than fixes 1-4 because it is a Termly product limitation, not a typo, but still must be resolved before public launch.

---

## Fix 6 — Duplicate sensitive-data entry (Section 1)

**Currently lists both:**
- `data about a person's sex life or sexual orientation`
- `sex life or sexual activity`

These overlap. UK/EU GDPR Article 9 uses a single category — "data concerning a person's sex life or sexual orientation". Termly is duplicating because two separate checkboxes in the wizard map to the same legal category.

**Where in Termly:** Wizard → "Sensitive personal information collected" checklist.

**Action:** uncheck `sex life or sexual activity`. Keep `data about a person's sex life or sexual orientation` checked. (The first phrasing is the GDPR-aligned one and is the safer to retain.)

**Why it matters:** redundant overlapping entries in a sensitive-data list look careless and can confuse users about exactly what is collected. They also inflate the apparent scope of data collection beyond what is actually true, which is bad for trust and unnecessary for compliance.

---

## After all six are done

1. In Termly, click **Save** at the bottom of the wizard.
2. Then **Publish** (Termly will rebuild the public URL).
3. Confirm the live policy at the published URL no longer contains: the Botley Rd address, the `Use menrush.` prefix, any `__________` blanks, any reference to Google Maps Platform, or the duplicate sex-life entry.
4. Repeat the same review pass on Termly's **Terms of Service** generator (separate wizard).
5. Repeat the same review pass on Termly's **Cookie Policy** generator (separate wizard).
6. Update the footer links on `menrush.com` from the interim `/privacy` and `/terms` placeholders to the published Termly URLs once all three documents are clean.
