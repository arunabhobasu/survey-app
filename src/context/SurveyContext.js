'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import personasData from '../data/personas.json';

const SurveyContext = createContext();

export function SurveyProvider({ children }) {
  const [availablePersonas, setAvailablePersonas] = useState([]);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [usedPersonaIds, setUsedPersonaIds] = useState([]);
  const [studyId, setStudyId] = useState(null);

  useEffect(() => {
    // Generate a unique study ID for this session
    setStudyId(`study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Initialize personas
  useEffect(() => {
    setAvailablePersonas(personasData);
  }, []);

  const selectRandomPersona = () => {
    if (availablePersonas.length === 0) return;
    const randomIndex = Math.floor(Math.random() * availablePersonas.length);
    setCurrentPersona(availablePersonas[randomIndex]);
  };

  const markPersonaAsUsed = (id) => {
    setUsedPersonaIds((prev) => [...prev, id]);
    setAvailablePersonas((prev) => prev.filter((p) => p.id !== id));
    setCurrentPersona(null); // Clear current persona so they must pick a new one
  };

  return (
    <SurveyContext.Provider value={{
      availablePersonas,
      currentPersona,
      setCurrentPersona,
      usedPersonaIds,
      markPersonaAsUsed,
      selectRandomPersona,
      studyId
    }}>
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  return useContext(SurveyContext);
}
