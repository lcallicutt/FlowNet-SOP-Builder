import { EventSchemas, Inngest } from "inngest";

/**
 * Inngest client + typed events for the background-processing pipeline.
 *
 * Event flow:
 *   project/uploaded  → process-video (audio extraction + transcription)
 *   project/generate  → generate-documents (AI analysis + SOP package)
 */

type Events = {
  "project/uploaded": {
    data: {
      projectId: string;
      workspaceId: string;
      uploadedFileId: string;
      priority?: boolean;
    };
  };
  "project/generate": {
    data: {
      projectId: string;
      workspaceId: string;
      transcriptId: string;
      requestedByUserId: string;
    };
  };
  "project/retranscribe": {
    data: {
      projectId: string;
      workspaceId: string;
      requestedByUserId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "flownet-sop-builder",
  schemas: new EventSchemas().fromRecord<Events>(),
});
