"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UbcBadge } from "@/components/ubc/ubc-badge";
import { useProfile } from "@/hooks/use-profile";
import { clientApi } from "@/lib/client-api";
import { useUiStore } from "@/stores/ui-store";

export default function SettingsPage() {
  const { user } = useUser();
  const { data, patch } = useProfile();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<"idle" | "code">("idle");

  const ubcClaim = data?.user.isUbcStudentClaim ?? false;
  const ubcVerified = data?.user.isUbcVerified ?? false;

  const toggleClaim = async (checked: boolean) => {
    try {
      await patch.mutateAsync({ isUbcStudentClaim: checked });
      toast.success(checked ? "UBC student claim enabled" : "UBC claim removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const startVerification = async () => {
    if (!user || !email.trim()) return;
    setVerifying(true);
    try {
      const normalized = email.trim().toLowerCase();

      // Domain allowlist is enforced server-side; start before Clerk so invalid domains fail early.
      await clientApi("/api/ubc/verification/start", {
        method: "POST",
        body: JSON.stringify({ educationEmail: normalized }),
      });

      const created = await user.createEmailAddress({ email: normalized });
      await created.prepareVerification({ strategy: "email_code" });

      setStep("code");
      toast.message("Check your inbox for a verification code");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start verification");
    } finally {
      setVerifying(false);
    }
  };

  const submitCode = async () => {
    if (!user || !code.trim()) return;
    setVerifying(true);
    try {
      const emailResource = user.emailAddresses.find(
        (e) => e.emailAddress.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!emailResource) throw new Error("Email not found on your account");

      await emailResource.attemptVerification({ code: code.trim() });

      await clientApi("/api/ubc/verification/verify", {
        method: "POST",
        body: JSON.stringify({
          educationEmail: email.trim().toLowerCase(),
          clerkEmailId: emailResource.id,
        }),
      });

      toast.success("UBC email verified");
      setStep("idle");
      setCode("");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">Account, appearance, and verification.</p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light, dark, or follow your system.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={theme === t ? "accent" : "outline"}
                size="sm"
                className="capitalize"
                onClick={() => setTheme(t)}
              >
                {t}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>UBC student</CardTitle>
              <UbcBadge claim={ubcClaim} verified={ubcVerified} />
            </div>
            <CardDescription>
              Claim student status and verify with your UBC email for a trusted badge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ubc-claim" className="flex flex-col gap-1">
                <span>I am a UBC student</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Shows a muted badge until verified
                </span>
              </Label>
              <Switch
                id="ubc-claim"
                checked={ubcClaim}
                onCheckedChange={(v) => void toggleClaim(v)}
                disabled={patch.isPending}
              />
            </div>

            {ubcClaim && !ubcVerified && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Verify your @student.ubc.ca email
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ubc-email">UBC email</Label>
                  <Input
                    id="ubc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@student.ubc.ca"
                    disabled={step === "code"}
                  />
                </div>
                {step === "code" && (
                  <div className="space-y-2">
                    <Label htmlFor="ubc-code">Verification code</Label>
                    <Input
                      id="ubc-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                )}
                <Button
                  variant="accent"
                  disabled={verifying}
                  onClick={() => void (step === "code" ? submitCode() : startVerification())}
                >
                  {verifying && <Loader2 className="animate-spin" />}
                  {step === "code" ? "Confirm verification" : "Send verification code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
