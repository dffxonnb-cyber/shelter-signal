CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE IF NOT EXISTS raw.rescued_animals (
    source text NOT NULL DEFAULT 'animal_protection_api',
    desertion_no text NOT NULL,
    notice_no text,
    happen_dt date,
    happen_place text,
    notice_sdt date,
    notice_edt date,
    kind_full_nm text,
    up_kind_nm text,
    up_kind_nm_raw text,
    kind_cd text,
    kind_nm text,
    color_cd text,
    age text,
    weight text,
    popfile1 text,
    popfile2 text,
    process_state text,
    sex_cd text,
    neuter_yn text,
    special_mark text,
    care_reg_no text,
    care_nm text,
    care_tel text,
    care_addr text,
    care_owner_nm text,
    org_nm text,
    etc_bigo text,
    upd_tm timestamptz,
    collected_at timestamptz NOT NULL DEFAULT now(),
    raw_json jsonb NOT NULL,
    inserted_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rescued_animals_source_desertion_no_key
    ON raw.rescued_animals (source, desertion_no);

CREATE INDEX IF NOT EXISTS rescued_animals_notice_edt_idx
    ON raw.rescued_animals (notice_edt);

CREATE INDEX IF NOT EXISTS rescued_animals_org_nm_idx
    ON raw.rescued_animals (org_nm);

CREATE INDEX IF NOT EXISTS rescued_animals_care_reg_no_idx
    ON raw.rescued_animals (care_reg_no);
