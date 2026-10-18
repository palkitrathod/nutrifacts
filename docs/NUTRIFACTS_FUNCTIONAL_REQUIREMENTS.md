# Nutrifacts — Functional Requirements

**Product:** Nutrifacts with Dt. Anchal Dewan  
**Document type:** Business analysis / functional requirements  
**Source:** Behaviour of the current web app in this repository.  
**Last updated:** 17 Oct 2026 — public home page, real sign-up / sign-in / sign-out, and server-stored data (sections 1–4, 17–19).  
**How to read this:** This describes what the product does today, in the language a BA would use with a client. Clinic session fees and package amounts that appear *inside the app* are product rules, not a project quote.

Anything the code does not make clear is listed as **Needs clarification**. Do not treat those lines as agreed scope.

---

## 1. What this product is

Nutrifacts is a clinic web app for one nutrition practice. It has two kinds of people:

- **Patient** — sees their own diet chart, logs meals and water, tracks weight, books consults, buys care packages, and chats with the dietitian on WhatsApp.
- **Dietitian admin** — Dt. Anchal Dewan. Sees all patients, edits diet charts, uploads PDF charts, assigns clinical protocols, reviews adherence, manages appointments, sends reminders, and manages package pricing and refunds.

The brand line used in the header is “Nourish Better. Live Healthier.” The dietitian shown is Dt. Anchal Dewan, M.Sc. Clinical Nutrition & Dietetics. Clinic contact shown in the app is phone **+91 98721 54320** and email **anchaldewan380@gmail.com**. WhatsApp opens `wa.me/919872154320`.

Visitors land on a public home page. Patients create an account with email and password, then sign in; the dietitian signs in with an admin account set up by the clinic. All app data (profiles, diet charts, weights, appointments, payments, notifications) is stored on the Nutrifacts server, so it follows the person to any device. Each person only ever receives their own records; the dietitian receives all patients. See section 4.

**Needs clarification:** Is production for one dietitian only, or multiple dietitians / clinics? Is the legal clinic name, registration number, GSTIN, and address on the PDF/invoice the real practice details, or sample copy?

---

## 2. People who use the app (roles)

### 2.1 Patient

A patient has: name, email, phone, age, gender, height, starting / current / target weight, dietary preference, health goals, medical conditions, allergies, daily water goal in litres, join date, follow-up date, and assigned program name.

Dietary preferences available in forms: Vegetarian, Vegan, Eggetarian, Non-Vegetarian, Jain.

Sample patients (development and demo environments only — not created in production):

- Priya Sharma — PCOS / vegetarian.
- Rohan Verma — Type 2 diabetes / eggetarian.
- Kavita Mehta — hypothyroidism / vegetarian.

A patient can only see and change their own records. This is enforced by the server, not just hidden in the screens: a patient cannot load another patient's data, cannot edit diet charts or prices, cannot change an appointment after booking, cannot alter a payment amount, and cannot change their account email or role.

### 2.2 Dietitian admin

One dietitian account. They can:

- Pick which patient they are working on (a “selected patient”).
- See and edit that patient’s diet chart.
- See all appointments, all payments, all adherence logs.
- Assign a named clinical protocol to a patient.
- Send in-app notifications to one patient or all patients.

**Needs clarification:** Can a patient edit medical conditions themselves in production, or only the dietitian? The prototype lets the patient edit them on Profile.

---

## 3. How the person moves around the app

Pages with their own web address:

| Address | Page | Who can open it |
|---|---|---|
| `/` | Public home page | Everyone |
| `/signin` | Sign in | Signed-out visitors (signed-in people are sent to the app) |
| `/signup` | Create account | Signed-out visitors |
| `/forgot-password` | Password reset request | Signed-out visitors |
| `/app` | The app (tabs below) | Signed-in people only; others are sent to Sign in and brought back afterwards |

Any other address shows a “page doesn't exist” page with a link home. Inside `/app`, the middle content is swapped by a **tab name** without changing the address.

### 3.1 Device view (top strip, always visible)

Above the green app header there is a white strip:

- **Android View** — wraps the app in a phone-sized frame with a fake status bar (clock, 5G, Wi‑Fi, battery) and a home-indicator bar at the bottom. Default when the app opens.
- **Desktop View** — wider layout, up to a large content column.
- **Account** button (shows first name, or “Dietitian Admin”) — opens the Account panel (section 4.5).

