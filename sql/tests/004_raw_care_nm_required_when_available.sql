SELECT source, desertion_no, care_reg_no, care_nm, care_tel, care_addr
FROM raw.rescued_animals
WHERE (
        NULLIF(btrim(care_reg_no), '') IS NOT NULL
        OR NULLIF(btrim(care_tel), '') IS NOT NULL
        OR NULLIF(btrim(care_addr), '') IS NOT NULL
    )
    AND NULLIF(btrim(care_nm), '') IS NULL;
