import { redirect } from "next/navigation";
import { AuthError, requireWorkspace } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { DocumentEditor } from "@/components/editor/document-editor";
import type { EditorFeatures, EditorRole } from "@/components/editor/types";

export const metadata = { title: "Edit SOP" };

export default async function DocumentEditorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = await params;

  let role: EditorRole;
  let features: EditorFeatures;
  let currentUser: { id: string; name: string | null; email: string };
  try {
    const ctx = await requireWorkspace(workspaceId, "viewer");
    role = ctx.role;
    const plan = PLANS[ctx.plan].features;
    features = {
      versionHistory: plan.versionHistory,
      sharedLinks: plan.sharedLinks,
      approvalWorkflow: plan.approvalWorkflow,
      docxExport: plan.docxExport,
      allDocumentTypes: plan.allDocumentTypes,
    };
    currentUser = {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
    };
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  return (
    <DocumentEditor
      workspaceId={workspaceId}
      documentId={documentId}
      role={role}
      features={features}
      currentUser={currentUser}
    />
  );
}
