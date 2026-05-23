DROP VIEW IF EXISTS mart.region_summary;

CREATE VIEW mart.region_summary AS
SELECT
    COALESCE(NULLIF(btrim(org_nm), ''), '미상') AS org_nm,
    COUNT(*) AS animal_count,
    COUNT(*) FILTER (WHERE is_active_notice) AS active_notice_count,
    COUNT(*) FILTER (WHERE rescue_window_label = '긴급 확인') AS urgent_count,
    COUNT(*) FILTER (WHERE deadline_bucket IN ('0-1일', '2-3일')) AS ending_soon_count,
    ROUND(AVG(rescue_window_score)::numeric, 1) AS avg_rescue_window_score,
    MIN(notice_edt) AS earliest_notice_end,
    MAX(collected_at) AS latest_collected_at
FROM mart.animals_clean
GROUP BY 1
ORDER BY urgent_count DESC, ending_soon_count DESC, animal_count DESC, org_nm;
