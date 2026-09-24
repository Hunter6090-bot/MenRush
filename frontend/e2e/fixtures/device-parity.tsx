import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { MapFloatingChrome } from '../../src/components/MapFloatingChrome';
import { ProfileDrawer } from '../../src/components/ProfileDrawer';
import { AppUpdateNotice } from '../../src/components/AppUpdateNotice';
import { applyTheme } from '../../src/lib/theme';
import '../../src/styles/menrush-tokens.css';
import '../../src/styles/globals.css';

applyTheme(new URLSearchParams(location.search).get('theme') === 'light' ? 'light' : 'dark');
function Fixture() {
  const [expanded, setExpanded] = useState(false);
  const [hotspots, setHotspots] = useState(false);
  const [people, setPeople] = useState(true);
  const [fuzz, setFuzz] = useState(200);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState(false);
  return <MemoryRouter>
    <div data-testid="map-panel" className="relative overflow-hidden" style={{ height: expanded ? '85dvh' : 320, minHeight: 280, background: 'var(--bg-elevated)' }}>
      <MapFloatingChrome expanded={expanded} mapPinFuzzM={fuzz} onMapPinFuzzChange={setFuzz}
        onToggleExpand={() => setExpanded(!expanded)} showHide onHide={() => {}}
        peopleLayerOn={people} hotSpotsLayerOn={hotspots} onTogglePeopleLayer={() => setPeople(!people)}
        onToggleHotSpotsLayer={() => setHotspots(!hotspots)} onOpenCruisingSearch={() => setSearch(!search)} showPrivacyNote />
    </div>
    {search && <p role="status">Search requested</p>}
    <button className="min-h-11 p-3" onClick={() => setProfile(true)}>Open legacy profile</button>
    <label className="block p-3">Draft<textarea aria-label="Draft" className="block w-full border" /></label>
    <div style={{ height: 700 }} />
    <button className="min-h-11 p-3">End of form</button>
    <AppUpdateNotice enabled buildId="fixture-old" />
    <ProfileDrawer user={profile ? { id: 'legacy-fixture', name: 'COSTAMAN1965', age: 60, photo_url: 'https://menrush.com/avatars/generic/09.svg?old=1', cover_url: '/avatars/generic/09.svg', online: false, distance_km: 1 } : null}
      liked={false} onClose={() => setProfile(false)} onLike={() => {}} onMessage={() => {}} />
  </MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
