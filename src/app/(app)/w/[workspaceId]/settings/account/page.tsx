import { redirect } from "next/navigation";
import { AuthError, requireWorkspace } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAccountCard } from "@/components/app/delete-account-card";

export const metadata = { title: "Account" };

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspace(workspaceId, "viewer");
  } catch (error) {
    if (error instanceof AuthError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name, email address, password, and connected sign-in methods
            are managed through your FlowNet account. Click your avatar in the
            top-right corner and choose{" "}
            <span className="font-medium">Manage account</span> to update them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Changes to your profile apply across every workspace you belong
            to.
          </p>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}
