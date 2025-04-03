import React, { createContext, useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';

export const GoogleMapsContext = createContext();

const libraries = ['places'];

export function GoogleMapsProvider({ children }) {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <LoadScript
            googleMapsApiKey={GOOGLE_MAPS_API_KEY}
            libraries={libraries}
            onLoad={() => setIsLoaded(true)}
        >
            <GoogleMapsContext.Provider value={{ isLoaded }}>
                {children}
            </GoogleMapsContext.Provider>
        </LoadScript>
    );
} 