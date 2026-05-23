SELECT source, desertion_no
FROM raw.rescued_animals
WHERE desertion_no IS NULL OR NULLIF(btrim(desertion_no), '') IS NULL;