**Needs clarification:** Android View / Desktop View is a prototype demo control. Should production drop this and just be a normal responsive website?

### 3.2 Green top bar (inside the app)

- Tapping the **🥗 Nutrifacts · dt.Anchal** wordmark goes to **Home**.
- **Bell** — opens Notifications. A yellow badge shows how many unread items belong to the current account.
- Avatar + first name + “Patient” or “Dietitian” — opens the Account panel (section 4.5).

When Desktop View is on *and* the window is large, extra text links appear in this bar: Home, Diet Plans or My Diet Chart, Progress & Logs, Plans & Pricing, Appointments, Dietitian Admin or My Profile.

**Observed mismatch (needs clarification):** those desktop links send “Plans & Pricing” to a tab named `packages`, while the rest of the app uses the tab named `plans` for the packages screen. Appointments also appear in this desktop menu, but not in the bottom bar.

### 3.3 Bottom bar (always in the phone-style app)

Five equal buttons:

| Button label (patient) | Button label (dietitian) | What it opens |
|---|---|---|
| Home | Home | Home |
| Diet Chart | Diet Plans | Diet chart for the current / selected patient |
| Plans | Pricing | Packages, purchases, pricing admin |
| Track | Progress | Weight and BMI tracker |
| Profile | Admin | Patient profile, or dietitian admin console |

There is **no Appointments button** on this bar. Appointments still exist as a screen and can be opened from Home booking, from a notification about an appointment, or from the desktop top links.

**Needs clarification:** Should Appointments be a sixth tab, sit under Profile, or stay reachable only from Home / notifications?

### 3.4 Floating WhatsApp button

A green round button sits above the bottom bar on every screen. It opens a small sheet titled “Direct WhatsApp Consultation”.

- Message box is prefilled: “Hello Dt. Anchal, I'm [current user name] reaching out via the Nutrifacts app regarding my nutrition guidance and consultation.” The user can edit it.
- **Copy Text** copies that message.
- **Launch WhatsApp** opens WhatsApp in a new browser tab with that message.
- Copy on the sheet says replies are during clinic hours 10:00 AM – 07:00 PM IST.

A separate Home tile “WhatsApp Chat” skips this sheet and opens WhatsApp immediately with a shorter fixed message.

**Needs clarification:** One WhatsApp number for the whole clinic, or per-dietitian? Should the dietitian see this button at all? The code still shows it for the dietitian account.

---

## 4. Home page, sign up, sign in and account

### 4.1 Public home page (`/`)

Sections: hero, stats strip, Clinical Nutrition Services, About Dt. Anchal, How it works, Pricing, patient stories, final call to action, footer. The top menu scrolls to Services, About, Pricing and How it Works.

- **Sign In** goes to `/signin`. **Get Started** goes to `/signup`. They are separate pages.
- A service card's **Book this service** and a pricing card's **Choose this plan** go to sign-up with that choice remembered. After sign-up the app opens the booking form for that service, or the Plans tab.
- Pricing cards show the **live price list** — the same one the dietitian edits in Manage Pricing. Inactive plans are not shown.
- Someone already signed in sees **Open my dashboard** instead of Sign In / Get Started.
- Phone and email are tap-to-call / tap-to-email; WhatsApp buttons open `wa.me/919872154320`.

### 4.2 Create account (`/signup`)

Fields (all required):

| Field | Rule |
|---|---|
| Full name | 2–80 characters; letters in any script (incl. Hindi), spaces, `.` `'` `-` |
| Email address | Valid email; must not already have an account (not case-sensitive) |
| Mobile number (WhatsApp) | 10-digit Indian mobile (with or without +91 / 0), or an international number with country code |
| Password | 8–128 characters, at least one letter and one number; strength meter shown |
| Confirm password | Must match |
| Consent checkbox | “I agree that Nutrifacts may store my details to provide nutrition care, and contact me by phone or WhatsApp about my consultations.” |

- Errors show under each field after the person leaves it, or all at once on submit; the cursor moves to the first problem.
- If the email is already registered, the email field says so and offers **Sign in to your account**.
- Success signs the person in, creates their patient profile (program: “Awaiting initial consultation”) and a welcome notification, and opens the app.
- Self sign-up always creates a **patient**. It can never create a dietitian account.
- At most 20 new accounts per hour from one network (configurable), to stop automated sign-ups while still allowing a clinic reception desk.

