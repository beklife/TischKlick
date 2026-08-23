import {getTableByCode, recordTap, cleanTapId} from '@/lib/guest';
import {InvalidLink} from '../../invalid-link';
import {StarRating} from '../star-rating';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function BewertenPage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  if (!table) return <InvalidLink />;

  // Reached from the hub with ?t=; a direct visit (shared link) starts its own tap.
  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));
  return <StarRating code={code} tapId={tapId} venue={table.venue} />;
}
