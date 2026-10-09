'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { revalidatePath } from 'next/cache';
import type { Category, CatalogItem } from '@/types/database';

export async function getCatalogAndCategoriesAction(householdId: string): Promise<{
  categories: Category[];
  catalogItems: CatalogItem[];
}> {
  try {
    const supabase = await getSupabaseServer();

    let { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('name');

    // If no categories yet, try seeding defaults
    if (!categories || categories.length === 0) {
      await supabase.rpc('seed_household_defaults', { p_household_id: householdId });
      const { data: seededCats } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId)
        .order('name');
      categories = seededCats;
    }

    const { data: catalogItems } = await supabase
      .from('catalog_items')
      .select('*, category:categories(*)')
      .eq('household_id', householdId)
      .order('name');

    return {
      categories: (categories || []) as Category[],
      catalogItems: (catalogItems || []) as CatalogItem[],
    };
  } catch (err) {
    console.error('getCatalogAndCategoriesAction error:', err);
    return { categories: [], catalogItems: [] };
  }
}

export async function addCustomCatalogItemAction(input: {
  householdId: string;
  categoryId: string;
  name: string;
  suggestedPricePaise: bigint;
  unit: string;
}) {
  const { householdId, categoryId, name, suggestedPricePaise, unit } = input;

  if (!name.trim()) {
    return { success: false, error: 'Item name is required.' };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      household_id: householdId,
      category_id: categoryId,
      name: name.trim(),
      suggested_price: Number(suggestedPricePaise),
      unit: unit.trim() || 'item',
    })
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/expenses/add');
  return { success: true, item: data };
}