### 4.3 Sign in (`/signin`)

- Email + password, show/hide password, **Keep me signed in for 30 days** (on by default). Without it, the session ends when the browser closes (and after 24 hours at most).
- Wrong email or wrong password both show the same message, “Incorrect email or password.” The password field is cleared; the email is kept.
- After 10 failed attempts for the same email from the same network in 15 minutes, sign-in is paused and the message says how many minutes to wait.
- After signing in, the person returns to the page they were trying to open, otherwise the app home.

### 4.4 Forgot password (`/forgot-password`)

There is no email service yet, so resets are done by the clinic. The page takes the email address and opens WhatsApp to the clinic with a prefilled message: “Hello Dt. Anchal, I can't sign in to Nutrifacts and need a password reset for my account: [email]”.

**Needs clarification:** Should a self-service “email me a reset link” flow be added (requires an email provider)?

### 4.5 Account panel and sign out

Opened from the avatar or the Account button. Shows the signed-in person's name, Patient/Admin badge, program, email and phone, a privacy note, and **Sign out**. Sign out saves any pending change, ends the session on the server, and returns to the home page. After sign-out, `/app` (including via the browser Back button) goes to Sign in.

The old “Account & Access Switcher” (switching into any patient or the dietitian, and registering patients from inside the app) has been **removed**, because with real accounts it would let anyone act as anyone.

**Needs clarification:** Should the dietitian / front desk be able to create patient accounts on a patient's behalf? (Today patients sign themselves up.)

### 4.6 Dietitian (admin) account

Created by the clinic at server start-up from its configured admin email and password; changing the configured password signs out all existing admin sessions. Sample accounts with a shared demo password exist only in development and demo environments.

---

## 5. Home

Welcome banner greets the **current account name** (so a dietitian also sees “Welcome back, Dt. Anchal Dewan”). Marketing lines and proof points are on this banner (experience, transformed lives, no crash diets).

### 5.1 Buttons on the banner

- **Book Consultation** — opens the booking sheet with no service pre-selected.
- **View Diet Chart** — only if this account already has a chart. Opens the PDF-style chart preview.

### 5.2 Affordable Consultation Pricing strip

Shows two tappable chips. Both open the same booking sheet:

- **First Session** — labelled Health & Diet Intake, amount shown as ₹500.
- **Follow-ups** — labelled Progress & Updates, amount shown as ₹300.

### 5.3 Four quick tiles

- **My Diet Chart** (dietitian label: **Manage Diet Plans**) — goes to Diet Chart / Diet Plans. Subtitle shows chart version if one exists.
- **Track Weight** (dietitian: **Patient Progress**) — goes to Track / Progress. Subtitle shows current weight if present. For a dietitian this is the dietitian’s own weight field, not a patient’s.
- **Book Consult** — opens booking (video and in-clinic).
- **WhatsApp Chat** — opens WhatsApp in a new tab (see 3.4).

### 5.4 Dietitian spotlight card

Photo of Dt. Anchal, name, qualifications, quote, “Personalized Care” and “Clinical Grounding” notes, clinic phone, and **Book 1-on-1 Consultation** (same booking sheet).

### 5.5 Today’s Diet Schedule

Shows the first meal on the current chart that is **not** yet marked eaten in today’s tracker. If every meal is marked, it falls back to the first meal.

- **Full Chart** — goes to Diet Chart.
- **Mark Eaten** / **Completed** — toggles that meal as done for this user. It does **not** open the detailed intake logger (that lives on Diet Chart).
- **Print / Save PDF** — opens the PDF preview if a chart exists. If there is no chart, tapping this in the footer still tries to open the preview, but the preview only appears when a chart exists.

If there is no chart: “No active diet chart assigned yet” and **Book assessment with Dt. Anchal**.

### 5.6 Hydration Tracker

Uses the current account’s water goal (default 3.0 litres). The app treats **4 glasses = 1 litre**, so a 3 L goal is 12 glasses. Each glass is 250 ml.

- **−** removes one glass. Disabled at 0. The tracker will not go below 0 or above **16 glasses**.
- **+250ml** adds one glass.
- A bar shows percent of goal.
- A fixed tip about warm water before lunch is shown. It is not personalised.

