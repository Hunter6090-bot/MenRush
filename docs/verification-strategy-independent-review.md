# MenRush Verification Strategy — Independent Review

**Status:** Received July 2026. Under active consideration. See covering note below for action points.

---

## The core idea is strong, but the verification system should be structured more carefully.

MenRush serves people with very different privacy needs. Some users will be openly gay and comfortable showing their faces or verifying their identity. Others may be married, closeted, from religious or traveller communities, employed in sensitive professions, or living somewhere where being identified as gay could place them in danger.

Requiring every member to provide government ID could therefore exclude a significant and important part of the intended community. However, allowing completely unchecked accounts would increase scams, impersonation, bots, ban evasion and other forms of abuse.

The best solution is not simply "verified versus unverified." MenRush should use layered, privacy-preserving verification.

---

## Three different things must be separated

"Verified" can refer to three completely different claims:

- **Adult confirmed:** The person has passed an appropriate 18+ age-assurance check.
- **Real person confirmed:** A live human controls the account.
- **Identity confirmed:** A government document has been privately matched to the person.

These claims should not be represented by one vague badge. Each badge must tell members exactly what has — and has not — been established.

A fourth status should remain completely separate:

- **Premium member:** The person pays for additional features.

Paying money does not prove identity, authenticity, safety or good character.

---

## Recommended account model

Every member should pass an appropriate private 18+ check before receiving access to adult areas. That is a platform safety requirement, not a subscription benefit.

After that, members can optionally complete stronger verification.

| Account status | What MenRush has established |
|---|---|
| Adult member | Passed the required 18+ assurance |
| Authentic member | Passed a live-person challenge |
| Identity-checked member | Government ID was privately matched |
| Premium member | Pays for premium features |

These statuses can overlap. For example, someone could be:
- an authentic but anonymous free member
- an identity-checked free member
- a premium member without identity verification
- both premium and identity-checked

This means MenRush should have two separate systems:
- **Trust level:** Adult checked → Authentic → Identity checked
- **Membership plan:** Free → Premium

The middle option should not be called "Free Verified," because that makes a trust status sound like a subscription tier.

---

## Protecting discreet members

MenRush should explicitly support pseudonymous participation.

A suitable platform promise:

> Everyone is confirmed as an adult. You may remain discreet. Members can optionally prove that they are a real person or privately verify their identity without displaying their legal name or identification document.

The underlying principle:

> **Pseudonymity is permitted; deception is not.**

A discreet user should not be treated as suspicious merely because they do not publish a face photograph, legal name, workplace or social-media account.

---

## Authenticity without government ID

Members could earn an "Authentic Person" badge through a random live challenge, such as:
- copying two randomly selected poses
- turning their head in prompted directions
- making a short sequence of movements
- repeating a challenge that expires after a few minutes

This is stronger than asking someone to submit a static selfie holding a piece of paper with the date. Static challenges can be copied, edited, reused or generated.

MenRush should distinguish between:
- **Live person confirmed:** A real person completed the challenge privately.
- **Profile photo matched:** The live person was also matched to the face displayed on the profile.
- **Identity checked:** The live person was privately matched to an official document.

Members must be able to understand the difference.

---

## Benefits that could encourage optional verification

Authentic or identity-checked members could receive:
- a clearly explained trust badge
- greater visibility in discovery
- higher initial messaging limits
- the ability to filter for other checked members
- the option to receive messages only from checked members
- access to selected trust-sensitive groups or events
- permission to create groups or organise events
- faster removal of restrictions applied to new accounts
- priority moderation review
- stronger account-recovery options
- fewer repeated security challenges
- optional mutual verification before opening private albums
- a "verified since" marker
- a temporary profile boost after completing verification

These benefits create genuine incentives without making verification compulsory.

Essential safety features must remain available to everyone, including reporting, blocking, consent and privacy controls, scam warnings, moderation, safety guidance, and appeals. **Safety should never become a premium or verified-only benefit.**

