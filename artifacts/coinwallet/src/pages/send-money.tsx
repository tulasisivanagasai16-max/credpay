import { useState } from "react";
import { Link } from "wouter";
import { 
  useListPayees, 
  useCreatePayee, 
  useQuoteFees, 
  useCreatePayout,
  useGetWalletSummaryQueryKey,
  useGetWalletQueryKey,
  useGetLedgerOverviewQueryKey,
  getListTransactionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, ArrowUpRight, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CreatePayeeRequestType } from "@workspace/api-client-react/src/generated/api.schemas";

export default function SendMoney() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [payeeId, setPayeeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("500");
  const [note, setNote] = useState<string>("");
  const [step, setStep] = useState<1 | 2>(1);
  
  // New Payee State
  const [isAddingPayee, setIsAddingPayee] = useState(false);
  const [newPayeeLabel, setNewPayeeLabel] = useState("");
  const [newPayeeType, setNewPayeeType] = useState<CreatePayeeRequestType>("UPI");
  const [newPayeeIdentifier, setNewPayeeIdentifier] = useState("");
  const [newPayeeIfsc, setNewPayeeIfsc] = useState("");

  const numAmount = Number(amount) || 0;

  const { data: payees, isLoading: payeesLoading } = useListPayees();
  const createPayee = useCreatePayee();
  const createPayout = useCreatePayout();
  
  const quoteQuery = useQuoteFees({ kind: "PAYOUT", amountInr: numAmount }, { 
    query: { enabled: numAmount > 0 && payeeId !== "", staleTime: 30000 } 
  });

  const handleAddPayee = (e: React.FormEvent) => {
    e.preventDefault();
    createPayee.mutate(
      { data: { label: newPayeeLabel, type: newPayeeType, identifier: newPayeeIdentifier, ifsc: newPayeeType === 'BANK' ? newPayeeIfsc : undefined } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/payees"] });
          setPayeeId(data.id);
          setIsAddingPayee(false);
          toast({ title: "Payee saved successfully" });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleSend = () => {
    if (!payeeId || numAmount <= 0) return;

    createPayout.mutate(
      { data: { payeeId, amountInr: numAmount, note } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLedgerOverviewQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
          setStep(2);
        },
        onError: (err: any) => {
          toast({ title: "Transfer Failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Send Money</h1>
        <p className="text-muted-foreground mt-1">Transfer coins to a UPI ID or Bank Account instantly</p>
      </div>

      {step === 1 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-sm border">
            <CardHeader>
              <CardTitle>Transfer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Select Payee</Label>
                <Select value={payeeId} onValueChange={setPayeeId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose a saved payee" />
                  </SelectTrigger>
                  <SelectContent>
                    {payees?.items.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} ({p.type} - {p.identifier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Dialog open={isAddingPayee} onOpenChange={setIsAddingPayee}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-primary">
                      <Plus className="h-3 w-3 mr-1" /> Add New Payee
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleAddPayee}>
                      <DialogHeader>
                        <DialogTitle>Add New Payee</DialogTitle>
                        <DialogDescription>Save a new beneficiary for easy transfers.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Label/Name</Label>
                          <Input required value={newPayeeLabel} onChange={e => setNewPayeeLabel(e.target.value)} placeholder="e.g. Ramesh House Rent" />
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={newPayeeType} onValueChange={(v: CreatePayeeRequestType) => setNewPayeeType(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UPI">UPI ID</SelectItem>
                              <SelectItem value="BANK">Bank Account</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{newPayeeType === 'UPI' ? 'UPI ID' : 'Account Number'}</Label>
                          <Input required value={newPayeeIdentifier} onChange={e => setNewPayeeIdentifier(e.target.value)} placeholder={newPayeeType === 'UPI' ? 'username@upi' : '1234567890'} />
                        </div>
                        {newPayeeType === 'BANK' && (
                          <div className="space-y-2">
                            <Label>IFSC Code</Label>
                            <Input required value={newPayeeIfsc} onChange={e => setNewPayeeIfsc(e.target.value)} placeholder="HDFC0001234" />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddingPayee(false)}>Cancel</Button>
                        <Button type="submit" disabled={createPayee.isPending}>
                          {createPayee.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Payee"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                <Label>Amount (INR)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-xl font-bold text-muted-foreground">₹</span>
                  <Input 
                    type="number" 
                    min="1"
                    className="pl-10 text-2xl font-bold h-14"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="What's this for?" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer Amount</span>
                  <span className="font-medium">{formatInr(numAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer Fee</span>
                  <span className="font-medium text-amber-600">
                    {!payeeId ? 'Select Payee' : quoteQuery.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : quoteQuery.data ? formatInr(quoteQuery.data.feeInr) : '₹0.00'}
                  </span>
                </div>
                <div className="pt-3 mt-3 border-t border-border flex justify-between text-base font-bold">
                  <span>Total Debit</span>
                  <span className="text-red-600">
                    {!payeeId || quoteQuery.isLoading ? '-' : quoteQuery.data ? formatInr(quoteQuery.data.amountInr + quoteQuery.data.feeInr) : '₹0.00'}
                  </span>
                </div>
              </div>

              <Button 
                className="w-full h-12 mt-4 text-lg" 
                onClick={handleSend}
                disabled={!payeeId || numAmount <= 0 || quoteQuery.isLoading || createPayout.isPending}
              >
                {createPayout.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Confirm & Send</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card className="shadow-lg border-none text-center py-12 max-w-md mx-auto">
          <CardContent className="space-y-6">
            <div className="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 relative">
              <ArrowUpRight className="h-10 w-10 text-blue-600 dark:text-blue-400 absolute animate-ping duration-1000 opacity-50" />
              <ArrowUpRight className="h-10 w-10 text-blue-600 dark:text-blue-400 relative z-10" />
            </div>
            <h2 className="text-3xl font-bold">Transfer Initiated</h2>
            <p className="text-muted-foreground">
              {formatInr(numAmount)} is on its way. The transaction is currently processing through the banking network.
            </p>
            <div className="pt-8 flex flex-col gap-3">
              <Link href="/transactions">
                <Button className="w-full h-12">View Transaction Status</Button>
              </Link>
              <Button variant="outline" onClick={() => { setStep(1); setAmount("500"); setPayeeId(""); }}>Send Another</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
