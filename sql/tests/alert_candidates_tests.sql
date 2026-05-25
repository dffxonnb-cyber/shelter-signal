SELECT 'desertion_no_not_null' AS test_name, desertion_no
FROM mart.alert_candidates
WHERE desertion_no IS NULL OR NULLIF(btrim(desertion_no), '') IS NULL

UNION ALL

SELECT 'notice_no_not_null' AS test_name, desertion_no
FROM mart.alert_candidates
WHERE notice_no IS NULL OR NULLIF(btrim(notice_no), '') IS NULL

UNION ALL

SELECT 'rescue_window_label_not_null' AS test_name, desertion_no
FROM mart.alert_candidates
WHERE rescue_window_label IS NULL OR NULLIF(btrim(rescue_window_label), '') IS NULL

UNION ALL

SELECT 'alert_reason_not_null' AS test_name, desertion_no
FROM mart.alert_candidates
WHERE alert_reason IS NULL OR NULLIF(btrim(alert_reason), '') IS NULL

UNION ALL

SELECT 'alert_priority_not_null' AS test_name, desertion_no
FROM mart.alert_candidates
WHERE alert_priority IS NULL

UNION ALL

SELECT 'duplicate_desertion_no' AS test_name, desertion_no
FROM mart.alert_candidates
GROUP BY desertion_no
HAVING COUNT(*) > 1;
