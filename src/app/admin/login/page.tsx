import { AdminLoginForm } from "@/components/admin/login-form";
import { PageHeader } from "@/components/public-ui";

export default function AdminLoginPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Protected administration"
        title="Administrator login"
        description="Sign in with the approved Supabase administrator account. Public tournament pages do not require an account."
      />
      <AdminLoginForm />
    </div>
  );
}