Water is stored against the **logged-in user id**, not against the dietitian’s selected patient. If the dietitian is logged in, they are logging water on the dietitian account.

**Needs clarification:** Should the dietitian’s Home show clinic stats instead of a personal water/meal tracker?

### 5.7 Nutrition Packages (first three only)

Shows the first three packages. Monthly Nutrition Care is marked **Recommended** in seed data.

Each card: duration label, title, tagline, amount in INR, first two inclusions, **Select & Pay Online** — opens checkout for that package (or goes to Plans if checkout is not wired).

**Compare all packages →** (hidden on very small screens) goes to Plans.

### 5.8 Clinical Nutrition Services

Six service cards from seed data:

1. Weight Management  
2. PCOS & PCOD Care  
3. Diabetes Nutrition  
4. Healthy Weight Gain  
5. Therapeutic Diets  
6. Personalized Meal Planning  

Each card shows duration, a monthly-style fee display, title, tagline. Tapping the card opens a **service detail** overlay: philosophy, ideal for, what’s included, consultation fee display, **Book Consultation** (closes the overlay and opens booking with that service title filled in), and **X** to close.

**Explore all programs →** also opens booking, without a service pre-selected.

These service “monthly” amounts on the cards are **display copy**. They are not the same as the three checkout packages, and tapping a service does not start payment.

**Needs clarification:** Are “services” catalogue pages that only lead to booking, while “packages” are what patients actually pay for? The prototype treats them as two lists.

---

## 6. Diet Chart (patient) / Diet Plans (dietitian)

### 6.1 Dietitian-only bar at the top

Visible only as dietitian.

- **Patient** dropdown — changes the selected patient and cancels any in-progress edit.
- **Upload PDF Diet Chart** — file picker, PDF only. Attaches the file to that patient’s chart (or creates a thin chart if none exists, with a 1500 kcal default and empty meals). Shows a short success banner.
- **Modification History** — overlay listing version, date, who changed it, summary. **Close** or **X**.
- **Edit Plan Details** / **Cancel Edit** — turns title, daily calories, follow-up date, and dietitian note into fields.

### 6.2 Chart header (when a chart exists)

Shows program name, version, title, “Prescribed for [name] · Issued on [date]”.

Buttons:

- **View & Download PDF** — PDF-style preview of the structured chart (not necessarily the uploaded file).
- **Print** — same preview (print lives inside that overlay).

Four metric tiles: Daily Target (kcal), Macro Balance (carbs / protein / fats percents), Weekly Adherence (percent followed vs skipped), Next Follow-up date.

Adherence percent: followed = full or partial logs; skipped = skipped logs. **If the patient has never logged a meal, the percent shows 100.** That is current behaviour.

Amber box: “Note from Dt. Anchal Dewan” with clinical notes.

While editing, **Cancel** and **Save Plan Updates**. Save bumps the version by 0.1 and appends a history line about calories and notes. It does **not** let the dietitian edit individual meals or the 7-day grid in this screen.

**Needs clarification:** How should the dietitian create or change the actual meal rows and weekly plan? The prototype only edits title, calories, follow-up, notes, or replaces via PDF / clinical protocol assign.

### 6.3 Seven-day selector

Monday through Sunday. Default Monday (not “today”). A small count badge on a day is how many intake logs exist for that weekday in history (not limited to this calendar week).

Meals shown are that day’s `weeklyPlan` list, or if missing, the chart’s default `meals` list.

Each meal card shows: timing label, clock time, title, description, optional kcal, prescribed options, portion guidance (or a default katori/roti/glass line), optional healthy swap.

**Record Intake** / **Update Log** opens the food record overlay. If already logged for that meal id + weekday, a badge shows Followed (100%), Partially Eaten (x%), or Skipped Meal, plus skip reason or notes and log time.

### 6.4 Record Food Intake overlay

Question: “Did you follow this prescribed meal?”

- **✓ 100% Full** — portion 100  
- **~ Partial** — then choose 25% / 50% / 75%  
- **✗ Skipped** — portion 0, and a reason dropdown: work/deadlines; not hungry; ate outside; ingredients not available; acid reflux/digestive fullness; traveling/commuting. Default reason is “Busy with work meetings”.

Optional notes. **Cancel** or **X** discards. **Save Food Record** stores a new log (it does not overwrite the old one; a new row is added). If skipped, the dietitian account also gets a notification “Meal Skipped: [patient name]”.

