DROP VIEW IF EXISTS mart.rescue_window_summary;

CREATE VIEW mart.rescue_window_summary AS
SELECT
    rescue_window_label,
    deadline_bucket,
    COUNT(*) AS animal_count,
    COUNT(*) FILTER (WHERE is_active_notice) AS active_notice_count,
    COUNT(*) FILTER (WHERE has_photo) AS with_photo_count,
    COUNT(*) FILTER (WHERE has_care_tel) AS with_care_tel_count,
    ROUND(AVG(rescue_window_score)::numeric, 1) AS avg_rescue_window_score,
    MIN(days_until_notice_end) AS min_days_until_notice_end,
    MAX(days_until_notice_end) AS max_days_until_notice_end
FROM mart.animals_clean
GROUP BY 1, 2
ORDER BY
    CASE rescue_window_label
        WHEN '긴급 확인' THEN 1
        WHEN '곧 종료' THEN 2
        WHEN '확인 필요' THEN 3
        WHEN '여유 있음' THEN 4
        ELSE 5
    END,
    min_days_until_notice_end NULLS LAST;
