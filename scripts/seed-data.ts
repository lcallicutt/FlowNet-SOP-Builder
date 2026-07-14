import type {
  QuickGuideContent,
  TrainingGuideContent,
  ReviewFlag,
} from "../src/db/schema";

type SectionType =
  | "purpose"
  | "scope"
  | "intended_audience"
  | "definitions"
  | "required_tools"
  | "required_access"
  | "prerequisites"
  | "roles_responsibilities"
  | "decision_points"
  | "quality_control"
  | "troubleshooting"
  | "risks_warnings"
  | "completion_criteria"
  | "related_documents"
  | "custom";

type ChecklistCategory =
  | "pre_process"
  | "action"
  | "decision"
  | "quality"
  | "completion"
  | "sign_off";

export type DemoSop = {
  projectTitle: string;
  title: string;
  status: "draft" | "in_review" | "approved" | "published" | "archived";
  department: string;
  category: string;
  processOwner: string;
  audience: string;
  tags: string[];
  transcript: { text: string; start: number; end: number }[];
  sections: {
    type: SectionType;
    title: string;
    content: string;
    reviewFlags?: ReviewFlag[];
  }[];
  steps: {
    title: string;
    instruction: string;
    expectedResult?: string;
    warning?: string;
    qualityCheckpoint?: string;
    timestamp?: number;
    reviewFlags?: ReviewFlag[];
  }[];
  checklist: { category: ChecklistCategory; text: string }[];
  quickGuide: QuickGuideContent;
  trainingGuide: TrainingGuideContent;
};