**Needs clarification:** Should a second log for the same meal on the same day replace the first, or stack? The prototype stacks.

### 6.5 Do’s and Don’ts

Two lists from the chart.

### 6.6 Empty chart

Patient copy: waiting for Dt. Anchal. Dietitian copy: upload a PDF or create a plan.

---

## 7. PDF / print diet chart overlay

Opens from Home, Diet Chart, or Print. Only mounts if a chart exists for the current / selected patient. Uses the **logged-in user** as the patient header, which for the dietitian is Dt. Anchal, not the selected patient.

**Needs clarification:** When the dietitian prints, should the letterhead patient be the selected patient? The prototype uses `currentUser`.

Buttons:

- **Print / Save PDF** — browser print dialog.
- **Download Chart** — downloads a **.txt** file (plain text meal list), not a PDF file. Filename like `Nutrifacts_DietChart_[Name]_v[version].txt`.
- **X** closes.
- If an uploaded PDF was attached, **Download Original** downloads that file.

The printable body includes clinic letterhead, patient stats, plan focus, macros, meals from `chart.meals` (the default list, **not** the selected weekday), do’s, don’ts, hydration, dietitian note.

Seed letterhead also shows a registration number and “ISO 9001:2015” line.

**Needs clarification:** Are those registration / ISO / GST lines real clinic facts for production documents?

---

## 8. Plans / Pricing (packages)

Three inner tabs: **Available Plans**, **My Purchases** (dietitian: **All Transactions**), and for dietitian only **Manage Pricing**.

### 8.1 Available Plans

Seed packages:

1. **Basic Nutrition Consultation** — ₹499, 14-day validity, one-time.  
2. **Personalized Diet Plan** — ₹999, 30-day validity.  
3. **Monthly Nutrition Care** — ₹2499, 30-day, marked most recommended.

Patients only see packages marked active. Dietitian also sees inactive ones with an Inactive badge.

Each card: duration, title, tagline, INR amount, full inclusions, terms text.

Patient button: **Select & Pay Online**, or **Renew Plan (₹…)** if `getActivePackage` thinks this is their current package. Active package is the **most recent successful payment**, not necessarily one still inside `validUntil`.

Dietitian on a card: **Edit Price** (title, INR, tagline) and **Deactivate** / **Activate**.

Footer copy lists UPI (GPay, PhonePe, Paytm), cards (Visa, MasterCard, RuPay), net banking.

If the patient has a successful payment, a green strip shows Active Package, valid until, transaction ref, and **View Invoice**.

Dietitian KPI strip: total revenue (sum of successful payments), count of successful payments labelled “Active Subscriptions”, a **fixed** “Average Order Value ₹1,749” (not calculated from data), and “Gateway Status: Demo Gateway Mode”.

### 8.2 My Purchases / All Transactions

List of payments (own only for patient; all for dietitian): package title, amount, status, invoice number, transaction ref, date, valid until, patient name (dietitian). Refund reason if refunded.

- **View Receipt** — tax invoice overlay.  
- Dietitian **Issue Refund** on successful rows — confirm overlay with reason (default “Requested by patient within 7 days”), **Cancel** or **Confirm Refund**. Refund sets status to refunded, stores reason and date, notifies the patient. The confirm text says it revokes package validity; the payment record is marked refunded, but there is no separate “revoke access” flag beyond status.

### 8.3 Manage Pricing (dietitian)

**Create New Package** / **Cancel**. Form: title, price INR, duration tag, tagline, inclusions (one per line). **Publish New Package** adds it as active, category “specialized”, validity **always 30 days**, fixed description and terms text.

There is no delete-package control in the UI (a trash icon is imported but unused).

---

## 9. Checkout (pay for a package)

Overlay: “Secure Payment Gateway”. Close with **X** until payment finishes (X is hidden on the success step).

Shows selected package, amount, “All taxes incl.”, first three inclusions.

Payment method (three tiles):

1. **UPI / QR** — pick Google Pay, PhonePe, or Paytm (this also overwrites the UPI id with a sample id). User can type a VPA.  
2. **Card / RuPay** — card number, expiry, CVV, name on card. Fields are prefilled with sample values.  
3. **Net Banking** — bank dropdown: HDFC, SBI, ICICI, Axis, Kotak, PNB.

Wallet exists in the data model but **there is no Wallet button**.

