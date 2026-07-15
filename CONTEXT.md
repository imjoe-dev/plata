# Plata

Plata is a multi-user personal finance tracker where users log income and expenses manually, via chat, or by CSV import. An LLM guides categorization and can act on the user's behalf through tool calls.

## Language

**Chat Session**:
A persisted conversation thread between a user and the assistant, identified by an id the client mints the moment the first message is sent. Owned by exactly one user.
_Avoid_: Conversation, thread

**Chat Message**:
One turn within a Chat Session — either the user's input, or the assistant's full reply including any tool calls it made and their results. Distinct from the message format sent to the LLM provider, which is reconstructed from a Chat Message on demand and never itself persisted.
_Avoid_: Turn, prompt
