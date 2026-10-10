import { IconPlane } from './icons';
import { visitingWithDates, type TravelVisiting } from '../lib/travel';

/** "Visiting Manchester, 10 to 12 Oct" on a profile. No distance: a visitor's pin is the city centre. */
export function VisitingBadge({ visiting }: { visiting: TravelVisiting }) {
  return (
    <p
      className="mt-1 inline-flex min-h-[28px] items-center gap-1.5 text-[15px] font-bold text-[var(--nn-text)]"
      data-testid="profile-visiting"
    >
      <span className="text-[var(--nn-accent-text)]">
        <IconPlane size={16} />
      </span>
      {visitingWithDates(visiting)}
    </p>
  );
}
