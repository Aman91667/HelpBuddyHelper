import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Star, 
  BarChart3,
  Activity,
  Award
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiClient } from '@/core/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PremiumPage from '@/components/layout/PremiumPage';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Analytics Data
  const [earningsTrends, setEarningsTrends] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
  const [satisfactionTrends, setSatisfactionTrends] = useState<any[]>([]);
  const [ratingStats, setRatingStats] = useState<any>(null);

  useEffect(() => {
    fetchAllAnalytics();
  }, [timeRange]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [earnings, peak, breakdown, satisfaction, ratings] = await Promise.all([
        apiClient.getEarningsTrends(timeRange, 30),
        apiClient.getHelperPeakHours(),
        apiClient.getHelperServiceTypeBreakdown(),
        apiClient.getHelperSatisfactionTrends(timeRange),
        apiClient.getHelperRatingStats(),
      ]);

      if (earnings.success && earnings.data) {
        const data = earnings.data as any;
        setEarningsTrends(data.trends || []);
      }

      if (peak.success && peak.data) {
        const data = peak.data as any;
        setPeakHours(data.hourlyBreakdown || []);
      }

      if (breakdown.success && breakdown.data) {
        const data = breakdown.data as any;
        setServiceBreakdown(data.breakdown || []);
      }

      if (satisfaction.success && satisfaction.data) {
        const data = satisfaction.data as any;
        setSatisfactionTrends(data.trends || []);
      }

      if (ratings.success && ratings.data) {
        setRatingStats(ratings.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Summary Stats
  const totalEarnings = earningsTrends.reduce((sum, item) => sum + (item.earnings || 0), 0);
  const avgRating = ratingStats?.averageRating || 0;
  const totalServices = ratingStats?.totalRatings || 0;
  const peakHour = peakHours.reduce((max, hour) => 
    hour.count > (max.count || 0) ? hour : max, { hour: 0, count: 0 }
  );

  // Calculate trends from actual data
  const earningsTrend = earningsTrends.length > 1 
    ? ((earningsTrends[earningsTrends.length - 1]?.earnings || 0) - (earningsTrends[0]?.earnings || 0)) / Math.max(earningsTrends[0]?.earnings || 1, 1) * 100
    : 0;
  const ratingTrend = ratingStats?.averageRating ? ratingStats.averageRating.toFixed(1) : '0.0';

  const summaryCards = [
    {
      title: 'Total Earnings',
      value: `₹${totalEarnings.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      trend: earningsTrend >= 0 ? `+${earningsTrend.toFixed(1)}%` : `${earningsTrend.toFixed(1)}%`,
    },
    {
      title: 'Average Rating',
      value: ratingTrend,
      icon: Star,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      trend: `${totalServices} services`,
    },
    {
      title: 'Total Services',
      value: totalServices.toString(),
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      trend: 'Completed',
    },
    {
      title: 'Peak Hour',
      value: `${peakHour.hour || 0}:00`,
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      trend: `${peakHour.count || 0} requests`,
    },
  ];

  if (loading) {
    return (
      <PremiumPage title="Analytics Dashboard" subtitle="Loading your insights...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500"></div>
        </div>
      </PremiumPage>
    );
  }

  return (
    <PremiumPage 
      title="📊 Analytics Dashboard" 
      subtitle="Track your performance and earnings"
      headerExtra={
        <div className="flex gap-2">
          <Button
            variant={timeRange === 'daily' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('daily')}
          >
            Daily
          </Button>
          <Button
            variant={timeRange === 'weekly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('weekly')}
          >
            Weekly
          </Button>
          <Button
            variant={timeRange === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('monthly')}
          >
            Monthly
          </Button>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-slate-600 mb-1">{card.title}</p>
                      <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                      <p className="text-sm text-emerald-600 mt-2">{card.trend}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${card.bgColor}`}>
                      <Icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Earnings Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={earningsTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Earnings ($)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Peak Hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Peak Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[8, 8, 0, 0]}
                    name="Requests"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Service Type Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Service Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={serviceBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {serviceBreakdown.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Satisfaction Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Satisfaction Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={satisfactionTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    domain={[0, 5]}
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="averageRating" 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    dot={{ fill: '#f59e0b', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Average Rating"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Rating Distribution */}
      {ratingStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-pink-500" />
                Rating Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingStats.distribution?.[star] || 0;
                  const percentage = totalServices > 0 ? (count / totalServices) * 100 : 0;
                  
                  return (
                    <div key={star} className="flex items-center gap-4">
                      <div className="flex items-center gap-1 w-20">
                        <span className="text-sm font-medium">{star}</span>
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: 0.7 + (5 - star) * 0.1, duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-400"
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <span className="text-sm font-medium">{count}</span>
                        <span className="text-xs text-slate-500 ml-1">({percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </PremiumPage>
  );
}
