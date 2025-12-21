import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IndianRupee, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EarningsSummary() {
  const { helper } = useAuth();
  const navigate = useNavigate();

  const totalEarnings = helper?.totalEarnings || 0;
  const currentBalance = helper?.currentBalance || 0;
  const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

  return (
    <Card className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
            <IndianRupee className="w-5 h-5 text-primary-foreground" />
          </div>
          Earnings Overview
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
            <motion.p
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent"
            >
            {formatCurrency(totalEarnings)}
            </motion.p>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Available</p>
            <p className="text-2xl font-bold text-success">
            {formatCurrency(currentBalance)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-xl">
          <TrendingUp className="w-4 h-4 text-success" />
          <p className="text-sm text-success font-medium">
            +24% from last week
          </p>
        </div>

        <Button
          onClick={() => navigate('/earnings')}
          className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 transition-opacity shadow-md"
        >
          View Details
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