**Pay ₹[amount] & Activate Package** waits about 1.2 seconds, then **always marks the payment successful**. There is no failure path. It sets the patient’s assigned program to the package title and follow-up date to the validity end date. Notifications go to the patient and to the dietitian.

Success screen: transaction id, summary, **Go to My Diet & Schedule** (closes checkout and then opens the receipt overlay from the parent).

Copy on the form says this is a **simulated** Razorpay/Cashfree demo gateway.

**Needs clarification:** In production, does buying a package also collect the consult fee, or are consult fees paid separately at booking? Booking currently does not take payment.

---

## 10. Payment receipt / tax invoice overlay

From View Invoice / View Receipt.

- **Print Invoice** — browser print.  
- **Download** — `.txt` receipt, not PDF.  
- **X** closes.

Shows invoice number, date, status, billed-to name/phone/email, transaction ref, payment details, validity, line item, subtotal, “Healthcare Exemption (GST 0%)”, total paid, refund banner if refunded, payment terms, signature line for Dt. Anchal.

Seed GSTIN and “Healthcare Exempt under Sec 12AA” appear on this sheet.

**Needs clarification:** Confirm GST treatment and legal invoice fields with the client’s accountant. Do not assume 0% GST is correct for their practice.

---

## 11. Track / Progress (weight)

Dietitian sees a patient dropdown at the top.

Title: Weight & Body Metrics Tracker.

**Record New Weight** opens “Record Fasting Weight”.

Four numbers: current weight, starting weight, net progress (current minus start; green if not increased), BMI from current weight and height.

BMI bands used in the app: under 18.5 Underweight; under 25 Normal / Healthy; under 30 Overweight; otherwise Obese.

A bar “Journey to Target Weight” uses how far current is from start toward target. It uses absolute difference, so it is written as a fat-loss style bar.

**Weight Trajectory Graph** — line of weigh-ins vs a dashed goal line. Dates on the axis are month-day from the record.

**Weigh-in History & Notes** — newest first: weight, optional waist, energy 1–5, notes, date.

### Record Fasting Weight form

- Weight (kg) required, step 0.1. Will not save if not a positive number.  
- Date required, defaults today.  
- Waist cm optional (default field shows 78).  
- Energy 1–5 dropdown (High & Fresh … Exhausted), default 5.  
- Optional notes; if empty, saves “Weekly check-in logged via app”.  
- **Save Weight Log** — adds a record, updates that patient’s current weight, notifies the patient, closes. Dietitian logging for a selected patient writes against that patient id.

A tip says to weigh in the morning after voiding, before breakfast.

There is no delete or edit of an old weigh-in.

**Needs clarification:** Should logging weight on Profile (editing current weight) also create a history row? Today it does not.

---

## 12. Appointments

Not on the bottom bar. Header: Diet Consultations & Follow-ups.

**Request Consultation** opens booking.

The ₹500 / ₹300 amounts are shown here as information, not as buttons.

Filters: **Upcoming** (confirmed or pending), **Completed** (completed or cancelled), **All**. Default Upcoming. Status **rescheduled** exists in the data model but has no filter and no button that sets it.

Each card: service category, First Consultation or Follow-up with fee, Video Telehealth or In-Clinic Visit, status, date, time. Dietitian also sees patient name and phone.

- Confirmed **online video** with a meeting link: **Join Video Call** (opens the link in a new tab). New bookings generate a Google Meet-style URL from the patient name.  
- In-clinic: text “Nutrifacts Clinic, Suite 204” (not a map link).  
- Patient notes shown as “Session Agenda & Clinical Notes”.

Dietitian, if status is not completed:

- Pending: **Confirm Appointment**  
- Confirmed: **Mark as Completed** (writes a fixed note “Consultation finished; follow-up chart updated.”)  
- Always: **Cancel** (writes “Cancelled by clinic administration.”)

Patient has **no** cancel or reschedule button on this list.

Empty list: **Book Now (From ₹300)**.

Bottom: WhatsApp inline button with message about inquiring to book.

**Needs clarification:** Clinic physical address, video tool (Meet vs something else), whether booking should block a slot already taken, and whether the patient can cancel. Prototype booking always confirms immediately and does not check double-booking.

---

## 13. Book Consultation overlay

Opened from Home, services, appointments.

**X** closes.

