import {getTableByCode, recordTap, cleanTapId} from '@/lib/guest';
import {getVenueHubBlocks, venueHasMenuItems, visibleHubBlocks} from '@/lib/hub';
import {InvalidLink} from '../invalid-link';
import {StarRating} from './star-rating';
import {Hub} from './hub';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function GuestEntryPage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  if (!table) return <InvalidLink />;

  // A tap is recorded once per NFC touch. Coming back here from the menu carries
  // ?t= along, so Hub → Karte → back stays a single tap_event.
  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));

  if (table.venue.hubEnabled) {
    const [blocks, hasMenuItems] = await Promise.all([
      getVenueHubBlocks(table.venue.id),
      venueHasMenuItems(table.venue.id)
    ]);
    const visible = visibleHubBlocks(blocks, {hasMenuItems});
    // Every block hidden would be a dead end — fall through to the stars.
    if (visible.length > 0) {
      return <Hub code={code} tapId={tapId} venue={table.venue} blocks={visible} />;
    }
  }

  return <StarRating code={code} tapId={tapId} venue={table.venue} />;
}