---

## Verified-only groups

Some verified-only groups could be valuable, especially for events, dating, professional networking or discussions requiring greater trust. However, making the main community verified-only would undermine the goal of supporting discreet users.

Individual members should be able to choose who can contact them:
- everyone
- authentic members only
- identity-checked members only

---

## External WhatsApp or Telegram groups

WhatsApp would be a risky choice for this audience because group participation may expose phone numbers, names and profile photographs. That could lead to outing, harassment, blackmail or unwanted contact.

Community groups should ideally be built inside MenRush. If an external service is temporarily used during an early pilot, members should not be required to reveal their telephone numbers or legal identities, and the risks should be explained clearly.

---

## Why the selfie-and-paper method is insufficient

A selfie holding a handwritten date may discourage very basic bots, but it should not be the primary verification system. Its weaknesses include:
- images can be edited or generated
- the same person can verify multiple scam accounts
- another person can be paid to complete the challenge
- a dated selfie does not prove legal age
- manual review may be inconsistent
- sensitive facial images would need secure handling
- storage creates privacy and breach risks

Random, short-lived challenges would be stronger. MenRush should retain only the verification result — for example, "over 18 passed" or "liveness passed" — rather than permanently storing identity documents, selfies or videos.

---

## Scam and bot prevention

Verification alone will not eliminate scammers. MenRush should combine it with:
- email, telephone or device confirmation
- rate limits for new accounts
- limits on bulk and repetitive messaging
- detection of disposable email addresses
- duplicate-image detection
- suspicious-link detection
- warnings when someone quickly moves a conversation off-platform
- detection of common payment, investment and gift-card scams
- abnormal account-creation monitoring
- ban-evasion detection
- account and device risk scoring
- human review and an appeals system
- specialised detection for threats of outing, coercion and blackmail

Blank profiles, VPN use, unusual locations or reluctance to publish a face should **not** automatically be treated as proof of malicious behaviour.

---

## Privacy and legal considerations

Age assurance, liveness checks, facial comparison and identity checks must be treated as separate data-processing activities.

MenRush should:
- collect only what is necessary
- use a specialist provider where appropriate
- avoid receiving complete ID information when a simple "over 18" result is sufficient
- define short retention periods
- encrypt sensitive information
- prevent verification data from being used for advertising
- conduct a data-protection impact assessment
- provide an alternative process when automated checks fail
- explain which provider processes the information
- explain whether facial or biometric templates are created
- obtain specialist legal advice for every country in which the service operates

References: [Ofcom age-assurance guidance](https://www.ofcom.org.uk/online-safety/protecting-children/age-checks-for-online-safety--what-you-need-to-know-as-a-user) · [ICO data-protection expectations](https://ico.org.uk)

---

## Honest conclusion

A stronger structure is:
- every member passes the legally appropriate adult-access check
- real-person verification is optional but rewarded
- government-ID identity checking is optional and more strongly rewarded
- free and premium plans remain separate from verification
- discreet members retain meaningful access and dignity
- members can decide which trust levels may contact them
- badges describe precise facts rather than suggesting that somebody is automatically safe or trustworthy

---

## Action points (added by Claude Cowork, July 2026)

1. **Send to Grok CLI** — redesign the verification flow around the three-tier model (adult / authentic / identity-checked) rather than a single mandatory ID gate.
2. **Update DPIA** — reflect the layered data-processing activities separately.
3. **Update CCBill and Stripe applications** — current description says "mandatory government ID + selfie for all users." Update to "layered optional verification above a mandatory age-assurance baseline."
4. **Update CLAUDE.md** — replace current verification stack description with the three-tier model.
5. **UK law note** — Ofcom's highly-effective age-assurance requirement likely means the mandatory baseline must be more than self-declaration. Phone + email + credit card bin check is a practical v1 gate before the optional tiers.
