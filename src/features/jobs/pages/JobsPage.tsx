import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/core/api/client';
import { socketClient } from '@/core/socket/client';
import type { Service } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth';
import { Map } from '@/shared/components';
import { useLocation } from '@/hooks/useLocation';
import { RatingModal } from '@/shared/components';
import {
  MapPin,
  CheckCircle,
  Phone,
  Navigation,
  ArrowLeft,
  User,
  AlertCircle,
  Loader2,
  Star,
  MessageCircle,
} from 'lucide-react';
import PremiumPage from '@/components/layout/PremiumPage';
import { ChatWindow } from '@/features/chat/ChatWindow';
import EarningsBreakdown from '../components/EarningsBreakdown';

export default function JobsPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { helper } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isArriving, setIsArriving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [hasMarkedArrival, setHasMarkedArrival] = useState(false);
  const [patientLocation, setPatientLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Get helper's current location (enabled only when we have a helper ID)
  const { location: helperLocation } = useLocation({
    enabled: !!helper?.id,
    helperId: helper?.id,
    updateInterval: 10000, // Update every 10 seconds
  });

  const fetchService = useCallback(async () => {
    if (!serviceId) return;
    
    try {
      const response = await apiClient.getService(serviceId);
      if (response.success && response.data) {
        const svc = response.data as Service;
        setService(svc);
        
        // Set patient location from service data
        if (svc.patientLocation) {
          setPatientLocation(svc.patientLocation);
        }
      } else {
        toast({
          title: 'Service Not Found',
          description: 'This service may have been cancelled',
          variant: 'destructive',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch service details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [serviceId, navigate, toast]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  // Listen for realtime updates
  useEffect(() => {
    const handleServiceUpdated = () => {
      fetchService();
    };

    const handleServiceCancelled = (data: any) => {
      if (data?.serviceId === serviceId || data?.service?.id === serviceId) {
        toast({
          title: 'Service Cancelled',
          description: 'The patient cancelled this service',
          variant: 'destructive',
        });
        navigate('/dashboard');
      }
    };

    socketClient.on('service:updated', handleServiceUpdated);
    socketClient.on('service:cancelled', handleServiceCancelled);

    return () => {
      socketClient.off('service:updated', handleServiceUpdated);
      socketClient.off('service:cancelled', handleServiceCancelled);
    };
  }, [serviceId, fetchService, navigate, toast]);

  const handleVerifyOtp = async () => {
    if (!serviceId || !otp.trim()) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiClient.verifyServiceOtp(serviceId, otp);
      if (response.success) {
        toast({
          title: 'OTP Verified!',
          description: 'Service has started',
        });
        setOtp('');
        // Refresh service data to show started state
        await fetchService();
        // The page will automatically update to show the started service UI
      } else {
        toast({
          title: 'Verification Failed',
          description: response.error || 'Invalid OTP',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify OTP',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleMarkArrival = async () => {
    if (!serviceId) return;

    setIsArriving(true);
    try {
      const response = await apiClient.arriveService(serviceId);
      if (response.success) {
        setHasMarkedArrival(true);
        toast({
          title: 'Arrival Confirmed!',
          description: 'Now verify the patient\'s OTP to start the service',
        });
        fetchService();
      } else {
        toast({
          title: 'Failed',
          description: response.error || 'Could not mark arrival',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark arrival',
        variant: 'destructive',
      });
    } finally {
      setIsArriving(false);
    }
  };

  const handleCompleteService = async () => {
    if (!serviceId) return;

    setIsCompleting(true);
    try {
      const response = await apiClient.completeService(serviceId);
      if (response.success) {
        toast({
          title: 'Service Completed!',
          description: 'Redirecting to payment receiving page...',
        });
        // Navigate to payment receiving page after completing service
        setTimeout(() => {
          navigate(`/payment/${serviceId}`);
        }, 1000);
      } else {
        toast({
          title: 'Failed',
          description: response.error || 'Could not complete service',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete service',
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!serviceId) return;

    try {
      const response = await apiClient.rateService(serviceId, rating, comment);
      if (response.success) {
        toast({
          title: 'Thank you!',
          description: 'Your rating has been submitted.',
        });
        setShowRatingModal(false);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        toast({
          title: 'Failed',
          description: response.error || 'Could not submit rating',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit rating',
        variant: 'destructive',
      });
    }
  };

  const handleSkipRating = () => {
    setShowRatingModal(false);
    setTimeout(() => navigate('/dashboard'), 500);
  };

  if (loading) {
    return (
      <PremiumPage title="Loading..." subtitle="Fetching job details">
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

  const isOtpVerified = (service as any).otpVerified === true;
  // Backend uses 'STARTED' status, frontend types have 'IN_PROGRESS'
  const statusStr = String(service.status);
  const isStarted = statusStr === 'STARTED' || statusStr === 'IN_PROGRESS';
  const isAccepted = statusStr === 'ACCEPTED';
  const isArrived = hasMarkedArrival && isAccepted && !isOtpVerified;

  return (
    <>
    <PremiumPage
      title="Active Job"
      subtitle={`Service ${service.id?.slice(0, 8) || 'N/A'}`}
      headerExtra={
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Job Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Status Card */}
          <div className="rounded-2xl bg-white p-6 shadow-xl border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Service Status</h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isStarted
                    ? 'bg-blue-100 text-blue-700'
                    : isArrived
                    ? 'bg-purple-100 text-purple-700'
                    : isAccepted
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {service.status}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Service Type</p>
                <p className="font-semibold text-lg">
                  {Array.isArray(service.serviceType)
                    ? service.serviceType.join(', ')
                    : service.serviceType}
                </p>
              </div>

              {service.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{service.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Patient Location</p>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <span>
                    {service.patientLocation?.landmark ||
                      `${service.patientLocation?.lat.toFixed(4)}, ${service.patientLocation?.lng.toFixed(4)}`}
                  </span>
                </div>
              </div>

              {service.patientUser && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Patient</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{service.patientUser.name || 'Patient'}</p>
                        {service.patient?.avgRating && service.patient.avgRating > 0 && (
                          <div className="flex items-center gap-1 text-xs bg-yellow-50 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold">{service.patient.avgRating.toFixed(1)}</span>
                            <span className="text-muted-foreground">({service.patient.totalRatings})</span>
                          </div>
                        )}
                      </div>
                      {service.patientUser.phone && (
                        <a
                          href={`tel:${service.patientUser.phone}`}
                          className="text-sm text-blue-600 flex items-center gap-1 mt-1"
                        >
                          <Phone className="w-3 h-3" />
                          {service.patientUser.phone}
                        </a>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowChat(true)}
                      className="ml-auto"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Card */}
          {service.status !== 'COMPLETED' && service.status !== 'CANCELLED' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white p-6 shadow-xl border"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Navigation</h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (patientLocation) {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${patientLocation.lat},${patientLocation.lng}`,
                      '_blank'
                    );
                  }
                }}
              >
                <Navigation className="w-4 h-4" />
                Open in Maps
              </Button>
            </div>
            
            {patientLocation ? (
              <Map
                center={helperLocation || patientLocation}
                markers={[
                  {
                    position: patientLocation,
                    popup: 'Patient Location',
                    type: 'patient',
                  },
                  ...(helperLocation
                    ? [
                        {
                          position: helperLocation,
                          popup: 'Your Location',
                          type: 'helper' as const,
                        },
                      ]
                    : []),
                ]}
                height="400px"
                zoom={17}
                disabled={showRatingModal || showChat}
                fitToMarkers
                className="bg-muted/40 dark:bg-slate-900/40"
              />
            ) : (
              <div className="h-[400px] flex items-center justify-center bg-muted rounded-xl">
                <p className="text-muted-foreground">Loading map...</p>
              </div>
            )}
          </motion.div>
          )}

          {/* OTP Display - Show as soon as service is accepted */}
          {isAccepted && service.otpCode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white shadow-lg mb-4"
            >
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                OTP Code (Share with Patient)
              </div>
              <div className="flex items-center justify-between bg-white/20 rounded-lg p-3 backdrop-blur">
                <div className="font-mono text-3xl font-bold tracking-widest">
                  {service.otpCode}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => {
                    navigator.clipboard.writeText(service.otpCode!);
                    toast({ title: 'OTP copied!', variant: 'default' });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-white/90 mt-2">
                This code will be verified when you arrive at the patient's location
              </p>
            </motion.div>
          )}

          {/* OTP Verification Card - ONLY AFTER ARRIVAL */}
          {isArrived && !isOtpVerified && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 border border-purple-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-900">Verify OTP to Start Service</h3>
              </div>
              <p className="text-sm text-purple-800 mb-4">
                Enter the OTP code shown above to begin the service
              </p>
              <div className="flex gap-3 mb-3">
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1"
                  maxLength={6}
                />
                <Button
                  onClick={handleVerifyOtp}
                  disabled={isVerifying || otp.length !== 6}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Start'}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowChat(true)}
                className="w-full"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with Patient
              </Button>
            </motion.div>
          )}

          {/* Arrival Card - FIRST STEP AFTER ACCEPTANCE */}
          {isAccepted && !isArrived && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 p-6 border border-blue-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <Navigation className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-blue-900">Navigate to Patient Location</h3>
              </div>
              <p className="text-sm text-blue-800 mb-4">
                Once you've reached the patient's location, mark your arrival. You'll then verify the OTP to start the service.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleMarkArrival}
                  disabled={isArriving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isArriving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Marking Arrival...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      I've Arrived
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowChat(true)}
                  className="flex-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat with Patient
                </Button>
              </div>
            </motion.div>
          )}

          {/* Complete Service Card */}
          {isStarted && service.status !== 'COMPLETED' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 p-6 border border-emerald-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-900">Complete Service</h3>
              </div>
              <p className="text-sm text-emerald-800 mb-4">
                Once you've finished helping the patient, mark the service as complete
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleCompleteService}
                  disabled={isCompleting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Service
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowChat(true)}
                  className="flex-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat with Patient
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Right: Progress Tracker */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl bg-white p-6 shadow-xl border h-fit"
        >
          <h3 className="text-lg font-bold mb-6">Progress</h3>
          <div className="space-y-4">
            {/* Step 1: Accepted */}
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isAccepted || isArrived || isStarted ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isAccepted || isArrived || isStarted ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Service Accepted</p>
                <p className="text-xs text-muted-foreground">Request confirmed</p>
              </div>
            </div>

            {/* Step 2: Arrived at Location */}
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isArrived || isStarted ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isArrived || isStarted ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Arrived at Location</p>
                <p className="text-xs text-muted-foreground">Reached patient</p>
              </div>
            </div>

            {/* Step 3: OTP Verified */}
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isOtpVerified ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isOtpVerified ? <CheckCircle className="w-5 h-5" /> : '3'}
              </div>
              <div className="flex-1">
                <p className="font-medium">OTP Verified & Started</p>
                <p className="text-xs text-muted-foreground">Service in progress</p>
              </div>
            </div>

            {/* Step 4: Completed */}
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  service.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {service.status === 'COMPLETED' ? <CheckCircle className="w-5 h-5" /> : '4'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Service Completed</p>
                <p className="text-xs text-muted-foreground">Job finished</p>
              </div>
            </div>
          </div>

          {service.status === 'COMPLETED' && service.fare && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Total Fare</span>
                <span className="font-bold text-lg text-slate-700">
                  ₹{service.fare.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your Earnings</span>
                <span className="font-bold text-lg text-emerald-600">
                  ₹{((service as any).billedMinutes || 0) * 2.5}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Earnings Breakdown - Show after completion */}
      {service.status === 'COMPLETED' && (
        <div className="mt-6">
          <EarningsBreakdown service={service} />
        </div>
      )}
    </PremiumPage>

    {/* Rating Modal */}
    <RatingModal
      isOpen={showRatingModal}
      onClose={handleSkipRating}
      onSubmit={handleSubmitRating}
      personName={service?.patient?.name || 'Patient'}
      personType="patient"
    />

    {/* Chat Window */}
    {showChat && service && (
      <ChatWindow
        serviceId={service.id}
        patientName={service.patient?.name || 'Patient'}
        onClose={() => setShowChat(false)}
      />
    )}
    </>
  );
}
