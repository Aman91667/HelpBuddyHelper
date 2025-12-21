import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { DollarSign, TrendingUp, Wallet, Calendar, Download } from 'lucide-react';
import PremiumPage from '@/components/layout/PremiumPage';
import { apiClient } from '@/core/api/client';

export default function EarningsPage() {
  const { helper } = useAuth();
  const [monthlyEarnings, setMonthlyEarnings] = useState<number>(0);
  const [growth, setGrowth] = useState<string>('0%');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const response = await apiClient.getHelperEarnings(
          startOfMonth.toISOString(),
          endOfMonth.toISOString()
        );
        
        if (response.success && response.data) {
          const data = response.data as any;
          setMonthlyEarnings(data.totalEarnings || 0);
          
          // Calculate growth (compare with previous month)
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          
          const lastMonthResponse = await apiClient.getHelperEarnings(
            startOfLastMonth.toISOString(),
            endOfLastMonth.toISOString()
          );
          
          if (lastMonthResponse.success && lastMonthResponse.data) {
            const lastMonthData = lastMonthResponse.data as any;
            const lastMonthEarnings = lastMonthData.totalEarnings || 0;
            const currentMonthEarnings = data.totalEarnings || 0;
            
            if (lastMonthEarnings > 0) {
              const growthPercent = ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100;
              setGrowth(`${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`);
            } else {
              setGrowth(currentMonthEarnings > 0 ? '+100%' : '0%');
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch earnings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsData();
  }, []);

  const stats = [
    { label: 'Total Earned', value: `₹${helper?.totalEarnings?.toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Available Balance', value: `₹${helper?.currentBalance?.toFixed(2) || '0.00'}`, icon: Wallet, color: 'text-success' },
    { label: 'This Month', value: `₹${monthlyEarnings.toFixed(2)}`, icon: Calendar, color: 'text-warning' },
    { label: 'Growth', value: loading ? '...' : growth, icon: TrendingUp, color: 'text-accent' },
  ];

  return (
    <PremiumPage title="Earnings" subtitle="Track your income and payouts">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <stat.icon className={`w-8 h-8 ${stat.color} mb-3`} />
                <p className="text-2xl font-bold mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Available to withdraw</p>
              <p className="text-3xl font-bold text-success">₹{helper?.currentBalance?.toFixed(2) || '0.00'}</p>
            </div>
            <Button className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 transition-opacity">
              <Download className="w-5 h-5 mr-2" />
              Request Withdrawal
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </PremiumPage>
  );
}
