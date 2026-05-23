SELECT source, desertion_no, notice_edt
FROM raw.rescued_animals
WHERE notice_edt IS NULL;
