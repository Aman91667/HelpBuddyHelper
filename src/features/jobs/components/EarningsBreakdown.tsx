import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Clock, TrendingUp } from 'lucide-react';
import type { Service } from '@/types';

interface EarningsBreakdownProps {
  service: Service;
}

export default function EarningsBreakdown({ service }: EarningsBreakdownProps) {
  const billedMinutes = (service as any).billedMinutes || 0;
  const platformCharge = 15;
  const serviceCharge = billedMinutes * 2.5;
  const totalFare = (service as any).fare ?? (platformCharge + serviceCharge);
  const helperEarnings = totalFare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-2 border-emerald-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-600" />
            Earnings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">Service Time</span>
              </div>
              <span className="font-semibold">{billedMinutes} minutes</span>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Service Charge ({billedMinutes} min × ₹2.5)</span>
                <span className="font-medium text-slate-700">₹{serviceCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Platform Bonus</span>
                <span className="font-medium text-slate-700">₹{platformCharge.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-200">
              <span className="text-lg font-bold">Total Fare (Patient Pays)</span>
              <span className="text-xl font-bold text-slate-700">₹{totalFare.toFixed(2)}</span>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700">Your Earnings</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">₹{helperEarnings.toFixed(2)}</span>
              </div>
              <p className="text-xs text-emerald-600 mt-2">
                This amount will be added to your account after payment is received
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

