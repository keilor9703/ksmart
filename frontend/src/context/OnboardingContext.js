import React, { createContext, useContext, useState, useEffect } from 'react';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const [viewedGuides, setViewedGuides] = useState(() => {
    const saved = localStorage.getItem('onboarding_viewed_guides');
    return saved ? JSON.parse(saved) : {};
  });

  const [tooltipsVisible, setTooltipsVisible] = useState(true);

  // Sincronizar con localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_viewed_guides', JSON.stringify(viewedGuides));
  }, [viewedGuides]);

  // Fase 2: Aquí se podría integrar la llamada a la API para persistir en la DB
  const markGuideAsViewed = (guideId) => {
    setViewedGuides(prev => ({
      ...prev,
      [guideId]: true
    }));
  };

  const resetGuide = (guideId) => {
    setViewedGuides(prev => {
      const newState = { ...prev };
      delete newState[guideId];
      return newState;
    });
  };

  const toggleTooltips = () => {
    setTooltipsVisible(prev => !prev);
  };

  const value = {
    viewedGuides,
    markGuideAsViewed,
    resetGuide,
    tooltipsVisible,
    toggleTooltips,
    isGuideViewed: (guideId) => !!viewedGuides[guideId]
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
