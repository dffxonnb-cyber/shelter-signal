DROP VIEW IF EXISTS mart.kind_summary;

CREATE VIEW mart.kind_summary AS
SELECT
    COALESCE(NULLIF(btrim(up_kind_nm), ''), '미상') AS up_kind_nm,
    COALESCE(NULLIF(btrim(kind_nm), ''), '미상') AS kind_nm,
    COUNT(*) AS animal_count,
    COUNT(*) FILTER (WHERE is_active_notice) AS active_notice_count,
    COUNT(*) FILTER (WHERE rescue_window_label IN ('긴급 확인', '곧 종료')) AS high_priority_count,
    COUNT(*) FILTER (WHERE NOT has_photo) AS missing_photo_count,
    ROUND(AVG(rescue_window_score)::numeric, 1) AS avg_rescue_window_score
FROM mart.animals_clean
GROUP BY 1, 2
ORDER BY high_priority_count DESC, animal_count DESC, up_kind_nm, kind_nm;
