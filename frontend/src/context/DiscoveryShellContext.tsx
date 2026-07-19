import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface DiscoveryShellState {
  nearbyCount: number;
  radiusLabel: string;
  pulseOn: boolean;
  togglePulse?: () => void;
}

const defaultState: DiscoveryShellState = {
  nearbyCount: 0,
  radiusLabel: '5 miles',
  pulseOn: false,
};

const DiscoveryShellContext = createContext<{
  state: DiscoveryShellState;
  setState: (patch: Partial<DiscoveryShellState>) => void;
}>({
  state: defaultState,
  setState: () => undefined,
});

export function DiscoveryShellProvider({ children }: { children: ReactNode }) {
  const [state, setFullState] = useState<DiscoveryShellState>(defaultState);
  const value = useMemo(
    () => ({
      state,
      setState: (patch: Partial<DiscoveryShellState>) =>
        setFullState((prev) => ({ ...prev, ...patch })),
    }),
    [state],
  );
  return <DiscoveryShellContext.Provider value={value}>{children}</DiscoveryShellContext.Provider>;
}

export function useDiscoveryShell() {
  return useContext(DiscoveryShellContext);
}

export function DiscoveryShellPublisher({
  nearbyCount,
  radiusLabel,
  pulseOn,
  togglePulse,
}: DiscoveryShellState) {
  const { setState } = useDiscoveryShell();
  React.useEffect(() => {
    setState({ nearbyCount, radiusLabel, pulseOn, togglePulse });
    return () => setState(defaultState);
  }, [nearbyCount, radiusLabel, pulseOn, togglePulse, setState]);
  return null;
}
