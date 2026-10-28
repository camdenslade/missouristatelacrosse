-- Saved apparel and gear sizes per player profile (carries across seasons), keyed by size
-- category, e.g. {"shirt": "M", "gloves": "Goalie"}. Order form items get a size_category so
-- a pick on one form can pre-fill the same kind of item on the next.
ALTER TABLE men.player_profiles ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '{}';
ALTER TABLE women.player_profiles ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '{}';
ALTER TABLE men.order_form_items ADD COLUMN IF NOT EXISTS size_category TEXT;
ALTER TABLE women.order_form_items ADD COLUMN IF NOT EXISTS size_category TEXT;

-- Categorize existing items that have sizes/options, by name. Same rules as
-- OrderFormController.inferSizeCategory().
UPDATE men.order_form_items SET size_category = CASE
    WHEN name ILIKE '%glove%' THEN 'gloves'
    WHEN name ILIKE '%hoodie%' OR name ILIKE '%sweatshirt%' THEN 'hoodie'
    WHEN name ILIKE '%pant%' OR name ILIKE '%jogger%' THEN 'pants'
    WHEN name ILIKE '%short%' THEN 'shorts'
    WHEN name ILIKE '%polo%' THEN 'polo'
    WHEN name ILIKE '%jersey%' THEN 'jersey'
    WHEN name ILIKE '%shirt%' OR name ILIKE '%tee%' THEN 'shirt'
END
WHERE size_category IS NULL AND options IS NOT NULL AND jsonb_array_length(options) > 0;

UPDATE women.order_form_items SET size_category = CASE
    WHEN name ILIKE '%glove%' THEN 'gloves'
    WHEN name ILIKE '%hoodie%' OR name ILIKE '%sweatshirt%' THEN 'hoodie'
    WHEN name ILIKE '%pant%' OR name ILIKE '%jogger%' THEN 'pants'
    WHEN name ILIKE '%short%' THEN 'shorts'
    WHEN name ILIKE '%polo%' THEN 'polo'
    WHEN name ILIKE '%jersey%' THEN 'jersey'
    WHEN name ILIKE '%shirt%' OR name ILIKE '%tee%' THEN 'shirt'
END
WHERE size_category IS NULL AND options IS NOT NULL AND jsonb_array_length(options) > 0;

-- Seed saved sizes from orders already submitted: the most recent pick per category.
UPDATE men.player_profiles prof
   SET sizes = picked.sizes
  FROM (
    SELECT latest.profile_id, jsonb_object_agg(latest.category, latest.size) AS sizes
      FROM (
        SELECT DISTINCT ON (p.profile_id, i.size_category)
               p.profile_id, i.size_category AS category, line->>'option' AS size
          FROM men.order_form_submissions s
          JOIN men.players p ON p.id = s.player_id
          CROSS JOIN LATERAL jsonb_array_elements(s.selections) AS line
          JOIN men.order_form_items i ON i.id::text = line->>'itemId'
         WHERE p.profile_id IS NOT NULL
           AND i.size_category IS NOT NULL
           AND coalesce(line->>'option', '') <> ''
         ORDER BY p.profile_id, i.size_category, s.created_at DESC
      ) latest
     GROUP BY latest.profile_id
  ) picked
 WHERE prof.id = picked.profile_id;

UPDATE women.player_profiles prof
   SET sizes = picked.sizes
  FROM (
    SELECT latest.profile_id, jsonb_object_agg(latest.category, latest.size) AS sizes
      FROM (
        SELECT DISTINCT ON (p.profile_id, i.size_category)
               p.profile_id, i.size_category AS category, line->>'option' AS size
          FROM women.order_form_submissions s
          JOIN women.players p ON p.id = s.player_id
          CROSS JOIN LATERAL jsonb_array_elements(s.selections) AS line
          JOIN women.order_form_items i ON i.id::text = line->>'itemId'
         WHERE p.profile_id IS NOT NULL
           AND i.size_category IS NOT NULL
           AND coalesce(line->>'option', '') <> ''
         ORDER BY p.profile_id, i.size_category, s.created_at DESC
      ) latest
     GROUP BY latest.profile_id
  ) picked
 WHERE prof.id = picked.profile_id;
