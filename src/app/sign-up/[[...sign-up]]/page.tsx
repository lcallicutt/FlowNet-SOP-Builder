import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="flex flex-col items-center gap-8">
        <p className="text-lg font-semibold tracking-tight text-white">
          FlowNet <span className="text-gold">SOP Builder</span>
        </p>
        <SignUp />
      </div>
    </main>
  );
}
