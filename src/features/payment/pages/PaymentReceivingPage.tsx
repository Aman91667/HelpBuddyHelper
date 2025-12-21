import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/core/api/client';
import { socketClient } from '@/core/socket/client';
import type { Service } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, ArrowLeft, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EarningsBreakdown from '@/features/jobs/components/EarningsBreakdown';
import PremiumPage from '@/components/layout/PremiumPage';

export default function PaymentReceivingPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'COMPLETED' | 'FAILED'>('PENDING');

  useEffect(() => {
    if (!serviceId) return;
    fetchServiceDetails();

    // Listen for payment completion event
    const handlePaymentCompleted = (data: any) => {
      if (data.serviceId === serviceId) {
        setPaymentStatus('COMPLETED');
        toast({
          title: 'Payment Received!',
          description: `Patient paid via ${data.paymentMethod || 'Cash'}`,
        });
        fetchServiceDetails();
      }
    };

    socketClient.on('payment:completed', handlePaymentCompleted);

    return () => {
      socketClient.off('payment:completed', handlePaymentCompleted);
    };
  }, [serviceId, toast]);

  const fetchServiceDetails = async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const response = await apiClient.getService(serviceId);
      if (response.success && response.data) {
        const svc = response.data as Service;
        setService(svc);
        // Check payment status
        const status = (svc as any).paymentStatus || 'PENDING';
        setPaymentStatus(status);
      }
    } catch (error) {
      console.error('Failed to fetch service details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PremiumPage title="Loading..." subtitle="Fetching payment details">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </PremiumPage>
    );
  }

  if (!service) {
    return (
      <PremiumPage title="Service Not Found" subtitle="This service may have been cancelled">
        <div className="flex items-center justify-center min-h-[400px]">
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </PremiumPage>
    );
  }

  const billedMinutes = (service as any).billedMinutes || 0;
  const serviceCharge = billedMinutes * 2.5;
  const platformCharge = 15;
  const totalFare = service.fare ?? serviceCharge + platformCharge;
  const helperEarnings = totalFare;

  return (
    <PremiumPage title="Payment Receiving" subtitle="Waiting for patient payment">
      <div className="space-y-6">
        {/* Payment Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-2 ${
            paymentStatus === 'COMPLETED' 
              ? 'border-emerald-200 bg-emerald-50/50' 
              : 'border-amber-200 bg-amber-50/50'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {paymentStatus === 'COMPLETED' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentStatus === 'COMPLETED' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-100 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 text-emerald-700 mb-2">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold text-lg">Payment Received!</span>
                    </div>
                    <p className="text-sm text-emerald-600">
                      Patient paid via {(service as any).paymentMethod || 'Cash'}
                    </p>
                    {(service as any).paidAt && (
                      <p className="text-xs text-emerald-500 mt-1">
                        Received at {new Date((service as any).paidAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-100 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700 mb-2">
                      <Clock className="h-5 w-5 animate-pulse" />
                      <span className="font-semibold text-lg">Waiting for Payment</span>
                    </div>
                    <p className="text-sm text-amber-600">
                      Patient is processing payment. You'll be notified when payment is received.
                    </p>
                    <p className="text-xs text-amber-500 mt-2">
                      Expected amount: ₹{helperEarnings.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={fetchServiceDetails}
                      variant="outline"
                      className="flex-1"
                    >
                      Refresh Status
                    </Button>
                    <Button
                      onClick={() => navigate('/dashboard')}
                      variant="outline"
                      className="flex-1"
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Earnings Breakdown */}
        {service.status === 'COMPLETED' && (
          <EarningsBreakdown service={service} />
        )}

        {/* Service Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              Service Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Time</span>
              <span className="font-medium">{billedMinutes} minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="font-medium">₹{serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="font-medium">₹{platformCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-semibold">Your Earnings</span>
              <span className="text-xl font-bold text-emerald-600">
                ₹{helperEarnings.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total Fare (Patient Pays)</span>
              <span className="font-medium">₹{totalFare.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PremiumPage>
  );
}

