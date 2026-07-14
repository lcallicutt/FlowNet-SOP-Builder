import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const memberStatusEnum = pgEnum("member_status", ["pending", "active"]);

export const planEnum = pgEnum("plan", ["starter", "professional", "business"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const usageTypeEnum = pgEnum("usage_type", [
  "transcription_seconds",
  "ai_generation",
  "storage_bytes",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "transcript_ready",
  "analyzing_process",
  "generating_documentation",
  "ready_for_review",
  "published",
  "failed",
]);

export const detailLevelEnum = pgEnum("detail_level", [
  "concise",
  "standard",
  "detailed",
  "training_level",
]);

export const sourceTypeEnum = pgEnum("source_type", ["upload", "loom_url"]);

export const fileKindEnum = pgEnum("file_kind", [
  "source_video",
  "source_audio",
  "extracted_audio",
  "audio_segment",
  "screenshot",
  "export",
  "workspace_logo",
]);

export const fileStatusEnum = pgEnum("file_status", [
  "pending_upload",
  "uploaded",
  "deleted",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "extract_audio",
  "transcribe",
  "analyze_process",
  "generate_documents",
  "import_loom",
  "export_document",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "retrying",
  "completed",
  "failed",
  "cancelled",
]);

export const transcriptStatusEnum = pgEnum("transcript_status", [
  "processing",
  "ready",
  "edited",
  "failed",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
]);

export const sectionTypeEnum = pgEnum("section_type", [
  "purpose",
  "scope",
  "intended_audience",
  "definitions",
  "required_tools",
  "required_access",
  "prerequisites",
  "roles_responsibilities",
  "decision_points",
  "quality_control",
  "troubleshooting",
  "risks_warnings",
  "completion_criteria",
  "related_documents",
  "custom",
]);

export const checklistCategoryEnum = pgEnum("checklist_category", [
  "pre_process",
  "action",
  "decision",
  "quality",
  "completion",
  "sign_off",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * Review labels attached by the AI when information is uncertain, missing,
 * or sensitive. Stored in jsonb arrays on steps/sections.
 */
export const REVIEW_FLAGS = [
  "needs_confirmation",
  "inferred_from_recording",
  "missing_information",
  "potential_security_concern",
  "unclear_responsibility",
  "unclear_completion_criteria",
] as const;
export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Identity & workspaces                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    imageUrl: text("image_url"),
    /** Platform-level administrator (internal admin dashboard access). */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_clerk_id_idx").on(t.clerkId),
    index("users_email_idx").on(t.email),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoFileId: uuid("logo_file_id"),
    brandColor: text("brand_color"),
    /** Sequence used to assign SOP identification numbers (SOP-001, ...). */
    sopCounter: integer("sop_counter").notNull().default(0),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("workspaces_slug_idx").on(t.slug)],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Null while the invitation is pending for a user who has not signed up. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    role: workspaceRoleEnum("role").notNull().default("viewer"),
    status: memberStatusEnum("status").notNull().default("active"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("workspace_members_ws_user_idx").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
    index("workspace_members_invited_email_idx").on(t.invitedEmail),
  ],
);

/* ------------------------------------------------------------------ */
/* Billing & usage                                                     */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull().default("starter"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("subscriptions_workspace_idx").on(t.workspaceId),
    index("subscriptions_stripe_customer_idx").on(t.stripeCustomerId),
  ],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    type: usageTypeEnum("type").notNull(),
    /** Quantity in the unit implied by `type` (seconds, generations, bytes). */
    quantity: real("quantity").notNull(),
    /** Billing period bucket in YYYY-MM (UTC) for fast monthly aggregation. */
    period: text("period").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("usage_records_ws_period_idx").on(t.workspaceId, t.period, t.type),
  ],
);

/* ------------------------------------------------------------------ */
/* Projects & processing                                               */
/* ------------------------------------------------------------------ */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    department: text("department"),
    processCategory: text("process_category"),
    processOwner: text("process_owner"),
    intendedAudience: text("intended_audience"),
    description: text("description"),
    companyTerminology: text("company_terminology"),
    detailLevel: detailLevelEnum("detail_level").notNull().default("standard"),
    language: text("language").notNull().default("en"),
    sourceType: sourceTypeEnum("source_type").notNull().default("upload"),
    loomUrl: text("loom_url"),
    status: projectStatusEnum("status").notNull().default("uploaded"),
    /** 0-100 coarse progress for the processing pipeline UI. */
    progressPercent: integer("progress_percent").notNull().default(0),
    /** User-safe error message when status = failed. */
    errorMessage: text("error_message"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("projects_workspace_idx").on(t.workspaceId),
    index("projects_status_idx").on(t.status),
  ],
);