export const demoSopPackages: DemoSop[] = [
  /* ---------------------------------------------------------------- */
  /* 1. Client onboarding                                              */
  /* ---------------------------------------------------------------- */
  {
    projectTitle: "New client onboarding walkthrough (Loom)",
    title: "New Client Onboarding",
    status: "published",
    department: "Client Services",
    category: "Onboarding",
    processOwner: "Maria Chen",
    audience: "Account managers",
    tags: ["onboarding", "clients", "kickoff"],
    transcript: [
      { text: "Hey team, this is how we onboard a new client after the contract is signed.", start: 0, end: 6 },
      { text: "First thing, open the CRM and change the deal stage to Closed Won.", start: 6, end: 13 },
      { text: "That triggers the welcome email automation, so double check the contact email is right before you do it.", start: 13, end: 21 },
      { text: "Then create the client folder from the template in Drive and share it with the client's main contact as a viewer.", start: 21, end: 31 },
      { text: "Next, set up the kickoff call. Use the booking link, forty five minutes, within the first week.", start: 31, end: 40 },
      { text: "After the call, fill in the onboarding brief and get the account manager to sign off in the doc.", start: 40, end: 49 },
    ],
    sections: [
      {
        type: "purpose",
        title: "Purpose",
        content:
          "Ensure every new client experiences a consistent, professional onboarding within the first week after contract signature, so that projects start with correct information and clear expectations.",
      },
      {
        type: "scope",
        title: "Scope",
        content:
          "Applies to all new retainer and project clients handled by Client Services. Does not cover renewals or upsells to existing clients.",
      },
      {
        type: "required_tools",
        title: "Required Tools and Systems",
        content: "- CRM (deal pipeline)\n- Google Drive (client folder template)\n- Scheduling tool (kickoff booking link)\n- Email",
      },
      {
        type: "required_access",
        title: "Required Access and Permissions",
        content: "- CRM seat with deal-edit rights\n- Drive access to the Client Folders shared drive\n- Booking-link admin",
      },
      {
        type: "prerequisites",
        title: "Prerequisites",
        content: "- Signed contract on file\n- Primary client contact confirmed\n- Invoice or payment method set up by Finance",
      },
      {
        type: "roles_responsibilities",
        title: "Roles and Responsibilities",
        content:
          "**Account manager** — Owns the onboarding end to end.\n\n**Operations** — Verifies CRM automation fired and folder permissions are correct.",
      },
      {
        type: "quality_control",
        title: "Quality-Control Checks",
        content: "- Welcome email delivered (check automation log)\n- Client folder shared with correct permissions (viewer, not editor)\n- Kickoff call booked within 7 days of signature",
      },
      {
        type: "risks_warnings",
        title: "Risks and Warnings",
        content: "- Changing the deal stage with a wrong contact email sends the welcome email to the wrong person.\n- Sharing the folder with editor rights exposes internal templates.",
      },
      {
        type: "completion_criteria",
        title: "Completion Criteria",
        content: "- Kickoff call held\n- Onboarding brief completed and signed off\n- Client confirmed access to the shared folder",
      },
    ],
    steps: [
      {
        title: "Verify the client contact record",
        instruction:
          "Open the client's deal in the CRM and confirm the primary contact's name and email address match the signed contract.",
        expectedResult: "Contact record matches the contract.",
        warning: "The next step emails this address automatically — fix typos now.",
        timestamp: 13,
      },
      {
        title: "Move the deal to Closed Won",
        instruction:
          "In the CRM deal view, change the pipeline stage to \"Closed Won\". This triggers the welcome email automation.",
        expectedResult: "Welcome email automation is queued (visible in the automation log).",
        qualityCheckpoint: "Confirm the automation log shows the welcome email as sent within 15 minutes.",
        timestamp: 6,
      },
      {
        title: "Create the client folder from the template",
        instruction:
          "In Drive, right-click the \"Client Folder Template\", choose Make a copy, rename it to the client's business name, and move it into Client Folders.",
        expectedResult: "A client folder exists with the standard subfolder structure.",
        timestamp: 21,
      },
      {
        title: "Share the folder with the client",
        instruction:
          "Share the folder with the client's primary contact with Viewer permission only.",
        expectedResult: "Client receives a Drive sharing notification.",
        warning: "Viewer only — internal pricing templates live in this structure.",
        timestamp: 26,
      },
      {
        title: "Book the kickoff call",
        instruction:
          "Send the 45-minute kickoff booking link to the client and make sure a slot within the next 7 days is chosen.",
        expectedResult: "Kickoff call appears on the team calendar.",
        timestamp: 31,
      },
      {
        title: "Complete the onboarding brief",
        instruction:
          "During or immediately after the kickoff call, complete the onboarding brief in the client folder, then request the account manager's sign-off in the document.",
        expectedResult: "Brief is complete and signed off.",
        qualityCheckpoint: "Operations spot-checks one onboarding brief per week.",
        timestamp: 40,
        reviewFlags: ["unclear_completion_criteria"],
      },
    ],
    checklist: [
      { category: "pre_process", text: "Signed contract on file" },
      { category: "pre_process", text: "Primary contact email verified against contract" },
      { category: "action", text: "Deal moved to Closed Won" },
      { category: "action", text: "Client folder created from template and renamed" },
      { category: "action", text: "Folder shared with client (Viewer)" },
      { category: "action", text: "Kickoff call booked within 7 days" },
      { category: "quality", text: "Welcome email confirmed sent in automation log" },
      { category: "completion", text: "Onboarding brief completed and signed off" },
      { category: "sign_off", text: "Account manager sign-off (name + date)" },
    ],
    quickGuide: {
      objective: "Onboard a new client within one week of contract signature.",
      requiredTools: ["CRM", "Google Drive", "Booking link"],
      keySteps: [
        { title: "Verify contact", summary: "Match CRM contact to the contract before anything fires." },
        { title: "Closed Won", summary: "Stage change triggers the welcome email." },
        { title: "Folder + share", summary: "Copy template, rename, share as Viewer." },
        { title: "Kickoff", summary: "Book 45 minutes within 7 days." },
        { title: "Brief", summary: "Complete and get sign-off after the call." },
      ],
      warnings: ["Wrong contact email = welcome email to the wrong person", "Never share the folder with Editor rights"],
      commonErrors: ["Forgetting to rename the copied folder", "Booking the kickoff outside the first week"],
      escalationContact: "Client Services lead",
      completionConfirmation: "Kickoff held, brief signed off, client has folder access.",
    },
    trainingGuide: {
      learningObjective: "Run a complete client onboarding independently.",
      processOverview:
        "Onboarding turns a signed contract into an active engagement: CRM housekeeping triggers the welcome automation, the document workspace is prepared, and a kickoff call aligns both sides within the first week.",
      keyTerminology: [
        { term: "Closed Won", definition: "CRM stage meaning the deal is signed; triggers automations." },
        { term: "Onboarding brief", definition: "The structured intake document completed at kickoff." },
      ],
      walkthrough: [
        {
          step: "Verify the contact record",
          detail: "Compare CRM contact to the contract signature block.",
          whyItMatters: "The welcome automation emails this address the moment the stage changes.",
        },
        {
          step: "Trigger Closed Won",
          detail: "Change the pipeline stage and watch the automation log.",
          whyItMatters: "This is the system-of-record moment — reporting, billing, and automation all key off it.",
        },
        {
          step: "Prepare and share the folder",
          detail: "Copy the template, rename, share as Viewer.",
          whyItMatters: "Clients get a consistent structure; Viewer permission protects internal assets.",
        },
        {
          step: "Kickoff and brief",
          detail: "Book within 7 days, complete the brief, get sign-off.",
          whyItMatters: "The brief is the single source of truth the delivery team works from.",
        },
      ],
      practiceExercise:
        "Using the sandbox CRM deal \"Acme Test\", run the full onboarding: verify the contact, move to Closed Won, create and share a folder from the template to your own personal email, and complete a practice brief.",
      knowledgeChecks: [
        { question: "What fires automatically when a deal moves to Closed Won?", answer: "The welcome email automation to the primary contact." },
        { question: "What permission level does the client get on the folder?", answer: "Viewer." },
        { question: "What is the deadline for the kickoff call?", answer: "Within 7 days of contract signature." },
      ],
      commonMistakes: ["Changing the stage before verifying the contact email", "Sharing with Editor permission"],
      supervisorReview:
        "Supervisor verifies one live onboarding: automation log entry, folder permissions, kickoff date, and signed brief.",
    },
  },

  /* ---------------------------------------------------------------- */
  /* 2. Weekly social-media scheduling                                 */
  /* ---------------------------------------------------------------- */
  {
    projectTitle: "Weekly social scheduling screen recording",
    title: "Weekly Social-Media Scheduling",
    status: "approved",
    department: "Marketing",
    category: "Content Operations",
    processOwner: "Jordan Blake",
    audience: "Marketing coordinators",
    tags: ["social", "scheduling", "weekly"],
    transcript: [
      { text: "Every Friday we schedule the next week's social posts, here's the whole flow.", start: 0, end: 6 },
      { text: "Open the content calendar sheet and filter to next week's row group.", start: 6, end: 12 },
      { text: "Check each post has final copy and an approved image, anything missing goes back to the writer.", start: 12, end: 20 },
      { text: "Then in the scheduler, create each post, paste the copy, upload the image, set the date and the usual time slots.", start: 20, end: 30 },
      { text: "Tag each post with the campaign code so analytics stays clean.", start: 30, end: 36 },
      { text: "Last, mark the row as scheduled in the sheet and drop a note in the marketing channel.", start: 36, end: 43 },
    ],
    sections: [
      {
        type: "purpose",
        title: "Purpose",
        content: "Publish a consistent weekly social cadence with approved copy and imagery, scheduled every Friday for the following week.",
      },
      {
        type: "scope",
        title: "Scope",
        content: "Covers organic posts on the company's primary social accounts. Paid campaigns follow the Paid Media SOP.",
      },
      {
        type: "required_tools",
        title: "Required Tools and Systems",
        content: "- Content calendar spreadsheet\n- Social scheduling platform\n- Brand asset library",
      },
      {
        type: "prerequisites",
        title: "Prerequisites",
        content: "- Copy approved by the content lead\n- Images exported from the brand asset library",
      },
      {
        type: "decision_points",
        title: "Decision Points",
        content:
          "**Is the post complete (copy + approved image)?**\n- If yes: schedule it.\n- If no: return it to the writer with a comment and exclude it from this week's batch.",
      },
      {
        type: "quality_control",
        title: "Quality-Control Checks",
        content: "- Every scheduled post carries the campaign tag\n- Time slots match the posting calendar\n- No post scheduled without an approved image",
      },
      {
        type: "completion_criteria",
        title: "Completion Criteria",
        content: "- All complete posts for next week are scheduled\n- Calendar rows marked \"Scheduled\"\n- Summary note posted in the marketing channel",
      },
    ],
    steps: [
      {
        title: "Open next week's content calendar",
        instruction: "Open the content calendar sheet and filter the view to next week's date range.",
        expectedResult: "Only next week's planned posts are visible.",
        timestamp: 6,
      },
      {
        title: "Audit each post for completeness",
        instruction:
          "For each row, confirm final copy is present and the image cell links to an approved asset. Return incomplete rows to the writer with a comment.",
        expectedResult: "Every remaining row is complete and ready to schedule.",
        timestamp: 12,
      },
      {
        title: "Create the posts in the scheduler",
        instruction:
          "For each complete row: create a new post, paste the copy exactly, upload the linked image, and set the scheduled date with the standard time slot.",
        expectedResult: "Each post appears in the scheduler's upcoming queue.",
        warning: "Don't retype copy — paste it, so approved wording isn't accidentally changed.",
        timestamp: 20,
      },
      {
        title: "Apply campaign tags",
        instruction: "Tag every post with the campaign code from the calendar row (e.g. SPRING24).",
        expectedResult: "Posts show the campaign tag in the scheduler.",
        qualityCheckpoint: "Spot-check three scheduled posts for correct tags.",
        timestamp: 30,
        reviewFlags: ["needs_confirmation"],
      },
      {
        title: "Mark rows scheduled and notify the team",
        instruction:
          "Set each scheduled row's status to \"Scheduled\" and post a short summary (count + campaigns) in the marketing channel.",
        expectedResult: "Calendar reflects reality; team is informed.",
        timestamp: 36,
      },
    ],
    checklist: [
      { category: "pre_process", text: "Calendar filtered to next week" },
      { category: "decision", text: "Incomplete posts returned to writers" },
      { category: "action", text: "All complete posts created in the scheduler" },
      { category: "action", text: "Campaign tags applied" },
      { category: "quality", text: "Three posts spot-checked (copy, image, tag, time)" },
      { category: "completion", text: "Calendar rows marked Scheduled" },
      { category: "completion", text: "Summary posted in marketing channel" },
      { category: "sign_off", text: "Coordinator sign-off" },
    ],
    quickGuide: {
      objective: "Schedule next week's social posts every Friday.",
      requiredTools: ["Content calendar", "Scheduler", "Asset library"],
      keySteps: [
        { title: "Filter", summary: "Calendar → next week only." },
        { title: "Audit", summary: "Copy + approved image, or back to writer." },
        { title: "Schedule", summary: "Paste copy, upload image, standard slots." },
        { title: "Tag", summary: "Campaign code on every post." },
        { title: "Close out", summary: "Mark rows Scheduled + notify channel." },
      ],
      warnings: ["Never retype approved copy", "No post without an approved image"],
      commonErrors: ["Missing campaign tags (breaks analytics)", "Wrong time zone on slots"],
      escalationContact: "Marketing coordinator lead",
      completionConfirmation: "Scheduler queue matches the calendar and the channel note is posted.",
    },
    trainingGuide: {
      learningObjective: "Run the Friday scheduling batch without supervision.",
      processOverview:
        "The weekly batch converts the planned calendar into scheduled posts, with a completeness audit protecting quality and campaign tags protecting analytics.",
      keyTerminology: [
        { term: "Campaign code", definition: "Short identifier (e.g. SPRING24) linking posts to campaign analytics." },
        { term: "Standard slots", definition: "The pre-agreed posting times per platform." },
      ],
      walkthrough: [
        { step: "Filter the calendar", detail: "Next week only.", whyItMatters: "Prevents double-scheduling posts from other weeks." },
        { step: "Audit completeness", detail: "Copy + approved image per row.", whyItMatters: "Half-finished posts published to the brand account are the worst failure mode." },
        { step: "Schedule and tag", detail: "Paste, upload, slot, tag.", whyItMatters: "Tags are how leadership sees campaign performance." },
        { step: "Close out", detail: "Statuses + channel note.", whyItMatters: "The calendar is only trustworthy if it reflects the scheduler." },
      ],
      practiceExercise: "Schedule three posts from the practice calendar tab into the scheduler's draft mode (do not publish).",
      knowledgeChecks: [
        { question: "What do you do with a post missing its image?", answer: "Return it to the writer with a comment; exclude it from the batch." },
        { question: "Why paste rather than retype copy?", answer: "The copy was approved as written; retyping introduces errors." },
      ],
      commonMistakes: ["Scheduling incomplete posts", "Forgetting the closing channel note"],
      supervisorReview: "Review one full Friday batch: audit trail, tags, slots, and the closing note.",
    },
  },

  /* ---------------------------------------------------------------- */
  /* 3. Customer refund processing                                     */
  /* ---------------------------------------------------------------- */
  {
    projectTitle: "Refund processing demo recording",
    title: "Customer Refund Processing",
    status: "in_review",
    department: "Support",
    category: "Billing",
    processOwner: "Sam Okafor",
    audience: "Support agents",
    tags: ["refunds", "billing", "support"],
    transcript: [
      { text: "This is how we process a standard refund request.", start: 0, end: 4 },
      { text: "Verify the customer by matching their email to the account and asking for the order number.", start: 4, end: 12 },
      { text: "Check the purchase date, within thirty days we refund in full, past that it goes to a manager.", start: 12, end: 21 },
      { text: "In the billing portal, find the invoice, hit refund, and pick the original payment method.", start: 21, end: 30 },
      { text: "Anything over five hundred dollars needs manager approval first, don't skip that.", start: 30, end: 37 },
      { text: "Then log it in the CRM with the refund reason code and send the confirmation macro.", start: 37, end: 45 },
    ],
    sections: [
      {
        type: "purpose",
        title: "Purpose",
        content: "Process customer refunds accurately, within policy, and with a complete audit trail.",
      },
      {
        type: "scope",
        title: "Scope",
        content: "Standard product refunds requested by the customer. Chargebacks and disputes follow the Disputes SOP.",
      },
      {
        type: "required_access",
        title: "Required Access and Permissions",
        content: "- Billing portal with refund permission\n- CRM agent seat",
      },
      {
        type: "decision_points",
        title: "Decision Points",
        content:
          "**Is the purchase within 30 days?**\n- If yes: full refund to the original payment method.\n- If no: escalate to a manager.\n\n**Is the amount over $500?**\n- If yes: obtain manager approval before refunding.\n- If no: proceed.",
      },
      {
        type: "quality_control",
        title: "Quality-Control Checks",
        content: "- Refund appears on the invoice ledger\n- CRM case carries the correct reason code\n- Confirmation email sent",
      },
      {
        type: "risks_warnings",
        title: "Risks and Warnings",
        content: "- Refunding to a different payment method can constitute fraud exposure.\n- Skipping manager approval on large refunds violates finance policy.",
        reviewFlags: ["potential_security_concern"],
      },
      {
        type: "completion_criteria",
        title: "Completion Criteria",
        content: "- Refund visible in the ledger\n- CRM case closed with reason code\n- Customer confirmation sent",
      },
      {
        type: "custom",
        title: "Open Questions for Review",
        content: "- **Refund limit** (needs confirmation): The recording implies a $500 approval threshold but doesn't state whether it applies per order or per customer per month.",
        reviewFlags: ["needs_confirmation"],
      },
    ],
    steps: [
      {
        title: "Verify the customer",
        instruction: "Match the requester's email to the account and confirm the order number they provide.",
        expectedResult: "Identity confirmed against the account record.",
        warning: "Never process refunds for requests that fail verification — escalate instead.",
        timestamp: 4,
      },
      {
        title: "Check refund eligibility",
        instruction: "Compare the purchase date with today. Within 30 days: proceed. Older: escalate to a manager.",
        expectedResult: "Eligibility decision recorded in the case.",
        timestamp: 12,
      },
      {
        title: "Obtain approval for large refunds",
        instruction: "If the refund exceeds $500, request manager approval in the approvals channel and wait for a thumbs-up before continuing.",
        expectedResult: "Approval message linked in the CRM case.",
        warning: "Do not proceed on verbal approval only.",
        timestamp: 30,
        reviewFlags: ["needs_confirmation"],
      },
      {
        title: "Issue the refund",
        instruction: "In the billing portal, open the invoice, choose Refund, select the original payment method, and confirm.",
        expectedResult: "Portal shows the refund as processed.",
        qualityCheckpoint: "Verify the refund line appears on the invoice ledger.",
        timestamp: 21,
      },
      {
        title: "Log and confirm",
        instruction: "Add the refund reason code to the CRM case and send the refund-confirmation macro to the customer, then close the case.",
        expectedResult: "Case closed; customer notified.",
        timestamp: 37,
      },
    ],
    checklist: [
      { category: "pre_process", text: "Customer identity verified" },
      { category: "decision", text: "Purchase within 30 days (else escalated)" },
      { category: "decision", text: "Manager approval obtained for refunds over $500" },
      { category: "action", text: "Refund issued to the original payment method" },
      { category: "quality", text: "Refund visible on invoice ledger" },
      { category: "action", text: "CRM case logged with reason code" },
      { category: "completion", text: "Confirmation email sent, case closed" },
      { category: "sign_off", text: "Agent sign-off" },
    ],
    quickGuide: {
      objective: "Refund an eligible customer safely and completely.",
      requiredTools: ["Billing portal", "CRM"],
      keySteps: [
        { title: "Verify", summary: "Email + order number against the account." },
        { title: "Eligibility", summary: "≤30 days full refund; older → manager." },
        { title: "Approval", summary: ">$500 needs written manager approval." },
        { title: "Refund", summary: "Original payment method only." },
        { title: "Log", summary: "Reason code + confirmation macro." },
      ],
      warnings: ["Original payment method only", "No verbal-only approvals"],
      commonErrors: ["Wrong invoice refunded", "Missing reason code"],
      escalationContact: "Support team lead",
      completionConfirmation: "Ledger shows the refund and the CRM case is closed with a reason code.",
    },
    trainingGuide: {
      learningObjective: "Process standard refunds within policy, end to end.",
      processOverview:
        "Refunds combine identity verification, a policy decision (age and amount), the billing action itself, and an audit trail in the CRM.",
      keyTerminology: [
        { term: "Reason code", definition: "Standardized refund cause used for reporting." },
        { term: "Original payment method", definition: "The card/account used for the purchase — the only allowed refund destination." },
      ],
      walkthrough: [
        { step: "Verify", detail: "Email + order number.", whyItMatters: "Refund fraud almost always starts with failed verification being skipped." },
        { step: "Decide", detail: "30-day window; $500 threshold.", whyItMatters: "These are finance policy lines, not suggestions." },
        { step: "Refund", detail: "Portal → invoice → refund → original method.", whyItMatters: "Wrong destinations create fraud exposure." },
        { step: "Log", detail: "Reason code + macro + close.", whyItMatters: "Reporting and dispute defense rely on the trail." },
      ],
      practiceExercise: "In the billing sandbox, process a refund for test order #TEST-1042 including the CRM log entry.",
      knowledgeChecks: [
        { question: "A refund request is 45 days old — what do you do?", answer: "Escalate to a manager; don't refund it yourself." },
        { question: "Where must a large-refund approval live?", answer: "Written in the approvals channel and linked in the CRM case." },
      ],
      commonMistakes: ["Verbal approvals", "Refunding to a new card"],
      supervisorReview: "Observe two live refunds: verification, decisions, ledger check, and CRM trail.",
    },
  },

  /* ---------------------------------------------------------------- */
  /* 4. Church event publishing                                        */
  /* ---------------------------------------------------------------- */
  {
    projectTitle: "How we publish church events (screen share)",
    title: "Church Event Publishing",
    status: "draft",
    department: "Communications",
    category: "Events",
    processOwner: "Pastor Dave Miller",
    audience: "Communications volunteers",
    tags: ["events", "church", "communications"],
    transcript: [
      { text: "Here's how we get an event from the request form onto everything people actually see.", start: 0, end: 7 },
      { text: "Check the submissions inbox on Monday, every event needs a name, date, location, and a contact person.", start: 7, end: 16 },
      { text: "Get pastoral approval for anything new, recurring ministries are pre-approved.", start: 16, end: 23 },
      { text: "Add it to the church calendar first, that's the source of truth.", start: 23, end: 29 },
      { text: "Then the website events page, the Sunday bulletin if it's within two weeks, and social media.", start: 29, end: 38 },
      { text: "Big events also get a slide for the lobby screen, ask the design volunteer for that.", start: 38, end: 45 },
    ],
    sections: [
      {
        type: "purpose",
        title: "Purpose",
        content: "Publish church events consistently across the calendar, website, bulletin, and social channels so the congregation never misses an event.",
      },
      {
        type: "scope",
        title: "Scope",
        content: "All congregation-facing events submitted through the event request form. Internal staff meetings are excluded.",
      },
      {
        type: "prerequisites",
        title: "Prerequisites",
        content: "- Event request contains: name, date/time, location, contact person\n- Pastoral approval for new (non-recurring) events",
      },
      {
        type: "roles_responsibilities",
        title: "Roles and Responsibilities",
        content:
          "**Communications volunteer** — Reviews submissions and publishes across channels.\n\n**Pastor** — Approves new events.\n\n**Design volunteer** — Produces lobby-screen slides for major events.",
      },
      {
        type: "decision_points",
        title: "Decision Points",
        content:
          "**Is the event new or a recurring ministry?**\n- Recurring: pre-approved, publish directly.\n- New: request pastoral approval first.\n\n**Is the event within the next two weeks?**\n- Yes: include it in the Sunday bulletin.\n- No: calendar/website/social only, bulletin later.",
      },
      {
        type: "quality_control",
        title: "Quality-Control Checks",
        content: "- Calendar entry matches the request exactly (date, time, room)\n- Website listing links to the correct contact\n- Bulletin deadline (Thursday noon) respected",
      },
      {
        type: "completion_criteria",
        title: "Completion Criteria",
        content: "- Event visible on calendar and website\n- Bulletin inclusion confirmed when applicable\n- Requester notified that publishing is complete",
      },
    ],
    steps: [
      {
        title: "Review the submissions inbox",
        instruction: "Every Monday, open the event submissions inbox and list new requests. Reject incomplete submissions back to the requester with what's missing.",
        expectedResult: "A list of complete, publishable event requests.",
        timestamp: 7,
      },
      {
        title: "Confirm approval status",
        instruction: "For new events, forward the request to the pastor for approval and wait for written confirmation. Recurring ministry events are pre-approved.",
        expectedResult: "Approval recorded (email or note) for every new event.",
        timestamp: 16,
        reviewFlags: ["unclear_responsibility"],
      },
      {
        title: "Add the event to the church calendar",
        instruction: "Create the calendar entry with the exact name, date/time, location, and contact from the request. The calendar is the source of truth for every other channel.",
        expectedResult: "Calendar entry created and correct.",
        qualityCheckpoint: "Re-read date, time, and room against the original request.",
        timestamp: 23,
      },
      {
        title: "Publish to the website events page",
        instruction: "Add the event to the website events page using the calendar entry's details, including the contact person.",
        expectedResult: "Event appears on the public events page.",
        timestamp: 29,
      },
      {
        title: "Submit to the bulletin when applicable",
        instruction: "If the event happens within the next two weeks, submit the blurb to the bulletin editor before Thursday noon.",
        expectedResult: "Bulletin editor confirms inclusion.",
        warning: "Bulletin copy submitted after Thursday noon will miss Sunday.",
        timestamp: 33,
      },
      {
        title: "Post to social media and request a lobby slide",
        instruction: "Create the social post from the standard event template. For major events, request a lobby-screen slide from the design volunteer.",
        expectedResult: "Social post scheduled; slide requested when applicable.",
        timestamp: 38,
        reviewFlags: ["missing_information"],
      },
    ],
    checklist: [
      { category: "pre_process", text: "Submission complete (name, date, location, contact)" },
      { category: "decision", text: "New event approved by pastor (or recurring/pre-approved)" },
      { category: "action", text: "Calendar entry created" },
      { category: "action", text: "Website events page updated" },
      { category: "decision", text: "Within two weeks → bulletin submitted by Thursday noon" },
      { category: "action", text: "Social post scheduled" },
      { category: "quality", text: "Calendar entry re-checked against the request" },
      { category: "completion", text: "Requester notified of publication" },
      { category: "sign_off", text: "Volunteer sign-off" },
    ],
    quickGuide: {
      objective: "Get an approved event onto every congregation-facing channel.",
      requiredTools: ["Submissions inbox", "Church calendar", "Website CMS", "Social accounts"],
      keySteps: [
        { title: "Review", summary: "Monday inbox sweep; bounce incomplete requests." },
        { title: "Approve", summary: "New events need the pastor's written OK." },
        { title: "Calendar", summary: "Source of truth — enter it first, exactly." },
        { title: "Fan out", summary: "Website, bulletin (≤2 weeks), social, lobby slide." },
      ],
      warnings: ["Bulletin deadline is Thursday noon", "Calendar first — everything else copies from it"],
      commonErrors: ["Publishing before approval", "Room conflicts from unchecked calendar entries"],
      escalationContact: "Communications team lead",
      completionConfirmation: "Event visible on calendar + website; requester notified.",
    },
    trainingGuide: {
      learningObjective: "Publish church events across all channels without misses.",
      processOverview:
        "Events flow from the request form through approval into the calendar (the single source of truth), then fan out to website, bulletin, social, and lobby screens.",
      keyTerminology: [
        { term: "Recurring ministry", definition: "A pre-approved regular event (e.g. weekly youth group)." },
        { term: "Bulletin deadline", definition: "Thursday noon for the following Sunday's bulletin." },
      ],
      walkthrough: [
        { step: "Inbox review", detail: "Completeness check on Mondays.", whyItMatters: "Incomplete listings cause day-of confusion for attendees." },
        { step: "Approval", detail: "Written pastoral OK for new events.", whyItMatters: "Protects the church calendar from conflicts and misaligned events." },
        { step: "Calendar first", detail: "Exact details, before any other channel.", whyItMatters: "Every other channel copies the calendar — errors multiply." },
        { step: "Fan out", detail: "Website, bulletin, social, slides.", whyItMatters: "Different members rely on different channels." },
      ],
      practiceExercise: "Publish the sample \"Spring Picnic\" request through the whole flow using the test calendar and a draft social post.",
      knowledgeChecks: [
        { question: "Which channel do you update first, and why?", answer: "The church calendar — it's the source of truth the other channels copy." },
        { question: "When must bulletin copy be in?", answer: "Thursday noon for that Sunday." },
      ],
      commonMistakes: ["Skipping approval for \"small\" events", "Missing the bulletin deadline"],
      supervisorReview: "Review one published event across all channels for consistency with the original request.",
    },
  },
];