After submit, a success state shows for about 1.8 seconds then the overlay closes.

Form:

1. **First Consultation (₹500)** vs **Follow-up Session (₹300)**. Default: follow-up if this patient already has any appointment in the list, otherwise first consult. User can still tap the other card.  
2. **Online Telehealth** (default) vs **In-Clinic Visit**.  
3. **Nutrition Service / Clinical Focus** dropdown: the six catalogue services plus extra options (Fatty Liver, IBS, Kidney, Cardiovascular, GERD). If opened from a service card, that title is pre-selected.  
4. **Preferred Date** — cannot pick a past day. Default is **two days from today**.  
5. **Time Slot** — 10:00–10:30, 11:00–11:30, 12:15–12:45, 16:00–16:30, 17:15–17:45, 18:30–19:00. Default 11:00–11:30.  
6. Optional health notes. If left empty, a standard first-consult or follow-up sentence is stored.

**Confirm Booking (Payable: ₹[fee])** creates the appointment as **confirmed** (not pending), does **not** collect money, and notifies the patient. The button says “Payable” but there is no payment step.

**Needs clarification:** Should confirm wait for dietitian approval (pending), and should the fee be charged here or only via packages?

---

## 14. Profile — patient

Header: photo, name, Patient badge, assigned program, enrolled since, “Supervised by Dt. Anchal Dewan”.

**Edit Health Details** / **Cancel Edit**.

View tiles: current weight, target weight, height, dietary preference.

View cards: medical conditions, allergies, primary nutrition goals (not editable in the form), next follow-up date (or a fallback date shown as a ₹300 session).

Edit form fields: age, height, current weight, target weight, dietary preference, daily water goal, medical conditions (comma-separated), allergies (comma-separated). **Cancel** or **Save Changes**. Name, email, phone, and health goals are **not** on this form.

A lock note says records are isolated to the patient and Dt. Anchal.

The screen is passed a “view receipt” callback by the app shell, but **the patient Profile UI never shows purchases or receipts**. Those live under Plans → My Purchases.

**Needs clarification:** Should Profile include contact details, password, and purchase history?

---

## 15. Profile — dietitian admin console

Header: dietitian photo, name, Dietitian Admin badge, email, phone.

KPI tiles: count of patients, diet charts, consultation sessions, intake logs. Consultation tile mentions the ₹500 / ₹300 model.

Six sub-tabs:

### 15.1 Patient Profiles & Medical Histories

Search by name, email, program, or condition.

Each row: photo, name, age, gender, height, preference, program, condition chips, weight vs target, adherence score, follow-up date.

Buttons:

- **Weekly Diet Chart** / **Create Chart** — selects that patient and goes to Diet Plans.  
- **Weight Progress** — selects that patient and goes to Progress.  
- **Assign Clinical Plan** — jumps to the Clinical Diet Plans tab with that patient pre-chosen as the assignment target.

There is no “open this patient’s Profile” because the dietitian Profile is the admin console.

### 15.2 Clinical Diet Plans (10 Conditions)

Cards for:

1. Liver Care & Fatty Liver (NAFLD) Protocol  
2. Irritable Bowel Syndrome (IBS) Protocol  
3. Therapeutic Diabetes & Glycemic Control  
4. Cardiovascular & DASH Hypertension Protocol  
5. Renal Clinical Nutrition Protocol  
6. GERD, Gastritis & Acid Reflux Protocol  
7. Hypothyroidism & Hashimoto’s Protocol  
8. Cardiovascular & Lipid Management Protocol  
9. Clinical Weight Management & Obesity Protocol  
10. PCOS & Hormonal Rebalance Protocol  

Each shows recommended macros, objectives, a short include/avoid preview, **Assign to Patient**.

Assign overlay: pick patient, protocol summary, **Cancel** or **Confirm Assignment**.

Assignment overwrites that patient’s chart title, notes, do’s, don’ts, instructions, condition category, follow-up in 14 days, and prepends a modification history line. **It keeps existing meals** (does not generate a new 7-day menu from the protocol’s sample overview). It notifies the patient. Success banner on the admin page.

**Needs clarification:** Should assignment replace meals with a condition-specific 7-day menu, or only swap guidelines as it does now?

### 15.3 Food Intake & Adherence Reports

Filters: All Logs, Full (100%), Partial, Skipped Meals.

