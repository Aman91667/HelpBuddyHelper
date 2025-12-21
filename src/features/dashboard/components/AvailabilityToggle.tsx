import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/core/api/client';
import { useToast } from '@/hooks/use-toast';
import { Power, MapPin } from 'lucide-react';

export default function AvailabilityToggle({ className = '' }: { className?: string }) {
  const { helper, updateHelper } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const isAvailable = !!helper?.isAvailable;

  const handleToggle = async () => {
    // If user hasn't completed helper onboarding, try to re-fetch helper profile first
    if (!helper) {
      // Try to fetch helper profile in case it's just not loaded yet
      try {
        const helperResponse = await apiClient.getHelperProfile();
        if (helperResponse?.success && helperResponse.data) {
          updateHelper(helperResponse.data as any);
          
          // Retry the toggle with the newly loaded helper
          toast({ 
            title: 'Profile loaded', 
            description: 'Please try toggling again.' 
          });
          return;
        }
      } catch (e) {
        console.error('[AvailabilityToggle] Failed to fetch helper profile:', e);
      }
      
      // If still no helper, send to onboarding
      toast({ title: 'Complete onboarding', description: 'Finish helper registration to enable availability.' });
      navigate('/auth/helper');
      return;
    }

    // Check if helper.id exists
    if (!helper.id) {
      console.error('[AvailabilityToggle] helper.id is missing:', helper);
      toast({ 
        title: 'Error', 
        description: 'Helper profile incomplete. Please re-login.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    const newStatus = !isAvailable;

    try {
      const response = await apiClient.updateAvailability(helper.id, newStatus);

      if (response?.success && response.data) {
        updateHelper(response.data as any);

        toast({
          title: newStatus ? "You're Online!" : "You're Offline",
          description: newStatus ? 'You will now receive service requests.' : "You won't receive new requests.",
        });
      } else {
        console.error('[AvailabilityToggle] Update failed:', response);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: response?.error || 'Failed to update availability.',
        });
      }
    } catch (error) {
      console.error('[AvailabilityToggle] Exception:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update availability. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`border-none shadow-lg overflow-hidden ${className}`}>
      <div className={`h-1 w-full transition-all duration-500 ${isAvailable ? 'bg-gradient-to-r from-success to-success/80' : 'bg-muted'}`} />
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ scale: isAvailable ? [1, 1.06, 1] : 1 }}
              transition={{ repeat: isAvailable ? Infinity : 0, duration: 2 }}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAvailable ? 'bg-gradient-to-br from-success to-success/80 shadow-glow' : 'bg-muted'}`}
              aria-hidden
            >
              <Power className={`w-7 h-7 ${isAvailable ? 'text-success-foreground' : 'text-muted-foreground'}`} />
            </motion.div>

            <div>
              <h3 className="text-lg font-bold mb-0.5">{isAvailable ? "You're Online" : "You're Offline"}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {isAvailable ? 'Receiving requests nearby' : 'Toggle to start receiving requests'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={isAvailable}
              onCheckedChange={handleToggle}
              disabled={isLoading}
              className="data-[state=checked]:bg-success scale-110"
              aria-label={isAvailable ? 'Turn availability off' : 'Turn availability on'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
