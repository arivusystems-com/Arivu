# FINAL MAILROOM IMPLEMENTATION REQUIREMENT DOCUMENT

## Enterprise Mailroom & Channel Ingestion Platform

### Status: Final Engineering Specification
### Implementation tracker: `docs/MAILROOM_ROADMAP.md` (M0–M4 ✅ email path; M5–M7 remaining)
### Audience: Engineering, Product, QA, DevOps, Architecture Teams
### Purpose: Direct Implementation Document

---

# 1. EXECUTIVE SUMMARY

The Mailroom is the centralized communication ingestion and orchestration platform for the Helpdesk ecosystem.

The Mailroom is NOT:

- just an email parser
- just a webhook receiver
- just a channel integration service

The Mailroom IS:

- a communication ingestion infrastructure
- a conversation orchestration layer
- a routing and normalization engine
- a channel abstraction platform
- a workflow trigger engine
- an event publishing system

The Mailroom acts as the entry point for all inbound customer communication.

---

# 2. BUSINESS OBJECTIVE

The Mailroom must:

- ingest all communication channels
- normalize messages into a universal format
- identify conversations
- attach communication to Cases
- create Cases when required
- publish workflow events
- support omnichannel scalability
- maintain auditability
- support SLA-driven operations

The Mailroom must support the Helpdesk philosophy defined in the canonical specification. fileciteturn0file0L1-L12

---

# 3. CORE ARCHITECTURAL PRINCIPLE

The Mailroom is NOT Case-first.

The Mailroom is:

```text
Conversation-first
```

Cases are operational execution objects.

Conversations are communication objects.

The Mailroom owns:

- communication ingestion
- communication normalization
- communication threading
- conversation continuity
- routing
- dispatching

The Cases module owns:

- SLAs
- assignments
- statuses
- escalations
- workflows
- operational accountability

---

# 4. FINAL HIGH-LEVEL ARCHITECTURE

```text
Channels
   ↓
Mailroom
   ├── Connectors Layer
   ├── Validation Layer
   ├── Parser Layer
   ├── Normalization Layer
   ├── Attachment Engine
   ├── Conversation Engine
   ├── Threading Engine
   ├── Deduplication Engine
   ├── Classification Engine
   ├── Dispatcher
   └── Event Publisher
            ↓
Cases Service
            ↓
Workflow Engine
            ↓
Notification Service
```

---

# 5. FINAL SCOPE

# Included In Scope

## Channels

- Email
- Live Chat
- Customer Portal
- Partner Portal
- API-based ingestion
- Internal manual communication

## Core Capabilities

- message ingestion
- parsing
- normalization
- threading
- duplicate detection
- conversation management
- attachment processing
- event publishing
- routing
- dispatcher integration
- case linking
- case creation
- reopen handling
- audit logging

---

# Out of Scope

- AI summarization
- voice calling
- video communication
- social listening
- predictive AI routing
- sentiment AI

---

# 6. FINAL CHANNEL REQUIREMENTS

# 6.1 Email Channel

## Mandatory Support

- IMAP ingestion
- SMTP outbound support
- webhook-based providers
- Gmail support
- Microsoft 365 support

## Email Behaviors

### Default Rule

```text
1 incoming email = 1 Case
```

As defined in the canonical Helpdesk specification. fileciteturn0file0L130-L137

---

## Reply Handling

Replies must:

- append to existing conversation
- attach to open Case
- reopen Case if required
- create new Case if threading fails

---

## Supported Email Metadata

| Metadata | Required |
|---|---|
| Message-ID | Yes |
| In-Reply-To | Yes |
| References | Yes |
| Subject | Yes |
| From | Yes |
| To | Yes |
| CC | Yes |
| BCC | Optional |
| Attachments | Yes |
| HTML body | Yes |
| Plain text body | Yes |

---

# 6.2 Live Chat Channel

Live Chat behavior must follow the Helpdesk specification. fileciteturn0file0L138-L153

## Requirements

- chat sessions exist independently
- Case creation optional
- Case creation required for unresolved issues
- chat timeline retained
- attachments retained
- chat activities appended to conversation

---

# 6.3 Customer Portal

Portal interactions must:

- create Cases
- append replies
- upload attachments
- maintain conversation continuity

---

# 6.4 Partner Portal

Partner interactions must:

- attach to assigned Cases
- support limited updates
- log all activities

---

# 6.5 API Ingestion

The Mailroom must expose APIs for:

- inbound communication creation
- message ingestion
- conversation append
- attachment upload
- event publishing

---

# 7. CONNECTORS LAYER

# Purpose

Responsible for:

- receiving communication
- validating source authenticity
- extracting raw payloads
- pushing payloads into processing queues

---

# Required Connectors

| Connector | Required |
|---|---|
| Email Connector | Yes |
| Chat Connector | Yes |
| Portal Connector | Yes |
| API Connector | Yes |

---

# Connector Responsibilities

- receive payloads
- validate signatures
- rate limiting
- authentication
- metadata extraction
- attachment extraction
- enqueue processing job

