import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Star, Loader2 } from 'lucide-react';
import { apiClient } from '@/core/api/client';
import { useToast } from '@/hooks/use-toast';

interface HistoryItem {
  id: string;
  patientUser?: { name?: string };
  patient?: { name?: string };
  serviceType: string | string[];
  fare?: number;
  finalFare?: number; // Keep for backward compatibility
  patientRating?: number;
  rating?: number | { patientRating?: number; helperRating?: number };
  createdAt: string;
  requestedAt?: string;
  status: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await apiClient.getServiceHistory();
        if (response.success && response.data) {
          // Handle both array format and object with services array
          const data = response.data as any;
          if (Array.isArray(data)) {
            setHistory(data as HistoryItem[]);
          } else if (data.services && Array.isArray(data.services)) {
            setHistory(data.services as HistoryItem[]);
          } else {
            setHistory([]);
          }
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Failed to load service history',
            variant: 'destructive',
          });
          setHistory([]);
        }
      } catch (error: any) {
        console.error('History fetch error:', error);
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load service history',
          variant: 'destructive',
        });
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background pb-24 pb-safe flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background pb-24">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold mb-2">Service History</h1>
          <p className="text-muted-foreground">
            {history.length > 0 ? `${history.length} completed services` : 'No services yet'}
          </p>
        </motion.div>

        {history.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Service History</h3>
              <p className="text-muted-foreground">
                Complete your first service to see it here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-base">
                            {item.patientUser?.name || item.patient?.name || 'Patient'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {Array.isArray(item.serviceType) 
                              ? item.serviceType.join(', ') 
                              : item.serviceType}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        className={
                          item.status === 'COMPLETED' 
                            ? 'bg-success text-success-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-4">
                        {(() => {
                          // Get patient rating (helper sees what patient rated them)
                          let ratingValue: number | null = null;
                          if (item.patientRating) {
                            ratingValue = typeof item.patientRating === 'number' ? item.patientRating : parseFloat(String(item.patientRating));
                          } else if (item.rating) {
                            if (typeof item.rating === 'number') {
                              ratingValue = item.rating;
                            } else if (typeof item.rating === 'object' && item.rating.patientRating) {
                              ratingValue = typeof item.rating.patientRating === 'number' ? item.rating.patientRating : parseFloat(String(item.rating.patientRating));
                            }
                          }
                          return ratingValue && ratingValue > 0 ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-warning text-warning" />
                              <span className="text-sm font-medium">{ratingValue.toFixed(1)}</span>
                            </div>
                          ) : null;
                        })()}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(item.requestedAt || item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">₹</span>
                        <span className="text-lg font-bold text-success">
                          {(item.fare || item.finalFare)?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
