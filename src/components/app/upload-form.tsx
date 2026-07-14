"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  ExternalLink,
  FileVideo,
  Link2,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { PlanId } from "@/lib/plans";
import {
  SUPPORTED_EXTENSIONS,
  uploadFormSchema,
  validateUpload,
  type UploadFormValues,
} from "@/lib/upload-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/components/app/api";

const DETAIL_LEVELS: { value: UploadFormValues["detailLevel"]; label: string }[] =
  [
    { value: "concise", label: "Concise" },
    { value: "standard", label: "Standard" },
    { value: "detailed", label: "Detailed" },
    { value: "training_level", label: "Training-level" },
  ];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
];

type FormState = {
  title: string;
  department: string;
  processCategory: string;
  processOwner: string;
  intendedAudience: string;
  description: string;
  companyTerminology: string;
  detailLevel: UploadFormValues["detailLevel"];
  language: string;
};

const INITIAL_FORM: FormState = {
  title: "",
  department: "",
  processCategory: "",
  processOwner: "",
  intendedAudience: "",
  description: "",
  companyTerminology: "",
  detailLevel: "standard",
  language: "en",
};

type Phase = "idle" | "preparing" | "uploading" | "finalizing";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileContentType(file: File): string {
  return file.type || "application/octet-stream";
}

function putFileWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", fileContentType(file));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export function UploadForm({
  workspaceId,
  plan,
  usedMinutes,
  remainingMinutes,
}: {
  workspaceId: string;
  plan: PlanId;
  usedMinutes: number;
  remainingMinutes: number;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({});

  // File upload state
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [uploadPercent, setUploadPercent] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Loom state
  const [loomUrl, setLoomUrl] = React.useState("");
  const [loomSubmitting, setLoomSubmitting] = React.useState(false);
  const [loomNotice, setLoomNotice] = React.useState<{
    message: string;
    projectId: string;
  } | null>(null);

  const busy = phase !== "idle";
  const outOfMinutes = remainingMinutes <= 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function validateForm(): UploadFormValues | null {
    const parsed = uploadFormSchema.safeParse(form);
    if (parsed.success) {
      setFieldErrors({});
      return parsed.data;
    }
    const errors: Partial<Record<keyof FormState, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof FormState | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
    toast.error("Fix the highlighted fields and try again.");
    return null;
  }

  function selectFile(candidate: File) {
    const validationError = validateUpload({
      fileName: candidate.name,
      contentType: fileContentType(candidate),
      sizeBytes: candidate.size,
      plan,
      usedTranscriptionMinutesThisPeriod: usedMinutes,
    });
    setFile(candidate);
    setFileError(validationError?.message ?? null);
    setSubmitError(null);
    if (!form.title) {
      const base = candidate.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      setField("title", base.charAt(0).toUpperCase() + base.slice(1));
    }
  }

  async function handleFileSubmit() {
    if (!file) {
      toast.error("Choose a video or audio file to upload.");
      return;
    }
    if (fileError) return;
    const values = validateForm();
    if (!values) return;

    setSubmitError(null);
    setUploadPercent(0);
    try {
      setPhase("preparing");
      const created = await apiFetch<{
        projectId: string;
        uploadedFileId: string;
        uploadUrl: string;
      }>(`/api/workspaces/${workspaceId}/uploads`, {
        method: "POST",
        body: JSON.stringify({
          file: {
            fileName: file.name,
            contentType: fileContentType(file),
            sizeBytes: file.size,
          },
          form: values,
        }),
      });

      setPhase("uploading");
      try {
        await putFileWithProgress(created.uploadUrl, file, setUploadPercent);
      } catch (err) {
        if (err instanceof Error && err.message === "network") {
          throw new Error(
            "Upload interrupted — check your connection and try again.",
          );
        }
        throw err;
      }

      setPhase("finalizing");
      await apiFetch<{ ok: boolean }>(
        `/api/workspaces/${workspaceId}/uploads/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId: created.projectId,
            uploadedFileId: created.uploadedFileId,
          }),
        },
      );

      toast.success("Upload complete. Processing has started.");
      router.push(`/w/${workspaceId}/projects/${created.projectId}`);
    } catch (error) {
      setPhase("idle");
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong during the upload.",
      );
    }
  }

  async function handleLoomSubmit() {
    if (!loomUrl.trim()) {
      toast.error("Paste a Loom link first.");
      return;
    }
    const values = validateForm();
    if (!values) return;

    setLoomSubmitting(true);
    setLoomNotice(null);
    try {
      const body = await apiFetch<{
        projectId: string;
        result: { status: "queued" | "not_supported"; message?: string };
      }>(`/api/workspaces/${workspaceId}/loom-import`, {
        method: "POST",
        body: JSON.stringify({ loomUrl: loomUrl.trim(), form: values }),
      });

      if (body.result.status === "not_supported") {
        setLoomNotice({
          message:
            body.result.message ??
            "This Loom link can't be imported automatically yet.",
          projectId: body.projectId,
        });
      } else {
        toast.success("Loom import queued. Processing has started.");
        router.push(`/w/${workspaceId}/projects/${body.projectId}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Loom import failed.",
      );
    } finally {
      setLoomSubmitting(false);
    }
  }

  const metadataFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          Project title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="e.g. Processing a customer refund"
          maxLength={200}
          aria-invalid={!!fieldErrors.title}
        />
        {fieldErrors.title ? (
          <p className="text-xs text-destructive">{fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={form.department}
            onChange={(e) => setField("department", e.target.value)}
            placeholder="e.g. Customer Support"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="processCategory">Process category</Label>
          <Input
            id="processCategory"
            value={form.processCategory}
            onChange={(e) => setField("processCategory", e.target.value)}
            placeholder="e.g. Billing"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="processOwner">Process owner</Label>
          <Input
            id="processOwner"
            value={form.processOwner}
            onChange={(e) => setField("processOwner", e.target.value)}
            placeholder="e.g. Jamie Chen"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intendedAudience">Intended audience</Label>
          <Input
            id="intendedAudience"
            value={form.intendedAudience}
            onChange={(e) => setField("intendedAudience", e.target.value)}
            placeholder="e.g. New support agents"
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Process description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Briefly describe what this process accomplishes and when it's used."
          rows={3}
          maxLength={4000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyTerminology">Company terminology</Label>
        <Textarea
          id="companyTerminology"
          value={form.companyTerminology}
          onChange={(e) => setField("companyTerminology", e.target.value)}
          placeholder="e.g. FlowNet, SOPHub, ACV, Zendesk macros…"
          rows={3}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">
          Names, acronyms, and product terms the AI should spell correctly.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="detailLevel">Desired level of detail</Label>
          <Select
            value={form.detailLevel}
            onValueChange={(v) =>
              setField("detailLevel", v as FormState["detailLevel"])
            }
          >
            <SelectTrigger id="detailLevel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DETAIL_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Document language</Label>
          <Select
            value={form.language}
            onValueChange={(v) => setField("language", v)}
          >
            <SelectTrigger id="language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {outOfMinutes ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CircleAlert className="size-4" />
          <AlertTitle>No transcription minutes left</AlertTitle>
          <AlertDescription>
            You&apos;ve used all of this month&apos;s transcription minutes.{" "}
            <Link
              href={`/w/${workspaceId}/settings/billing`}
              className="font-medium underline underline-offset-2"
            >
              Upgrade your plan
            </Link>{" "}
            or wait for your allowance to reset.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">
            <UploadCloud className="size-4" />
            Upload file
          </TabsTrigger>
          <TabsTrigger value="loom">
            <Link2 className="size-4" />
            Loom link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <Card>
            <CardContent className="space-y-6">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={SUPPORTED_EXTENSIONS.join(",")}
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) selectFile(selected);
                  e.target.value = "";
                }}
              />

              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a video or audio file"
                onClick={() => !busy && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !busy) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (busy) return;
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) selectFile(dropped);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragActive
                    ? "border-gold bg-gold/10"
                    : "border-border hover:border-gold/60 hover:bg-muted/50",
                  busy && "pointer-events-none opacity-60",
                )}
              >
                <UploadCloud className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drag and drop your recording here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse — {SUPPORTED_EXTENSIONS.join(", ")}
                </p>
              </div>

              {file ? (
                <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
                  <FileVideo className="size-5 shrink-0 text-navy dark:text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  {!busy ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove file"
                      onClick={() => {
                        setFile(null);
                        setFileError(null);
                        setSubmitError(null);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {fileError ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              ) : null}

              {metadataFields}

              {phase === "uploading" || phase === "finalizing" ? (
                <div className="space-y-2">
                  <Progress value={uploadPercent} />
                  <p className="text-sm text-muted-foreground">
                    {phase === "finalizing"
                      ? "Finishing up…"
                      : `Uploading ${file?.name ?? ""} — ${uploadPercent}%`}
                  </p>
                </div>
              ) : null}

              {submitError ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertTitle>Upload failed</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{submitError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleFileSubmit()}
                    >
                      <RefreshCw className="size-4" />
                      Retry upload
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                className="w-full bg-gold text-navy hover:bg-gold-dark sm:w-auto"
                size="lg"
                disabled={busy || !file || !!fileError || outOfMinutes}
                onClick={() => void handleFileSubmit()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "preparing"
                      ? "Preparing…"
                      : phase === "uploading"
                        ? "Uploading…"
                        : "Finishing…"}
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4" />
                    Upload and generate SOP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loom">
          <Card>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="loomUrl">Loom link</Label>
                <Input
                  id="loomUrl"
                  type="url"
                  value={loomUrl}
                  onChange={(e) => setLoomUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/…"
                />
                <p className="text-xs text-muted-foreground">
                  Paste the share link of a Loom recording.
                </p>
              </div>

              {metadataFields}

              {loomNotice ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <CircleAlert className="size-4" />
                  <AlertTitle>Import not available yet</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{loomNotice.message}</p>
                    <Link
                      href={`/w/${workspaceId}/projects/${loomNotice.projectId}`}
                      className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                    >
                      View the created project
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                className="w-full bg-gold text-navy hover:bg-gold-dark sm:w-auto"
                size="lg"
                disabled={loomSubmitting || outOfMinutes}
                onClick={() => void handleLoomSubmit()}
              >
                {loomSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Link2 className="size-4" />
                    Import from Loom
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