---

# 8. PROCESSING PIPELINE

## FINAL PIPELINE

```text
Receive Message
      ↓
Validate
      ↓
Store Raw Payload
      ↓
Queue Processing Job
      ↓
Parse Content
      ↓
Normalize Message
      ↓
Process Attachments
      ↓
Thread Conversation
      ↓
Detect Duplicates
      ↓
Identify/Create Conversation
      ↓
Identify/Create/Reopen Case
      ↓
Publish Events
      ↓
Dispatch Workflows
```

---

# 9. RAW PAYLOAD STORAGE

The Mailroom must store:

- raw incoming payload
- headers
- original attachments
- processing metadata

## Purpose

Required for:

- debugging
- replay
- audits
- failed processing recovery
- compliance

---

# 10. NORMALIZATION LAYER

## MOST CRITICAL COMPONENT

All channels must normalize into ONE universal schema.

---

# FINAL NORMALIZED MESSAGE SCHEMA

```json
{
  "messageId": "uuid",
  "channel": "email",
  "conversationId": "uuid",
  "externalMessageId": "external-id",
  "threadId": "thread-id",
  "direction": "inbound",
  "subject": "Issue subject",
  "body": "Normalized body",
  "htmlBody": "HTML",
  "participants": {
    "from": {},
    "to": [],
    "cc": []
  },
  "attachments": [],
  "receivedAt": "datetime",
  "metadata": {}
}
```

---

# Normalization Rules

## HTML Processing

The Mailroom must:

- sanitize HTML
- remove tracking pixels
- strip unsafe tags
- preserve formatting

---

## Signature Removal

Must support:

- email signature stripping
- reply quote stripping
- disclaimer cleanup

---

## Encoding Support

Must support:

- UTF-8
- quoted printable
- base64 encoded bodies
- multipart emails

---

# 11. CONVERSATION ENGINE

# PURPOSE

The Conversation Engine maintains communication continuity.

A Conversation is:

```text
A collection of related communication events.
```

---

# Conversation Responsibilities

- group messages
- maintain participants
- maintain timeline
- support omnichannel continuity
- support attachment history
- maintain communication context

---

# Conversation Structure

```text
Conversation
   ├── Messages
   ├── Participants
   ├── Attachments
   ├── Events
   └── Related Cases
```

---

# 12. THREADING ENGINE

# PURPOSE

Determine whether communication belongs to:

- existing conversation
- existing Case
- reopened Case
- new Case

---

# Threading Signals

| Signal | Priority |
|---|---|
| Message-ID | Critical |
| In-Reply-To | Critical |
| References | Critical |
| Thread ID | Critical |
| Sender matching | Medium |
| Subject matching | Medium |

---

# Threading Rules

## Rule 1

If matching open Case exists:

```text
Append to existing Case
```

---

## Rule 2

If recently resolved Case exists:

```text
Reopen existing Case
```

As defined in the Helpdesk specification. fileciteturn0file0L89-L96

---

## Rule 3

If no valid match exists:

```text
Create new Case
```

---

# 13. DEDUPLICATION ENGINE

# PURPOSE

Prevent duplicate Cases and duplicate communication.

---

# Duplicate Signals

| Signal | Weight |
|---|---|
| Same thread ID | Critical |
| Same external message ID | Critical |
| Same attachment hash | High |
| Same sender | Medium |
| Same subject | Medium |

---

# Duplicate Behaviors

Configurable behaviors:

- append to existing Case
- create child Case
- mark duplicate
- route for manual review

As defined in the Helpdesk specification. fileciteturn0file0L132-L137

---

# 14. ATTACHMENT ENGINE

# PURPOSE

Handle all attachment ingestion and storage.

---

# Requirements

| Capability | Required |
|---|---|
| File upload | Yes |
| Virus scanning | Yes |
| Metadata extraction | Yes |
| Secure storage | Yes |
| Signed access URLs | Yes |
| File hashing | Yes |
| Async upload processing | Yes |

---

# Storage Rules

Attachments must:

- store in object storage
- never store binary inside DB
- store metadata separately
- support versioning

---

# 15. CLASSIFICATION ENGINE

# PURPOSE

Responsible for communication classification.

---

# Required Classifications

| Classification | Required |
|---|---|
| Channel | Yes |
| Case Type | Yes |
| Priority Suggestion | Yes |
| Queue Suggestion | Yes |
| Spam Detection | Yes |

---

# 16. CASE LINKING ENGINE

# PURPOSE

The Mailroom must integrate with the Cases module.

Cases remain the operational execution system.

The Mailroom only:

- creates Cases
- appends communication
- reopens Cases
- logs activities

The Mailroom must NOT:

- manage SLAs
- manage escalations
- manage ownership logic
- manage workflows

Those belong to:

- Cases Service
- Process Designer

As defined in the canonical Helpdesk specification. fileciteturn0file0L193-L208

---

# 17. EVENT PUBLISHING

# PURPOSE

All major Mailroom actions must publish events.

---

