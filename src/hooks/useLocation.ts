import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/core/api/client';
import { socketClient } from '@/core/socket/client';

// Local lightweight type for location updates (do not depend on a missing export)
interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number | null;
  timestamp?: number;
}

interface UseLocationOptions {
  enabled: boolean;
  helperId?: string;
  updateInterval?: number;
}

export const useLocation = ({ enabled, helperId, updateInterval = 5000 }: UseLocationOptions) => {
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const watchIdRef = useRef<number | null>(null);
  const retryRef = useRef<number>(0);
  // track last time we emitted an update to avoid spamming socket/api
  const lastEmitRef = useRef<number>(0);
  const apiCooldownRef = useRef<number>(0);
  const permissionCheckedRef = useRef<boolean>(false);

  const updateLocation = useCallback(
    async (position: GeolocationPosition) => {
      const locationData: LocationUpdate = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      setLocation(locationData);

      if (helperId && enabled) {
        const now = Date.now();
        // If we're under a client-side API cooldown (due to recent 429), skip emits
        if (apiCooldownRef.current > Date.now()) return;
        // only emit if enough time has passed since last emit
        if (now - lastEmitRef.current >= updateInterval) {
          lastEmitRef.current = now;

          // Send via socket for real-time
          socketClient.emit('helper:location:update', locationData);

          // Also send via API as backup
          try {
            // apiClient.updateLocation expects (helperId, lat, lng)
            const resp = await apiClient.updateLocation(helperId, locationData.lat, locationData.lng) as any;
            // If server signalled a rate limit or client-side cooldown, set a short cooldown
            if (resp && resp.success === false) {
              const errMsg = (resp.error || '').toLowerCase();
              if (errMsg.includes('rate') || errMsg.includes('too many') || errMsg.includes('cooldown')) {
                // apply a 30s client-side cooldown to avoid immediate replays
                apiCooldownRef.current = Date.now() + 30_000;
                setError('Server is rate limiting location updates. Pausing updates for 30s.');
              }
            }
          } catch (err) {
            console.error('Failed to update location via API:', err);
          }
        }
      }
    },
    [helperId, enabled, updateInterval]
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    // Handle permission denied specifically
    if (error.code === error.PERMISSION_DENIED) {
      setPermissionStatus('denied');
      setError('Location permission denied. Please enable location access in your browser settings.');
      console.warn('Location permission denied');
      return;
    }

    // Surface the message to UI and log for diagnostics, but avoid throwing
    const friendly = (error && error.message) ? error.message : 'Unknown geolocation error';
    // Provide a slightly more helpful message for timeouts
    const msg = friendly.includes('Timeout') || friendly.toLowerCase().includes('timeout')
      ? 'Location timeout — move to an area with better GPS signal or try again.'
      : friendly;
    setError(msg);
    // Use warn to avoid noisy stack traces in some dev tools
    console.warn('Location error:', error);

    // Timeout code is 3 per spec. Some browsers may not expose constants on the error object.
    const TIMEOUT_CODE = 3;

    // If we hit a timeout while watching position, try a single lower-accuracy
    // getCurrentPosition as a fallback. This often succeeds indoors.
    try {
      if (error && error.code === TIMEOUT_CODE && navigator.geolocation) {
        // Try a quick low-accuracy read as fallback; give it more time on flaky devices
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // success — emit the fallback position and reset retry counter
            updateLocation(pos);
            retryRef.current = 0;
            setError(null);
          },
          (e) => {
            console.debug('Fallback geolocation failed:', e);
            // schedule a backoff before attempting to re-watch
            retryRef.current = Math.min(5, retryRef.current + 1);
            const backoffMs = 3000 * Math.pow(2, retryRef.current - 1);
            setTimeout(() => {
              try {
                // restart watcher with a larger timeout to give device more time
                if (navigator.geolocation) {
                  if (watchIdRef.current) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                    watchIdRef.current = null;
                  }
                  // increase the timeout progressively up to 2 minutes
                  const t = Math.min(120000, 30000 * Math.pow(2, retryRef.current - 1));
                  const newId = navigator.geolocation.watchPosition(updateLocation, handleError, {
                    enableHighAccuracy: true,
                    timeout: t,
                    maximumAge: 0,
                  });
                  watchIdRef.current = newId;
                  setWatchId(newId);
                }
              } catch (ee) {
                // ignore
              }
            }, backoffMs);
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
        );
      }
    } catch (e) {
      // ignore
    }
  }, [updateLocation]);

  // Request location permission before starting watch
  const requestLocationPermission = useCallback(async () => {
    if (permissionCheckedRef.current) return true;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return false;
    }

    try {
      // Check if Permissions API is available
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state);
        
        if (result.state === 'denied') {
          setError('Location permission denied. Please enable it in your browser settings.');
          return false;
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionStatus(result.state);
          if (result.state === 'denied') {
            setError('Location permission has been revoked');
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
              setWatchId(null);
            }
          }
        });
      }
      
      permissionCheckedRef.current = true;
      return true;
    } catch (err) {
      console.warn('Permissions API not available:', err);
      permissionCheckedRef.current = true;
      return true;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !helperId) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    // Request permission first
    requestLocationPermission().then((hasPermission) => {
      if (!hasPermission) return;

      // start watcher with configurable timeout; if retries have happened use a larger timeout
      // Start with a more generous initial timeout (30s) to reduce 'Timeout expired' in poor GPS conditions.
      const initialTimeout = Math.min(120000, 30000 * Math.pow(2, Math.max(0, retryRef.current)));
      const id = navigator.geolocation.watchPosition(updateLocation, handleError, {
        enableHighAccuracy: true,
        timeout: initialTimeout,
        maximumAge: 0,
      });

      watchIdRef.current = id;
      setWatchId(id);
    });

    return () => {
      try {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      } catch (e) {
        // ignore
      }
    };
  }, [enabled, helperId, updateLocation, handleError, requestLocationPermission]);

  return { location, error, permissionStatus };
};