Counts of total / full / partial / skipped across **all patients**.

Each row: patient, weekday, date, meal timing, log time, status, meal title, skip reason, notes. **View Diet Chart** selects that patient and opens Diet Plans.

### 15.4 Consultations & Schedule

Shows a “Consultations Revenue” number: (count of first-consult appointments × 500) + (count of follow-ups × 300), using **all** appointments regardless of paid or completed.

Lists every appointment. **Manage** goes to the Appointments tab (`appointments`). Status colouring in this list only treats confirmed vs everything else as amber.

### 15.5 Reminders & Notifications

Form: target patient or **Broadcast to All Patients**, category (appointment, diet, weight, water), title, message. **Send Notification Now**. Shows a short “sent” banner. These are in-app notifications only, not SMS or WhatsApp.

### 15.6 Modification History

For each diet chart, lists revision version, date, who, summary. If no revisions, “Initial baseline diet chart created on [issue date].”

---

## 16. Notifications overlay

Opened from the bell. Lists items for this user id, plus any item addressed to `all`.

Tap a row: marks it read, then:

- diet → Diet Chart  
- appointment → Appointments  
- weight → Progress  
- water or care → just closes (stays on the current screen)

**Mark all read** marks every item in this list. **X** closes without navigating.

---

## 17. What happens automatically (rules the user does not click)

- Every change is saved to the server automatically, within a moment of being made. If a save is refused or the connection drops, a red message appears and the screen reloads what the server actually holds.  
- When the person returns to the browser tab, the app refreshes from the server (so a patient sees chart updates the dietitian just made).  
- If the session has expired or was ended elsewhere, the next save sends the person to Sign in.  
- Saving a diet chart notifies that patient.  
- Uploading a PDF notifies that patient.  
- Logging weight notifies that patient.  
- Booking notifies that patient.  
- Changing appointment status notifies that patient (using whatever appointment list was in memory at click time).  
- Skipping a meal notifies the dietitian. Other intake logs notify the patient.  
- Successful package purchase notifies patient and dietitian and overwrites assigned program + follow-up date.  
- Refund notifies the patient.  
- Water glasses are capped 0–16.  
- New booking status is **confirmed**, not pending.  
- Meeting link is created only for online video.

---

## 18. What this prototype does **not** do (so we do not assume it)

These are absent in the current app. If the client wants them, they must be added as new requirements.

- OTP / phone login, self-service password reset by email, email verification  
- Forgot account, multiple dietitians, staff roles (receptionist)  
- Push, SMS, or email notifications  
- Real payment capture, failed payment, or wallet checkout  
- Paying the ₹500 / ₹300 consult fee inside booking  
- Calendar collision checks, waitlist, or reschedule by patient  
- In-app video call (only an external Meet-style link)  
- Map or directions to the clinic  
- Editing or deleting individual meals in the 7-day grid from the UI  
- Food photo upload, calorie scanning, recipe library, grocery delivery  
- Lab report file upload (lab fields exist on the patient type; the Profile form does not edit them)  
- AI / Gemini diet generation (a Gemini key is mentioned in setup files but **not used** in the screens)  
- Native iOS / Android stores — this is a website that can look like a phone

---

## 19. Open questions for the client / product owner

Please answer these so the requirements can be closed. Until then they stay out of “agreed”.

1. Production login method — **implemented: email + password.** Confirm, or add OTP on phone?  
2. Keep Android/Desktop demo switch, or only a normal responsive site?  
3. Should Appointments be on the bottom navigation?  
4. Are catalogue **services** different from paid **packages**, and which amounts are the real price list?  
5. Does booking collect money, or only packages?  
6. New bookings: instant confirm, or dietitian must accept?  
7. Real clinic address, GST, registration, and WhatsApp number for documents?  
8. Who may register a patient? — **implemented: patients sign themselves up.** Should the dietitian / front desk also be able to?  
9. Who may change medical conditions and allergies?  
10. When a clinical protocol is assigned, should meals be replaced?  
11. Print/PDF: real PDF file vs browser print vs the current text download?  
12. Dietitian printout: selected patient or logged-in user on the letterhead?  
13. Second food log for the same meal: replace or add?  
14. Patient cancel / reschedule rules?  
15. After refund, should the patient lose chart access or only see a refunded invoice?

---

*End of functional requirements. This file describes the current app, not a promise of unseen features.*