# REQUIRED EVENTS

| Event | Required |
|---|---|
| message.received | Yes |
| message.normalized | Yes |
| conversation.created | Yes |
| conversation.updated | Yes |
| case.created | Yes |
| case.reopened | Yes |
| attachment.uploaded | Yes |
| duplicate.detected | Yes |
| processing.failed | Yes |

---

# 18. DISPATCHER REQUIREMENTS

# PURPOSE

The Dispatcher orchestrates downstream execution.

---

# Dispatcher Responsibilities

- invoke workflow engine
- notify systems
- invoke automations
- publish notifications
- trigger Process Designer

---

# 19. DATABASE REQUIREMENTS

# FINAL DATABASE MODEL

## Collections/Tables

| Collection/Table | Purpose |
|---|---|
| raw_payloads | Raw inbound data |
| conversations | Conversation container |
| messages | Normalized messages |
| participants | Communication actors |
| attachments | Attachment metadata |
| message_events | Timeline events |
| threading_logs | Threading decisions |
| routing_logs | Dispatcher logs |
| processing_failures | Error tracking |

---

# 20. SEARCH REQUIREMENTS

The Mailroom must support search across:

- subject
- sender
- participants
- body
- attachments
- conversation ID
- Case ID
- external message ID

---

# 21. SECURITY REQUIREMENTS

# Mandatory Security Controls

| Capability | Required |
|---|---|
| SPF validation | Yes |
| DKIM validation | Yes |
| DMARC validation | Yes |
| Malware scanning | Yes |
| Rate limiting | Yes |
| Attachment validation | Yes |
| Audit logging | Yes |
| Encryption at rest | Yes |
| Encryption in transit | Yes |

---

# 22. OBSERVABILITY REQUIREMENTS

# Mandatory Logging

Every processing step must log:

- timestamps
- processing duration
- routing decisions
- threading decisions
- failures
- retries
- attachment status

---

# Required Monitoring Metrics

| Metric | Required |
|---|---|
| messages per minute | Yes |
| failed ingestions | Yes |
| queue delays | Yes |
| processing latency | Yes |
| duplicate rate | Yes |
| reopen rate | Yes |

---

# 23. QUEUE & ASYNC PROCESSING REQUIREMENTS

The Mailroom MUST use async processing.

Synchronous processing is prohibited.

---

# REQUIRED QUEUES

| Queue | Purpose |
|---|---|
| ingestion_queue | Initial ingestion |
| parsing_queue | Parsing jobs |
| attachment_queue | Attachment processing |
| threading_queue | Threading logic |
| dispatch_queue | Event dispatch |
| retry_queue | Retry failed jobs |
| dead_letter_queue | Permanent failures |

---

# Retry Strategy

| Failure Count | Action |
|---|---|
| 1-3 | Retry |
| 4-5 | Escalated retry |
| >5 | Dead letter queue |

---

# 24. PERFORMANCE REQUIREMENTS

| Requirement | Target |
|---|---|
| Message ingestion acknowledgment | <1 second |
| Message normalization | <3 seconds |
| Threading decision | <2 seconds |
| Case creation | <3 seconds |
| Attachment processing | Async |

---

# 25. SCALABILITY REQUIREMENTS

The Mailroom must support:

- horizontal scaling
- distributed workers
- queue scaling
- independent connector scaling
- async processing
- large attachment volumes

---

# 26. FAILURE HANDLING REQUIREMENTS

# Mandatory Failure Behaviors

If processing fails:

- preserve raw payload
- preserve attachments
- log failure reason
- enqueue retry
- notify observability systems

No inbound communication should be permanently lost.

---

# 27. RECOMMENDED TECHNOLOGY STACK

| Layer | Recommendation |
|---|---|
| Runtime | Node.js / NestJS |
| Queue | RabbitMQ |
| Cache | Redis |
| Database | PostgreSQL + MongoDB |
| Search | OpenSearch |
| File Storage | MinIO / S3 |
| Realtime Events | WebSockets |

---

# 28. FINAL IMPLEMENTATION PRINCIPLES

# Principle 1

The Mailroom is:

```text
Conversation-first
```

NOT:

```text
Case-first
```

---

# Principle 2

Cases are operational objects.

Conversations are communication objects.

---

# Principle 3

Every channel must normalize into ONE schema.

---

# Principle 4

All processing must be asynchronous.

---

# Principle 5

The Mailroom must never directly contain SLA or escalation logic.

Those belong to:

- Cases Service
- Process Designer

---

# Principle 6

All communication must be fully auditable.

---

# 29. FINAL LOCK STATEMENT

The Mailroom is the centralized omnichannel communication ingestion and conversation orchestration platform responsible for receiving, normalizing, identifying, threading, routing, dispatching, and publishing all inbound communication events for the Helpdesk ecosystem.

The Mailroom operates as a conversation-first infrastructure layer while the Cases module remains the operational execution layer responsible for SLAs, ownership, escalations, workflows, and service accountability.

All inbound communication must pass through the Mailroom before entering operational systems.

