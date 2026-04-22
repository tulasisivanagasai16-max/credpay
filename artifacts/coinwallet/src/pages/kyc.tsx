import { useState } from "react";
import { useGetKyc, useSubmitKyc, getGetKycQueryKey, getGetMeQueryKey, getGetWalletSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatInrCompact } from "@/lib/format";

export default function Kyc() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: kyc, isLoading } = useGetKyc();
  const submitKyc = useSubmitKyc();

  const [fullName, setFullName] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitKyc.mutate(
      { data: { fullName, pan, addressLine: address } },
      {
        onSuccess: () => {
          toast({ title: "KYC Submitted", description: "Your application is under review." });
          queryClient.invalidateQueries({ queryKey: getGetKycQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() });
        },
        onError: (err: any) => {
          toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-4 animate-pulse">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full max-w-2xl" />
    </div>;
  }

  const isVerified = kyc?.status === 'VERIFIED';
  const isPending = kyc?.status === 'PENDING';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Verification</h1>
          <p className="text-muted-foreground mt-1">Upgrade your account limits by completing KYC</p>
        </div>
        {kyc && <StatusBadge status={kyc.status} />}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {(!kyc || kyc.status === 'REJECTED') ? (
            <Card className="border-primary/20 shadow-md">
              <form onSubmit={handleSubmit}>
                <CardHeader>
                  <CardTitle>Submit KYC Details</CardTitle>
                  <CardDescription>We need your PAN and legal name as per government records to verify your identity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Legal Name (as on PAN)</Label>
                    <Input id="fullName" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rahul Kumar" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan">Permanent Account Number (PAN)</Label>
                    <Input id="pan" required className="uppercase font-mono" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} minLength={10} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Full Address (Optional)</Label>
                    <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="House/Flat No., Street, City, State, PIN" />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-6 border-t mt-4 flex justify-between items-center">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Lock className="h-3 w-3" /> Secure 256-bit encryption
                  </div>
                  <Button type="submit" disabled={submitKyc.isPending}>
                    {submitKyc.isPending ? "Submitting..." : "Submit for Verification"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : (
            <Card className={`border-none shadow-md ${isVerified ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-amber-50/50 dark:bg-amber-950/20'}`}>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                {isVerified ? (
                  <CheckCircle2 className="h-20 w-20 text-green-500 mb-6" />
                ) : (
                  <ShieldAlert className="h-20 w-20 text-amber-500 mb-6" />
                )}
                <h2 className="text-2xl font-bold mb-2">
                  {isVerified ? "Identity Verified" : "Verification in Progress"}
                </h2>
                <p className="text-muted-foreground max-w-md">
                  {isVerified 
                    ? `Your identity has been verified. Your daily transaction limit is now ${formatInrCompact(kyc.dailyLimitInr)}.`
                    : "Your application is currently being reviewed by our compliance team. This usually takes 1-2 hours."}
                </p>
                {kyc.panMasked && (
                  <div className="mt-8 bg-background px-6 py-3 rounded-full border shadow-sm font-mono text-sm flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    PAN: <span className="font-bold">{kyc.panMasked}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-sidebar text-sidebar-foreground border-sidebar-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sidebar-primary" />
                Account Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-1 opacity-70">
                  <span>Non-KYC Limit</span>
                  <span>{formatInrCompact(5000)} / day</span>
                </div>
                <div className="h-2 bg-sidebar-accent rounded-full overflow-hidden">
                  <div className={`h-full ${!isVerified ? 'bg-sidebar-primary' : 'bg-sidebar-accent-foreground/20'}`} style={{ width: '10%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1 font-medium">
                  <span>Verified KYC Limit</span>
                  <span className="text-green-400">{formatInrCompact(50000)} / day</span>
                </div>
                <div className="h-2 bg-sidebar-accent rounded-full overflow-hidden">
                  <div className={`h-full ${isVerified ? 'bg-green-500' : 'bg-sidebar-accent-foreground/20'}`} style={{ width: '100%' }}></div>
                </div>
              </div>
              <p className="text-xs text-sidebar-foreground/60 leading-relaxed pt-4 border-t border-sidebar-border">
                As per RBI guidelines, prepaid payment instruments require minimum KYC for transactions up to ₹5,000, and full KYC for higher limits.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
