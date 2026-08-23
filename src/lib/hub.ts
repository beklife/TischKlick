import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export type HubBlockKind = 'menu' | 'review' | 'custom';

export type HubBlock = {
  id: string;
  kind: HubBlockKind;
  label: string;
  icon: string | null;
  url: string | null;
  enabled: boolean;
  position: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  dietTags: string[];
  allergens: string[];
  additives: string[];
  imageUrl: string | null;
  soldOut: boolean;
};

export type MenuCategory = {id: string; name: string; items: MenuItem[]};

// Pure so the two rules that keep a guest from ever reaching a dead end are
// testable without a database:
//   1. a menu block with nothing behind it is not shown,
//   2. an empty result tells the caller to fall back to the star rating.
export function visibleHubBlocks(blocks: HubBlock[], opts: {hasMenuItems: boolean}): HubBlock[] {
  return blocks
    .filter((b) => b.enabled)
    .filter((b) => b.kind !== 'menu' || opts.hasMenuItems)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

type LinkRow = {
  id: string;
  kind: HubBlockKind;
  label: string;
  icon: string | null;
  url: string | null;
  enabled: boolean;
  position: number;
};

export async function getVenueHubBlocks(venueId: string): Promise<HubBlock[]> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('venue_links')
    .select('id, kind, label, icon, url, enabled, position')
    .eq('venue_id', venueId);
  if (error) throw error;
  return (data ?? []) as LinkRow[];
}

export async function venueHasMenuItems(venueId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const {count, error} = await supabase
    .from('menu_items')
    .select('id', {count: 'exact', head: true})
    .eq('venue_id', venueId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

type MenuRow = {
  id: string;
  name: string;
  position: number;
  menu_items: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number | null;
    diet_tags: string[];
    allergens: string[];
    additives: string[];
    image_url: string | null;
    sold_out: boolean;
    position: number;
  }>;
};

export async function getVenueMenu(venueId: string): Promise<MenuCategory[]> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('menu_categories')
    .select(
      'id, name, position, menu_items (id, name, description, price_cents, diet_tags, allergens, additives, image_url, sold_out, position)'
    )
    .eq('venue_id', venueId)
    .order('position');
  if (error) throw error;

  // PostgREST resolves the embed through the single foreign key between the two
  // tables (menu_items_category_same_venue). If it ever reports an ambiguous or
  // missing relationship, name it explicitly: `menu_items!menu_items_category_same_venue (...)`.
  //
  // Sorting categories and items in JS rather than via order(): the rows come back
  // unordered or partially ordered often enough that relying on the database alone
  // would be a lottery. Tied positions are legal because the indexes are not unique —
  // the dashboard's reordering can produce them transiently.
  return (((data ?? []) as unknown as MenuRow[])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: [...c.menu_items]
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          priceCents: i.price_cents,
          dietTags: i.diet_tags,
          allergens: i.allergens,
          additives: i.additives,
          imageUrl: i.image_url,
          soldOut: i.sold_out
        }))
    })));
}
