import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Service } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, DollarSign, User, Phone } from 'lucide-react';

interface ServiceRequestModalProps {
  service: Service;
  onAccept: (serviceId: string) => void;
  onReject: () => void;
}

export default function ServiceRequestModal({ service, onAccept, onReject }: ServiceRequestModalProps) {
  const [timeLeft, setTimeLeft] = useState(service.expiresInMs ? Math.floor(service.expiresInMs / 1000) : 20);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onReject]);

  const progress = (timeLeft / 20) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-background/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)] overflow-y-auto"
        >
          <Card className="border-2 border-primary/50 shadow-2xl bg-card overflow-hidden">
            {/* Timer Progress Bar */}
            <div className="h-2 bg-muted relative overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                className={`h-full transition-colors duration-300 ${
                  timeLeft < 10
                    ? 'bg-gradient-to-r from-destructive to-destructive/80'
                    : 'bg-gradient-to-r from-primary to-primary/80'
                }`}
              />
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-1">New Service Request</CardTitle>
                  <CardDescription>Review and accept the request</CardDescription>
                </div>
                <Badge
                  variant={timeLeft < 10 ? 'destructive' : 'default'}
                  className="text-base px-3 py-1 flex items-center gap-1"
                >
                  <Clock className="w-4 h-4" />
                  {timeLeft}s
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Patient Info */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">{service?.patientUser?.name ?? 'Unknown'}</p>
                  {service?.patientUser?.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {service.patientUser.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Location</p>
                  <p className="text-sm text-muted-foreground">
                    {service?.patientLocation?.landmark || 'See map for exact location'}
                  </p>
                  {service?.patientLocation?.lat != null && service?.patientLocation?.lng != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {service.patientLocation.lat.toFixed(4)}, {service.patientLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              {/* Service Types */}
              <div>
                <p className="font-medium mb-2 text-sm">Services Needed</p>
                <div className="flex flex-wrap gap-2">
                              {
                                // normalize serviceType to an array (backend may send CSV string in some flows)
                                (() => {
                                  const raw = (service as any)?.serviceType;
                                  let types: string[] = [];
                                  if (Array.isArray(raw)) types = raw;
                                  else if (typeof raw === 'string') types = raw.split(',').map((s) => s.trim()).filter(Boolean);
                                  else if (raw == null) types = [];
                                  else types = [String(raw)];
                                  return types.map((type) => (
                                    <Badge key={type} variant="outline" className="text-xs">
                                      {type}
                                    </Badge>
                                  ));
                                })()
                              }
                </div>
              </div>

              {/* Description */}
              {service.description && (
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="font-medium mb-1 text-sm">Description</p>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </div>
              )}

              {/* Estimated Fare */}
              {service.estimatedFare && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Fare</p>
                    <p className="text-2xl font-bold text-primary">₹{service.estimatedFare.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" size="lg" onClick={onReject} className="h-12">
                  Reject
                </Button>
                <Button size="lg" onClick={() => onAccept(service.id)} className="h-12">
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
