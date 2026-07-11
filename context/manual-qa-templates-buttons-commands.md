# Manual QA: Templates, DM Buttons, Blocks, Commands

Use this checklist when verifying the templates/buttons/commands feature set in a development guild.

## DM Ticket Open Modes

| Mode | Steps | Expected |
| --- | --- | --- |
| `off` | Member DMs bot with no open ticket. | Ticket opens immediately, staff channel/post is provisioned, member receives `created`. |
| `before_open` | Configure at least one enabled DM button on `ticket-open-prompt`, member DMs bot, then clicks a `dm_open:*` button. | Initial DM is stored as pending, no ticket exists until click, click creates ticket with button label as subject and optional tag, linked template may forward to staff when enabled, pending row clears. |

## Template Button Forwarding

| Case | Steps | Expected |
| --- | --- | --- |
| Ticket-open forward on | `before_open` mode, forward setting enabled, member clicks `dm_open:*` button with linked template. | Ticket opens with button label subject, member receives `created`, linked template is sent to staff channel/post. |
| Ticket-open forward off | Same as above with forward setting disabled. | Ticket opens normally; linked template is not sent to staff. |
| Embedded button forward on | Template with embedded `msg_btn:*` buttons sent during open ticket (e.g. `created`), forward setting enabled, member clicks button. | Linked template renders in DM and is forwarded to staff channel/post. |
| Embedded button forward off | Same as above with forward setting disabled. | Linked template renders in DM only. |

## Staff Opening Profile

| Case | Steps | Expected |
| --- | --- | --- |
| Category, profile on | Enable `Show member profile on ticket open`, configure category routing, then open a ticket. | Staff channel is created, staff-only profile component is sent first, then the member's first message relay is sent. Member DM receives only the normal `created` response. |
| Category, profile off | Disable the setting and open a ticket. | Staff channel is created with only the member's first message relay. |
| Forum, profile on | Enable the setting, configure forum routing, then open a ticket. | Forum post initial message is the staff-only profile component, then the member's first message relay is sent in the thread. |
| Forum, profile off | Disable the setting and open a ticket. | Forum post initial message is the member's first message relay. |
| Profile content | Open a ticket with a member in linked guilds. | Profile shows mention, account creation, primary guild join date, previous ticket count excluding the new ticket, primary guild nickname, primary guild roles, and linked mutual servers only. |

## Blocks

| Case | Steps | Expected |
| --- | --- | --- |
| User block | Staff runs `block @user reason`, blocked member DMs bot. | Bot replies with `blocked`; no ticket is created or continued. |
| Role block | Staff runs `block @role reason`, member with role DMs bot. | Bot replies with `blocked`; no ticket is created or continued. |
| Unblock | Staff runs `unblock @user` or `unblock @role`, member DMs again. | Member can use the configured ticket-open flow. |

## Staff Commands

| Command | Steps | Expected |
| --- | --- | --- |
| `contact` | Staff runs slash or prefix command with one or more users. | One ticket is created per target without an existing open ticket; failures are summarized. |
| `logs` | Staff runs command with a user. | Response lists previous tickets with status and web links. |
| `block` / `blocked` / `unblock` | Staff runs command family. | Mutations require `MANAGE`; list requires `READ`; persisted block rows match command output. |
| `rename` | Staff runs `rename new-name` in an open ticket channel/post. | Discord channel or forum post title updates; requires `MANAGE`. |
| `about` / `help` | Staff runs command. | Bot replies with Component V2 content. |

## Web Admin

| Area | Steps | Expected |
| --- | --- | --- |
| Template override | Save valid Component V2 JSON for a system template. | Bot uses override while enabled; reset removes override and restores code default. |
| Custom template | Create a custom template, add embedded buttons, link each button to another template. | `msg_btn:*` click renders the linked template in DM; forward setting controls staff relay. |
| DM buttons | Add, disable, remove, and reorder saved buttons. | API persists ordered buttons; disabled buttons are not sent. |
| Staff opening profile toggle | Toggle `Show member profile on ticket open` and save settings. | `settings.staffTicketOpenProfile` persists; read-only staff cannot change it. |
| Read-only staff | Sign in as READ-only staff. | Template/button inputs are disabled and mutation actions hidden. |

## Channel Ticket Panel

| Case | Steps | Expected |
| --- | --- | --- |
| Text channel publish | Enable panel, pick text channel, configure `ticket-channel-panel` buttons, publish. | Panel message appears with buttons; republish edits the same message when possible. |
| Forum auto-create | Pick forum channel, leave forum post blank, publish. | Bot creates forum post with panel as starter message; thread id is stored. |
| Forum existing post | Pick forum channel and existing post, publish. | Panel message is sent or edited inside that thread. |
| Message button open | Member clicks `channel_open:*` message button. | Ticket opens, member receives `created` in DM, ephemeral guild ack, linked template forwards to staff when enabled. |
| Modal button open | Configure modal action on channel button, member submits modal. | Subject uses `subjectTemplate` with modal field vars; staff receives modal response transcript when forward enabled. |
| Subject template | Set `{{buttonLabel}}` or `{{fieldId}}` subject template on channel button. | Ticket subject in web UI matches rendered Mustache output. |
| DMs disabled | Member with closed DMs clicks panel button. | Ephemeral error; no ticket created. |
| Blocked member | Blocked user clicks panel button. | Blocked response; no ticket. |
| Forward off | Disable forward setting, open via panel button with linked template. | Ticket opens and member gets `created`; staff channel does not receive linked template. |