export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    kind: fileKindEnum("kind").notNull(),
    status: fileStatusEnum("status").notNull().default("pending_upload"),
    /** Object key inside the S3-compatible bucket. Never a public URL. */
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes"),
    durationSeconds: real("duration_seconds"),
    /** For audio_segment files: position within the parent audio. */
    segmentIndex: integer("segment_index"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uploaded_files_storage_key_idx").on(t.storageKey),
    index("uploaded_files_project_idx").on(t.projectId),
    index("uploaded_files_workspace_idx").on(t.workspaceId),
  ],
);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    /** Inngest run id for cross-referencing the queue dashboard. */
    externalRunId: text("external_run_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    /** Internal error detail — never shown to end users verbatim. */
    errorDetail: text("error_detail"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("processing_jobs_project_idx").on(t.projectId),
    index("processing_jobs_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Transcripts                                                         */
/* ------------------------------------------------------------------ */

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: transcriptStatusEnum("status").notNull().default("processing"),
    language: text("language"),
    /** Denormalized full text for search; source of truth is the segments. */
    fullText: text("full_text"),
    wordCount: integer("word_count"),
    durationSeconds: real("duration_seconds"),
    ...timestamps,
  },
  (t) => [index("transcripts_project_idx").on(t.projectId)],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    transcriptId: uuid("transcript_id")
      .notNull()
      .references(() => transcripts.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    /** Optional speaker label; speaker identification is not mandatory. */
    speaker: text("speaker"),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [
    index("transcript_segments_transcript_idx").on(
      t.transcriptId,
      t.segmentIndex,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* SOP documents & content                                             */
/* ------------------------------------------------------------------ */

export const sopDocuments = pgTable(
  "sop_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    /** Human-readable SOP identification number, e.g. SOP-014. */
    sopNumber: text("sop_number").notNull(),
    title: text("title").notNull(),
    status: documentStatusEnum("status").notNull().default("draft"),
    versionNumber: integer("version_number").notNull().default(1),
    department: text("department"),
    processCategory: text("process_category"),
    processOwner: text("process_owner"),
    intendedAudience: text("intended_audience"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    reviewDate: timestamp("review_date", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("sop_documents_workspace_idx").on(t.workspaceId),
    index("sop_documents_status_idx").on(t.status),
    uniqueIndex("sop_documents_ws_number_idx").on(t.workspaceId, t.sopNumber),
  ],
);

export const documentSections = pgTable(
  "document_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    type: sectionTypeEnum("type").notNull(),
    title: text("title").notNull(),
    /** Markdown body of the section. */
    content: text("content").notNull().default(""),
    position: integer("position").notNull().default(0),
    /** AI review labels (ReviewFlag[]) awaiting human resolution. */
    reviewFlags: jsonb("review_flags").$type<ReviewFlag[]>().notNull().default([]),
    flagsResolvedAt: timestamp("flags_resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("document_sections_doc_idx").on(t.sopDocumentId, t.position),
  ],
);

export const procedureSteps = pgTable(
  "procedure_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    expectedResult: text("expected_result"),
    warning: text("warning"),
    note: text("note"),
    qualityCheckpoint: text("quality_checkpoint"),
    /** Position in the source video, in seconds. Enables later frame capture. */
    videoTimestampSeconds: real("video_timestamp_seconds"),
    reviewFlags: jsonb("review_flags").$type<ReviewFlag[]>().notNull().default([]),
    flagsResolvedAt: timestamp("flags_resolved_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("procedure_steps_doc_idx").on(t.sopDocumentId, t.position)],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    category: checklistCategoryEnum("category").notNull().default("action"),
    text: text("text").notNull(),
    isChecked: boolean("is_checked").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("checklist_items_doc_idx").on(t.sopDocumentId, t.position)],
);

export type QuickGuideContent = {
  objective: string;
  requiredTools: string[];
  keySteps: { title: string; summary: string }[];
  warnings: string[];
  commonErrors: string[];
  escalationContact: string;
  completionConfirmation: string;
};

export const quickGuides = pgTable(
  "quick_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<QuickGuideContent>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("quick_guides_doc_idx").on(t.sopDocumentId)],
);

export type TrainingGuideContent = {
  learningObjective: string;
  processOverview: string;
  keyTerminology: { term: string; definition: string }[];
  walkthrough: { step: string; detail: string; whyItMatters: string }[];
  practiceExercise: string;
  knowledgeChecks: { question: string; answer: string }[];
  commonMistakes: string[];
  supervisorReview: string;
};

export const trainingGuides = pgTable(
  "training_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<TrainingGuideContent>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("training_guides_doc_idx").on(t.sopDocumentId)],
);

/* ------------------------------------------------------------------ */
/* Versions, approvals, collaboration                                  */
/* ------------------------------------------------------------------ */

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    /** Full snapshot of the document package at the time the version was cut. */
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    revisionNotes: text("revision_notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("document_versions_doc_version_idx").on(
      t.sopDocumentId,
      t.versionNumber,
    ),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id),
    status: approvalStatusEnum("status").notNull().default("pending"),
    comments: text("comments"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("approvals_doc_idx").on(t.sopDocumentId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("comments_doc_idx").on(t.sopDocumentId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id").references(() => sopDocuments.id, {
      onDelete: "cascade",
    }),
    procedureStepId: uuid("procedure_step_id").references(
      () => procedureSteps.id,
      { onDelete: "cascade" },
    ),
    uploadedFileId: uuid("uploaded_file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "cascade" }),
    caption: text("caption"),
    /** Screenshots extracted from video must be reviewed before use. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("attachments_doc_idx").on(t.sopDocumentId),
    index("attachments_step_idx").on(t.procedureStepId),
  ],
);

export const sharedLinks = pgTable(
  "shared_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sopDocumentId: uuid("sop_document_id")
      .notNull()
      .references(() => sopDocuments.id, { onDelete: "cascade" }),
    /** URL-safe random token; the share URL is /share/<token>. */
    token: text("token").notNull(),
    requireAuth: boolean("require_auth").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("shared_links_token_idx").on(t.token),
    index("shared_links_doc_idx").on(t.sopDocumentId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** e.g. document.publish, transcript.edit, share_link.create */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_workspace_idx").on(t.workspaceId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  documents: many(sopDocuments),
  subscription: one(subscriptions, {
    fields: [workspaces.id],
    references: [subscriptions.workspaceId],
  }),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  files: many(uploadedFiles),
  jobs: many(processingJobs),
  transcripts: many(transcripts),
  documents: many(sopDocuments),
  createdBy: one(users, {
    fields: [projects.createdByUserId],
    references: [users.id],
  }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  project: one(projects, {
    fields: [uploadedFiles.projectId],
    references: [projects.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  project: one(projects, {
    fields: [processingJobs.projectId],
    references: [projects.id],
  }),
}));

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  project: one(projects, {
    fields: [transcripts.projectId],
    references: [projects.id],
  }),
  segments: many(transcriptSegments),
}));

export const transcriptSegmentsRelations = relations(
  transcriptSegments,
  ({ one }) => ({
    transcript: one(transcripts, {
      fields: [transcriptSegments.transcriptId],
      references: [transcripts.id],
    }),
  }),
);

export const sopDocumentsRelations = relations(
  sopDocuments,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [sopDocuments.workspaceId],
      references: [workspaces.id],
    }),
    project: one(projects, {
      fields: [sopDocuments.projectId],
      references: [projects.id],
    }),
    sections: many(documentSections),
    steps: many(procedureSteps),
    checklistItems: many(checklistItems),
    quickGuide: one(quickGuides, {
      fields: [sopDocuments.id],
      references: [quickGuides.sopDocumentId],
    }),
    trainingGuide: one(trainingGuides, {
      fields: [sopDocuments.id],
      references: [trainingGuides.sopDocumentId],
    }),
    versions: many(documentVersions),
    approvals: many(approvals),
    comments: many(comments),
    attachments: many(attachments),
    sharedLinks: many(sharedLinks),
    createdBy: one(users, {
      fields: [sopDocuments.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const documentSectionsRelations = relations(
  documentSections,
  ({ one }) => ({
    document: one(sopDocuments, {
      fields: [documentSections.sopDocumentId],
      references: [sopDocuments.id],
    }),
  }),
);

export const procedureStepsRelations = relations(
  procedureSteps,
  ({ one, many }) => ({
    document: one(sopDocuments, {
      fields: [procedureSteps.sopDocumentId],
      references: [sopDocuments.id],
    }),
    attachments: many(attachments),
  }),
);

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  document: one(sopDocuments, {
    fields: [checklistItems.sopDocumentId],
    references: [sopDocuments.id],
  }),
}));

export const documentVersionsRelations = relations(
  documentVersions,
  ({ one }) => ({
    document: one(sopDocuments, {
      fields: [documentVersions.sopDocumentId],
      references: [sopDocuments.id],
    }),
    createdBy: one(users, {
      fields: [documentVersions.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const approvalsRelations = relations(approvals, ({ one }) => ({
  document: one(sopDocuments, {
    fields: [approvals.sopDocumentId],
    references: [sopDocuments.id],
  }),
  reviewer: one(users, {
    fields: [approvals.reviewerUserId],
    references: [users.id],
  }),
  requestedBy: one(users, {
    fields: [approvals.requestedByUserId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  step: one(procedureSteps, {
    fields: [attachments.procedureStepId],
    references: [procedureSteps.id],
  }),
  file: one(uploadedFiles, {
    fields: [attachments.uploadedFileId],
    references: [uploadedFiles.id],
  }),
}));

export const sharedLinksRelations = relations(sharedLinks, ({ one }) => ({
  document: one(sopDocuments, {
    fields: [sharedLinks.sopDocumentId],
    references: [sopDocuments.id],
  }),
}));
