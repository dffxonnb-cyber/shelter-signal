SELECT source, desertion_no, COUNT(*) AS duplicate_count
FROM raw.rescued_animals
GROUP BY source, desertion_no
HAVING COUNT(*) > 1;
