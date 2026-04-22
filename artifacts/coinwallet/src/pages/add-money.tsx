import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useQuoteFees, 
  useCreatePaymentIntent, 
  useConfirmPaymentIntent,
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
import { Loader2, CreditCard, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AddMoney() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState<string>("1000");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [intentId, setIntentId] = useState<string | null>(null);
  
  // Card details
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState(""); // Only last 4 collected for demo
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const numAmount = Number(amount) || 0;

  // Hooks
  const quoteQuery = useQuoteFees({ kind: "LOAD", amountInr: numAmount }, { 
    query: { enabled: numAmount > 0, staleTime: 30000 } 
  });
  
  const createIntent = useCreatePaymentIntent();
  const confirmIntent = useConfirmPaymentIntent();

  const handleContinueToPayment = () => {
    if (numAmount <= 0) return;
    
    createIntent.mutate(
      { data: { amountInr: numAmount } },
      {
        onSuccess: (data) => {
          setIntentId(data.id);
          setStep(2);
        },
        onError: (err: any) => {
          toast({
            title: "Failed to initialize payment",
            description: err.message || "Please try again",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentId) return;

    const last4 = cardNumber.replace(/\D/g, '').slice(-4);
    if (last4.length !== 4) {
      toast({ title: "Invalid card", description: "Please enter a valid card number", variant: "destructive" });
      return;
    }

    confirmIntent.mutate(
      { id: intentId, data: { cardLast4: last4, cardholderName: cardName } },
      {
        onSuccess: () => {
          // Invalidate cache
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLedgerOverviewQueryKey() });
          
          setStep(3);
        },
        onError: (err: any) => {
          toast({
            title: "Payment failed",
            description: err.message || "Your card was declined",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Money</h1>
        <p className="text-muted-foreground mt-1">Load coins securely using your credit card</p>
      </div>

      {step === 1 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Enter Amount</CardTitle>
            <CardDescription>1 Coin = ₹1. Fees are calculated dynamically based on your load amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 text-xl font-bold text-muted-foreground">₹</span>
                <Input 
                  type="number" 
                  min="1"
                  className="pl-10 text-2xl font-bold h-14"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {['500', '1000', '2000', '5000'].map(val => (
                <Button 
                  key={val} 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAmount(val)}
                  className={amount === val ? 'border-primary text-primary' : ''}
                >
                  ₹{val}
                </Button>
              ))}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatInr(numAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="font-medium text-amber-600">
                  {quoteQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                   quoteQuery.data ? formatInr(quoteQuery.data.feeInr) : '₹0.00'}
                </span>
              </div>
              <div className="pt-3 border-t flex justify-between font-bold">
                <span>Net Coins Added</span>
                <span className="text-green-600 text-lg">
                  {quoteQuery.data ? formatInr(quoteQuery.data.netInr) : '₹0.00'}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleContinueToPayment}
              disabled={numAmount <= 0 || createIntent.isPending || quoteQuery.isLoading}
            >
              {createIntent.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Continue to Payment"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-md">
          <form onSubmit={handleConfirmPayment}>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="h-8 px-2">
                  Back
                </Button>
                <div className="text-sm font-medium">Payment Details</div>
              </div>
              <CardTitle>Secure Checkout</CardTitle>
              <CardDescription>
                You are paying {formatInr(numAmount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cardholder Name</Label>
                <Input required value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Card Number (Demo)</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    required 
                    className="pl-10 font-mono" 
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)} 
                    maxLength={19}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input required placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} maxLength={5} />
                </div>
                <div className="space-y-2">
                  <Label>CVV</Label>
                  <Input required type="password" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} maxLength={4} />
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 justify-center">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                PCI Compliant. We never store your full card details.
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
                disabled={confirmIntent.isPending || cardNumber.length < 15}
              >
                {confirmIntent.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  `Pay ${formatInr(numAmount)} securely`
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card className="shadow-lg border-none bg-green-50/50 dark:bg-green-950/20 text-center py-12">
          <CardContent className="space-y-6">
            <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold">Money Added Successfully!</h2>
            <p className="text-muted-foreground text-lg">
              {formatInr(quoteQuery.data?.netInr || numAmount)} has been added to your CoinWallet.
            </p>
            <div className="pt-8">
              <Link href="/">
                <Button size="lg" className="px-8">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
