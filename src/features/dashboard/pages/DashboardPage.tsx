import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/core/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { socketClient } from '@/core/socket/client';
import type { Service } from '@/types';
import AvailabilityToggle from '@/features/dashboard/components/AvailabilityToggle';
import EarningsSummary from '@/features/dashboard/components/EarningsSummary';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Star, Clock, Award, Wifi, WifiOff, MapPin, Bell, Check } from 'lucide-react';
import { useLocation } from '@/hooks/useLocation';
import PremiumPage from '@/components/layout/PremiumPage';

// Premium re-design of the helper dashboard with restored service request handling.

const playHospitalChime = (() => {
  let audioCtx: AudioContext | null = null;
  return () => {
    if (typeof window === 'undefined') return;
    const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtor) return;
    if (!audioCtx) {
      audioCtx = new AudioCtor();
    }
    audioCtx.resume?.();
    const start = audioCtx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx!.destination);

      const noteStart = start + idx * 0.18;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.35, noteStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.45);
      osc.start(noteStart);
      osc.stop(noteStart + 0.5);
    });
  };
})();

export default function DashboardPage() {
  const { helper } = useAuth();
  const { toast } = useToast();
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [pendingRequest, setPendingRequest] = useState<Service | null>(null);
  const [responseDeadline, setResponseDeadline] = useState<number | null>(null);
  const [requestCountdown, setRequestCountdown] = useState(0);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [hoursOnline, setHoursOnline] = useState<number | null>(null);
  const [loadingHours, setLoadingHours] = useState(true);
  const navigate = useNavigate();

  // Poll for active service
  const pollActiveService = useCallback(async () => {
    try {
      const response = await apiClient.getActiveService();
      if (response.success && response.data) {
        setActiveService(response.data as Service);
      } else {
        setActiveService(null);
      }
    } catch (error) {
      // Ignore errors during polling
    }
  }, []);

  // Fetch total completed jobs
  const fetchTotalJobs = useCallback(async () => {
    try {
      const response = await apiClient.getHelperServiceBreakdown();
      if (response && Array.isArray(response)) {
        // Sum up all counts from different service types
        const total = response.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
        setTotalJobs(total);
      }
    } catch (error) {
      console.error('Failed to fetch total jobs:', error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch hours online (today by default)
  const fetchHoursOnline = useCallback(async () => {
    try {
      setLoadingHours(true);
      const resp = await apiClient.getHelperHoursOnline();
      if (resp && resp.success && resp.data) {
        setHoursOnline(resp.data.hours);
      }
    } catch (err) {
      console.error('Failed to fetch hours online', err);
    } finally {
      setLoadingHours(false);
    }
  }, []);

  useEffect(() => {
    socketClient.on('connect', () => setSocketConnected(true));
    socketClient.on('disconnect', () => setSocketConnected(false));

    return () => {
      socketClient.off('connect');
      socketClient.off('disconnect');
    };
  }, []);

  // Fetch total jobs on mount
  useEffect(() => {
    if (helper?.id) {
      fetchTotalJobs();
      fetchHoursOnline();
    }
  }, [helper?.id, fetchTotalJobs]);

  // Poll for active service on mount and when helper becomes available
  useEffect(() => {
    if (helper?.isAvailable) {
      pollActiveService();
      const interval = setInterval(pollActiveService, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [helper?.isAvailable, pollActiveService]);

  // Handle incoming service requests
  useEffect(() => {
    const handleServiceRequest = (data: any) => {
      if (!helper?.isAvailable) return;
      
      const service = data?.service;
      if (service) {
        setPendingRequest(service);
        const deadline = typeof data?.responseDeadline === 'number' ? data.responseDeadline : Date.now() + 30_000;
        setResponseDeadline(deadline);
        setRequestCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        playHospitalChime();
        toast({
          title: 'New Service Request!',
          description: `Patient needs ${Array.isArray(service.serviceType) ? service.serviceType.join(', ') : service.serviceType}`,
        });
      }
    };

    const handleServiceCompleted = () => {
      // Refresh total jobs when a service is completed
      fetchTotalJobs();
    };

    socketClient.on('service:request', handleServiceRequest);
    socketClient.on('service:completed', handleServiceCompleted);

    return () => {
      socketClient.off('service:request', handleServiceRequest);
      socketClient.off('service:completed', handleServiceCompleted);
    };
  }, [helper?.isAvailable, toast, fetchTotalJobs]);

  const handleAcceptRequest = async () => {
    if (!pendingRequest) return;
    
    setIsAccepting(true);
    try {
      // Ensure realtime socket is connected when accepting so we receive updates immediately
      if (!socketClient.isConnected()) {
        socketClient.connect();
      }

      const serviceId = pendingRequest.id;
      const response = await apiClient.acceptService(serviceId);
      if (response.success) {
        toast({
          title: 'Request Accepted!',
          description: 'Navigating to job details...',
        });
        setPendingRequest(null);
        setResponseDeadline(null);
        setRequestCountdown(0);
        navigate(`/jobs/${serviceId}`);
      } else {
        // Provide specific error messages based on response error text
        let errorMsg = 'Request may have been taken by another helper';
        if (response.error) {
          const err = response.error.toLowerCase();
          if (err.includes('already') || err.includes('accepted')) {
            errorMsg = 'This request was already accepted by another helper';
          } else if (err.includes('permission') || err.includes('authorized')) {
            errorMsg = 'You do not have permission to accept this request';
          } else if (err.includes('active')) {
            errorMsg = 'You already have an active service. Complete it before accepting new requests.';
          } else {
            errorMsg = response.error;
          }
        }
        toast({
          title: 'Failed to Accept',
          description: errorMsg,
          variant: 'destructive',
        });
        setPendingRequest(null);
        setResponseDeadline(null);
        setRequestCountdown(0);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to accept request';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineRequest = useCallback(
    async (auto = false) => {
      if (!pendingRequest) return;
      const serviceId = pendingRequest.id;
      try {
        const response = await apiClient.declineService(serviceId);
        if (!auto && response.success) {
          toast({
            title: 'Request Declined',
            description: 'Waiting for new requests...',
          });
        }
      } catch (error) {
        if (!auto) {
          toast({
            title: 'Could not decline request',
            description: 'Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        setPendingRequest(null);
        setResponseDeadline(null);
        setRequestCountdown(0);
      }
    },
    [pendingRequest, toast]
  );

  useEffect(() => {
    if (!pendingRequest || !responseDeadline) {
      return;
    }

    let hasExpired = false;
    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((responseDeadline - Date.now()) / 1000));
      setRequestCountdown(remainingSeconds);
      if (remainingSeconds <= 0 && !hasExpired) {
        hasExpired = true;
        toast({
          title: 'Request timed out',
          description: 'We are notifying the next nearest helper.',
        });
        handleDeclineRequest(true);
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [pendingRequest, responseDeadline, handleDeclineRequest, toast]);

  useEffect(() => {
    if (!pendingRequest) {
      setRequestCountdown(0);
      setResponseDeadline(null);
    }
  }, [pendingRequest]);

  const formatHours = (h: number) => {
    if (h >= 1) return `${h} h`;
    const mins = Math.round(h * 60);
    return `${mins} m`;
  };

  const stats = [
    { label: 'Rating', value: helper?.rating?.toFixed(1) || '—', icon: Star },
    { label: 'Total Jobs', value: loadingStats ? '...' : totalJobs.toString(), icon: TrendingUp },
    { label: 'Hours Online', value: loadingHours ? '...' : (hoursOnline !== null ? formatHours(hoursOnline) : '—'), icon: Clock },
    { label: 'Active', value: helper?.isAvailable ? 'Yes' : 'No', icon: Award },
  ];

  const { error: locationError } = useLocation({ enabled: !!helper?.isAvailable, helperId: helper?.id, updateInterval: 5000 });

  return (
    <PremiumPage title={`Welcome back${helper?.userId ? ', helper' : ''}`} subtitle="Here’s your dashboard — stay sharp." headerExtra={
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${socketConnected ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'}`}>
            {socketConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {socketConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-muted-foreground/20 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" /> {helper?.isAvailable ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>
    }>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Profile / availability */}
        <aside className="lg:col-span-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl bg-gradient-to-br from-white/60 to-white/30 p-6 shadow-xl border border-white/10 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">{(helper?.userId || 'H').charAt(0)}</div>
              <div>
                <h2 className="text-lg font-bold">{helper?.userId ? 'Your dashboard' : 'Hello, Guest'}</h2>
                <p className="text-sm text-muted-foreground">{helper?.userId ? helper.userId : 'Sign in to receive jobs'}</p>
              </div>
            </div>

            <div className="mt-6">
              <AvailabilityToggle className="w-full" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {stats.slice(0, 2).map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-white/60 border border-white/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground pl-1 whitespace-nowrap">{s.label}</p>
                      <p className="text-xl font-semibold">{s.value}</p>
                    </div>
                    <s.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <EarningsSummary />
            </div>
          </motion.div>

          {/* compact tips / CTA */}
         
        </aside>

        {/* Right column: main content */}
        <section className="lg:col-span-8">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl p-6 bg-white/70 backdrop-blur border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Today</h3>
                <p className="text-sm text-muted-foreground">Live requests and activity</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Availability</div>
                  <AvailabilityToggle />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/30 text-sm font-medium">
                  {socketConnected ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-destructive" />}
                  <span className="text-sm">{socketConnected ? 'Realtime: On' : 'Realtime: Off'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-gradient-to-br from-white/60 to-white/40 border border-white/10 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground pl-1 whitespace-nowrap">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6">
              {activeService ? (
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-emerald-900">Active Job</h4>
                    <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-xs font-medium">In Progress</span>
                  </div>
                  <Button 
                    onClick={() => navigate(`/jobs/${activeService.id}`)} 
                    className="w-full"
                  >
                    View Job Details
                  </Button>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-muted-foreground/20 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">No Active Job</p>
                  <p className="text-sm">{helper?.isAvailable ? 'Waiting for service requests...' : 'Turn on availability to receive requests'}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Floating actions */}
          <div className="mt-5 flex gap-3 items-center"> 
            {/* <button onClick={() => navigate('/earnings')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-rose-500 text-white font-semibold shadow-md">Earnings</button> */}
            <button onClick={() => navigate('/history')} className="px-4 py-2 rounded-lg border border-white/10 bg-white/10 text-white">History</button>
            <div className="ml-auto text-sm text-muted-foreground">Tip: keep availability on to get matches</div>
          </div>
        </section>
      </div>

      {locationError && (
        <div className="mt-6 p-3 rounded-xl border border-warning/40 text-warning text-sm bg-warning/5">
          We couldn't get your location yet. Please enable location services to receive nearby requests.
        </div>
      )}

      {/* Pending request modal */}
      <AnimatePresence>
        {pendingRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)] overflow-y-auto flex flex-col"
            >
              <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-6 h-6" />
                    <h3 className="text-xl font-bold">New Service Request</h3>
                  </div>
                </div>
                <p className="text-white/90 text-sm">A patient needs your help nearby</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Type</p>
                  <p className="font-semibold text-lg">
                    {Array.isArray(pendingRequest.serviceType) 
                      ? pendingRequest.serviceType.join(', ') 
                      : pendingRequest.serviceType}
                  </p>
                </div>

                {pendingRequest.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{pendingRequest.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Location</p>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>
                      {pendingRequest.patientLocation?.landmark || 
                       `${pendingRequest.patientLocation?.lat.toFixed(4)}, ${pendingRequest.patientLocation?.lng.toFixed(4)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span>
                    {requestCountdown > 0
                      ? `Respond within ${requestCountdown}s`
                      : 'Request reassigned to the next helper'}
                  </span>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleDeclineRequest(false)}
                    className="flex-1"
                    disabled={isAccepting}
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={handleAcceptRequest}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500"
                    disabled={isAccepting || requestCountdown <= 0}
                  >
                    {isAccepting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Accept
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PremiumPage>
  );
}
