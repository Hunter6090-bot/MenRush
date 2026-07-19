import { RadiusMilesSelect } from './RadiusMilesSelect';

interface DiscoveryFilterPillsProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
}

export function DiscoveryFilterPills({ radiusKm, onRadiusChange }: DiscoveryFilterPillsProps) {
  return (
    <RadiusMilesSelect valueKm={radiusKm} onChange={onRadiusChange} id="discover-radius-miles" />
  );
}