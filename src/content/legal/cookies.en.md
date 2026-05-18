# Cookie and Data Usage Policy

*Last Updated: 18 May 2026*

*Status: Baseline content — pending legal review*

This policy explains the cookies and similar technologies Dukanchi uses, why we use them, and the choices you have. We keep our use of these technologies minimal.

## 1. What Are Cookies and Similar Technologies

**Cookies** are small text files that a website stores in your browser. They help a site remember things, such as whether you are signed in.

**Similar technologies** include browser storage such as **localStorage**, which also lets a site save small amounts of information in your browser, but in a different place from cookies.

Dukanchi uses a small number of these technologies, described below.

## 2. Essential Cookies

These cookies are **essential** — the app cannot keep you signed in without them. They are set by our own server.

| Cookie | Purpose | Duration |
|---|---|---|
| `dk_token` | Keeps you signed in. This is your access / session token. | Short-lived; renewed automatically |
| `dk_refresh` | Securely renews your session without asking you to sign in again. Scoped to `/api/auth`. | Longer-lived |

> Both `dk_token` and `dk_refresh` are **httpOnly** cookies. This means they cannot be read by JavaScript in your browser, which helps protect them from theft.

## 3. Analytics: PostHog

We use **PostHog** to understand how the app is used — for example, which pages are viewed, which buttons are clicked, and which features are used. PostHog is **hosted in the EU**, which we chose as a privacy-friendly option.

Important points about our PostHog use:

- PostHog stores its data in your browser's **localStorage, not in cookies**.
- We do **not** send raw user text — your search queries, chat messages, and captions are not sent to PostHog. Only derived metrics are sent.
- **Session recording is disabled.**
- Retention setting: [TODO: confirm PostHog retention setting].

## 4. Error Tracking: Sentry

We use **Sentry** to detect and diagnose errors. When something breaks in the app, Sentry captures an **error stack trace and technical metadata** so we can fix the problem.

Sentry is not intended to capture personal data. If you would like to opt out of error tracking, you can email our Grievance Officer (see the [Grievance Officer page](/legal/grievance)).

## 5. Maps: Google Maps

We use **Google Maps** to show maps and to power nearby-store search. Google Maps loads only when you use a map or the nearby-search feature. When it loads, **Google may set its own cookies** under Google's own policy.

> See [Google's privacy policy](https://policies.google.com/privacy) for details on how Google handles this data.

## 6. Marketing and Advertising

Dukanchi uses **no marketing or advertising cookies**. We do not use cookies to track you across other websites, and **we do not sell your data**.

## 7. Your Choices

You have control over cookies and browser storage:

- **Clear site data.** Your browser's "clear site data" option clears both Dukanchi's localStorage and its cookies. Note that clearing them will sign you out.
- **PostHog opt-out.** To opt out of PostHog analytics, email our Grievance Officer.
- **Do Not Track.** Some browsers send a "Do Not Track" signal. [TODO: implement DNT handling].

## 8. Updates

We may update this Cookie and Data Usage Policy from time to time. The "Last Updated" date at the top of this page shows when it was last revised. If we make a material change, we will give reasonable notice through the app.

<!-- TODO: confirm PostHog retention setting; implement DNT handling -->
