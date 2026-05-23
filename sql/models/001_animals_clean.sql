CREATE SCHEMA IF NOT EXISTS mart;

DROP VIEW IF EXISTS mart.animals_clean CASCADE;

CREATE VIEW mart.animals_clean AS
WITH base AS (
    SELECT
        source,
        desertion_no,
        notice_no,
        happen_dt,
        happen_place,
        notice_sdt,
        notice_edt,
        CASE
            WHEN notice_edt IS NULL THEN NULL
            ELSE notice_edt - CURRENT_DATE
        END AS days_until_notice_end,
        kind_full_nm,
        up_kind_nm,
        up_kind_nm_raw,
        kind_cd,
        kind_nm,
        color_cd,
        age,
        weight,
        popfile1,
        popfile2,
        process_state,
        sex_cd,
        neuter_yn,
        special_mark,
        care_reg_no,
        care_nm,
        care_tel,
        care_addr,
        care_owner_nm,
        org_nm,
        etc_bigo,
        upd_tm,
        collected_at,
        raw_json,
        (
            NULLIF(btrim(popfile1), '') IS NOT NULL
            OR NULLIF(btrim(popfile2), '') IS NOT NULL
        ) AS has_photo,
        NULLIF(btrim(care_tel), '') IS NOT NULL AS has_care_tel,
        (
            notice_edt IS NOT NULL
            AND notice_edt >= CURRENT_DATE
            AND COALESCE(process_state, '') NOT LIKE '종료%'
        ) AS is_active_notice
    FROM raw.rescued_animals
),
scored AS (
    SELECT
        *,
        CASE
            WHEN notice_edt IS NULL THEN '종료/확인 필요'
            WHEN days_until_notice_end < 0 THEN '종료/확인 필요'
            WHEN days_until_notice_end <= 1 THEN '0-1일'
            WHEN days_until_notice_end <= 3 THEN '2-3일'
            WHEN days_until_notice_end <= 7 THEN '4-7일'
            ELSE '8일 이상'
        END AS deadline_bucket,
        LEAST(
            100,
            GREATEST(
                0,
                CASE
                    WHEN notice_edt IS NULL THEN 35
                    WHEN days_until_notice_end < 0 THEN 10
                    WHEN NOT is_active_notice THEN 15
                    WHEN days_until_notice_end <= 1 THEN 75
                    WHEN days_until_notice_end <= 3 THEN 60
                    WHEN days_until_notice_end <= 7 THEN 40
                    ELSE 20
                END
                + CASE WHEN NOT has_photo THEN 10 ELSE 0 END
                + CASE WHEN NOT has_care_tel THEN 10 ELSE 0 END
                + CASE WHEN NULLIF(btrim(special_mark), '') IS NOT NULL THEN 5 ELSE 0 END
            )
        ) AS rescue_window_score
    FROM base
)
SELECT
    *,
    CASE
        WHEN NOT is_active_notice THEN '종료/확인 필요'
        WHEN rescue_window_score >= 80 THEN '긴급 확인'
        WHEN rescue_window_score >= 60 THEN '곧 종료'
        WHEN rescue_window_score >= 35 THEN '확인 필요'
        ELSE '여유 있음'
    END AS rescue_window_label
FROM scored;
