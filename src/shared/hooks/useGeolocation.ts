import { useState, useEffect, useCallback } from 'react';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface GeolocationState {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
}

export const useGeoLocation = (watch = false) => {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    isLoading: true,
  });

  const updateLocation = useCallback((position: GeolocationPosition) => {
    setState({
      location: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
      error: null,
      isLoading: false,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState({
      location: null,
      error: error.message,
      isLoading: false,
    });
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        location: null,
        error: 'Geolocation is not supported by your browser',
        isLoading: false,
      });
      return;
    }

    // Try to get a high-accuracy fix first, but fall back to a lower-accuracy
    // request if we hit a timeout. This helps in indoor / weak-signal cases.
    setState((prev) => ({ ...prev, isLoading: true }));

    const tryHighAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        (err) => {
          // If timed out, try once more with lower accuracy and longer timeout
          if (err && err.code === err.TIMEOUT) {
            navigator.geolocation.getCurrentPosition(
              updateLocation,
              handleError,
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
            );
          } else {
            handleError(err);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    };

    tryHighAccuracy();
  }, [updateLocation, handleError]);

  useEffect(() => {
    if (!watch) {
      getCurrentLocation();
      return;
    }

    if (!navigator.geolocation) {
      setState({
        location: null,
        error: 'Geolocation is not supported by your browser',
        isLoading: false,
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [watch, updateLocation, handleError, getCurrentLocation]);

  return {
    ...state,
    refetch: getCurrentLocation,
  };
};
