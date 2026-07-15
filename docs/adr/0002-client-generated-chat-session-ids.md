# Client-generated chat session ids, folded into the first message

Status: accepted

A chat session doesn't exist until the first message is sent — there's no explicit "new chat" action. To navigate to `/chat/:sessionId` the instant a message is sent (matching the claude.ai/ChatGPT feel, no round-trip wait before the URL updates), the client mints the session id itself (`crypto.randomUUID()`) rather than waiting for the server to generate and return one.

We considered a two-step flow instead — client generates the id, `POST`s it to a dedicated create-session endpoint, waits for `201 Created`, then navigates and sends the first message (this is what claude.ai's own network traffic actually shows). We rejected it: it's two independent requests that can fail independently, risking an orphaned empty session if creation succeeds but the message send doesn't. Instead, session creation and the first message persist happen in the same `POST /api/chat` call — the server creates the `chat_sessions` row lazily, scoped to the caller's `user_id`, the first time it sees an unknown session id.

This means the id is client-supplied but is **never treated as authorization**. Every read/write is scoped by `user_id = requireUser(request)`; if a supplied id already belongs to a different user, the request is rejected with 404 — not a distinct 403 — so a non-owner can't distinguish "doesn't exist" from "exists but isn't yours" (see ADR-0003). Collision risk is not a practical concern — `crypto.randomUUID()` is the same UUIDv4 generation the service layer already uses server-side for every other table.

**Revisit if:** a use case needs to provision a session before the user types anything (e.g. pre-attaching files before the first prompt) — that would need the two-step flow we rejected here.
