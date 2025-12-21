import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { DollarSign, TrendingUp, Wallet, Calendar, Download } from 'lucide-react';
import PremiumPage from '@/components/layout/PremiumPage';

export default function EarningsPage() {
  const { helper } = useAuth();

  const stats = [
    { label: 'Total Earned', value: `$${helper?.totalEarnings?.toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Available Balance', value: `$${helper?.currentBalance?.toFixed(2) || '0.00'}`, icon: Wallet, color: 'text-success' },
    { label: 'This Month', value: '$1,250.00', icon: Calendar, color: 'text-warning' },
    { label: 'Growth', value: '+24%', icon: TrendingUp, color: 'text-accent' },
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
              <p className="text-3xl font-bold text-success">${helper?.currentBalance?.toFixed(2) || '0.00'}</p>
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
