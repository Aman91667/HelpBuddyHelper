import type { CurrentJob } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, MessageSquare, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface CurrentJobCardProps {
  service: CurrentJob;
}

export default function CurrentJobCard({ service }: CurrentJobCardProps) {
  const getStatusConfig = (status: CurrentJob['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return { color: 'bg-primary', label: 'Accepted' };
      case 'ARRIVED':
        return { color: 'bg-warning', label: 'Arrived' };
      case 'IN_PROGRESS':
        return { color: 'bg-success', label: 'In Progress' };
      default:
        return { color: 'bg-muted', label: status };
    }
  };

  const statusConfig = getStatusConfig(service.status);

  const openInMaps = () => {
    const lat = (service as any).patientLocation?.lat ?? (service as any).patientLat;
    const lng = (service as any).patientLocation?.lng ?? (service as any).patientLng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-primary/30 shadow-lg bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Current Job
            </CardTitle>
            <Badge className={`${statusConfig.color} text-white`}>
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Patient Info */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-base">{(service as any).patientUser?.name || (service as any).patient?.user?.name || 'Patient'}</p>
              <p className="text-sm text-muted-foreground">
                {(service as any).patientLocation?.landmark || 'Navigate to location'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={openInMaps} className="flex-1 h-11">
              <Navigation className="w-4 h-4 mr-2" />
              Navigate
            </Button>
            <Button variant="outline" className="flex-1 h-11 chat-button">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </div>

          {/* Status Actions */}
          {service.status === 'ACCEPTED' && (
            <Button className="w-full h-11" variant="default">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Arrived
            </Button>
          )}

          {service.status === 'ARRIVED' && (
            <Button className="w-full h-11" variant="default">
              <CheckCircle className="w-4 h-4 mr-2" />
              Start Service
            </Button>
          )}

          {service.status === 'IN_PROGRESS' && (
            <Button className="w-full h-11" variant="default">
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Service
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
