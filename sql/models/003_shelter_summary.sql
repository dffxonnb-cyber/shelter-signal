DROP VIEW IF EXISTS mart.shelter_summary;

CREATE VIEW mart.shelter_summary AS
SELECT
    COALESCE(NULLIF(btrim(care_reg_no), ''), '미상') AS care_reg_no,
    COALESCE(NULLIF(btrim(care_nm), ''), '미상') AS care_nm,
    COALESCE(NULLIF(btrim(org_nm), ''), '미상') AS org_nm,
    COUNT(*) AS animal_count,
    COUNT(*) FILTER (WHERE is_active_notice) AS active_notice_count,
    COUNT(*) FILTER (WHERE rescue_window_label = '긴급 확인') AS urgent_count,
    COUNT(*) FILTER (WHERE NOT has_care_tel) AS missing_care_tel_count,
    ROUND(AVG(rescue_window_score)::numeric, 1) AS avg_rescue_window_score,
    MIN(notice_edt) AS earliest_notice_end
FROM mart.animals_clean
GROUP BY 1, 2, 3
ORDER BY urgent_count DESC, missing_care_tel_count DESC, animal_count DESC, care_nm;
