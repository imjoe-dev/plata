# Plata

Plata is a multi-user personal finance tracker where users log income and expenses manually, via chat, or by CSV import. An LLM guides categorization and can act on the user's behalf through tool calls.

## Language

**Transaction**:
A single recorded income or expense event, with an amount, currency, date, and optional category. Logged manually, via chat, or by CSV import.

**Recurring Template**:
A definition of a Transaction that repeats on a cadence (e.g. monthly rent). Produces individual Transactions over time rather than being a Transaction itself.

**Batch Creation**:
Creating multiple Transactions, or multiple Recurring Templates, in a single user-approved action rather than one at a time.

**Chat Session**:
A persisted conversation thread between a user and the assistant, identified by an id the client mints the moment the first message is sent. Owned by exactly one user.
_Avoid_: Conversation, thread

**Chat Message**:
One turn within a Chat Session — either the user's input, or the assistant's full reply including any tool calls it made and their results. Distinct from the message format sent to the LLM provider, which is reconstructed from a Chat Message on demand and never itself persisted.
_Avoid_: Turn, prompt

**Chat Session Activity**:
The moment a Chat Message is added to a Chat Session. Activity determines a session's recency: a resumed session is as recent as its latest message, not its creation.

**History**:
The list of a user's Chat Sessions ordered by most recent Chat Session Activity, shown in the sidebar. Only sessions that exist server-side appear — a chat whose first exchange is still in flight is not yet part of History.
_Avoid_: Session list, recent chats

**Mutating Tool**:
An AI tool that creates, updates, or deletes data on the user's behalf, as opposed to a read-only tool (list/get). Every Mutating Tool requires approval before executing.
_Avoid_: Write tool, dangerous tool

**Session Approval**:
A per-Chat-Session flag that exempts non-delete Mutating Tools from per-call approval for the rest of that Chat Session.
_Avoid_: Auto-approve, trust mode, always allow
