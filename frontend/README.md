# Bloodline Frontend

Responsive React application for the existing Blood Donation & Request Matching API. It uses Vite, Tailwind CSS 4, React Router, and Lucide icons. It does not add another backend or database.

## Setup

```powershell
cd C:\Users\Yashas\BloodDonationSystem\frontend
npm install
Copy-Item .env.example .env  # only when .env does not already exist
npm run dev
```

Set `VITE_API_BASE_URL` to the Express API root, for example `http://localhost:5000/api`. Start MySQL, MongoDB, and the backend separately. The frontend stores the short-lived access token in `sessionStorage`; it never receives database credentials or the JWT signing secret.

## Pages and roles

- Public landing page, login, and registration for donors, hospitals, and organizations.
- Donor workspace: overview, profile, availability, location update, donation history, and personal notifications.
- Hospital workspace: profile, request creation/tracking/cancellation, donor matching, hospital inventory, and associated donation review.
- Organization workspace: profile, request creation/tracking/cancellation, and donor matching.
- Admin workspace: live summary, users, donors, requests, donations, hospital/organization directory, and inventory quantity updates.

All workspace data comes from the current backend. Routes are protected by role on the client and the API remains responsible for authorization. No unsupported donor accept/decline or partial fulfilment action is shown.

## API integration

The centralized API client is `src/services/api.js`. It attaches bearer tokens, handles JSON errors, and expires local sessions after a 401. Service modules use the backend paths and payloads documented in `backend/README.md`. Blood-group registration uses the existing ID map verified in MySQL (IDs 1–8). The matching interface passes the API’s `longitude` and `latitude` query parameters only when both are provided.

## Design and accessibility

The interface follows the cool-grey chassis and dark recessed-panel design system in the project brief. CSS variables preserve the specified colors. Host Grotesk and IBM Plex Mono are loaded with local/system fallbacks. Layouts adapt at 1100px, 760px, 390px, and 370px, tables scroll within their panels, focus states are visible, modal focus is contained, and reduced-motion preferences are honored.

## Commands

```powershell
npm run dev
npm run build
npm run preview
```

The production build was verified with `npm run build`. Browser screenshot automation was unavailable in this environment, so visual QA was limited to the responsive styles and a successful SPA server/build check.

## Backend limitations reflected in the UI

- Donor personal details are read-only because the backend has no donor-profile edit endpoint; donor availability and MongoDB location can be changed.
- Location retrieval is not exposed as a donor profile endpoint, so the location form accepts explicit coordinates without claiming to load or detect a saved location.
- The backend returns a distance rank, not a distance measurement; matches display the rank without inventing kilometres.
- Organization requests cannot deduct hospital stock because the existing API/schema does not associate an organization request with a receiving hospital.
- Donation records can be created without a hospital association and are then actionable by administrators; hospital approval requires a matching receiving-hospital reference.
- Matching results provide coordination context only. Clinical screening remains necessary.
