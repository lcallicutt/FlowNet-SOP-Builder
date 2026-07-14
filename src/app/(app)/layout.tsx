/**
 * Authenticated app shell wrapper. Authentication is enforced by the Clerk
 * middleware; the real chrome (sidebar, top bar) lives in the workspace
 * layout at /w/[workspaceId].
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
