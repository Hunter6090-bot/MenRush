# menrush master agent coordination

## Project
Build the `menrush` MVP to a deployable state.

## Canonical naming
Use `menrush` for all technical naming.
Use `MenRush` only for visible UI branding.

## Primary goal
Deliver a working MVP for a location-based social / dating web app for men who want to meet men.

## MVP requirements
- auth
- profile edit
- photo upload
- interests
- location update
- nearby discovery
- likes
- mutual matches
- messaging
- safe enough MVP privacy/security
- clean deployment path

## Agent responsibilities

### backend-dev
Own backend routes, services, business logic, likes, matches, messages, and API consistency.

### db-geo
Own schema, migrations, indexes, location model, nearby query strategy, and data integrity.

### frontend-dev
Own UI completion, page wiring, discovery UX, profile UX, matches UX, messaging UX, and responsive polish.

### gemini-researcher
Own product/UX research, copy guidance, discovery recommendations, prioritisation, and risk insights.

### security-auditor
Own security/privacy review, permissions, location privacy, upload safety, and practical MVP safeguards.

## Working rules
- preserve existing good work
- do not rewrite without cause
- prefer incremental progress
- keep naming consistent
- coordinate when schema/API assumptions overlap
- document major decisions briefly
- prioritise MVP completion over perfection

## Order of execution
1. inspect repository structure
2. inspect existing backend, frontend, and database files
3. read all agent briefs in `agents/`
4. identify gaps between current state and MVP requirements
5. let each agent work in its own domain
6. resolve overlaps between schema, backend, and frontend
7. run build/tests where available
8. fix errors
9. prepare deployable MVP

## Shared deliverable
By the end, the project should support:
- user auth
- profile edit
- nearby discovery
- mutual matches
- chat
- photo upload
- basic privacy/security safeguards

## Final instruction
Coordinate all agents to finish the `menrush` MVP with minimal unnecessary questions.
