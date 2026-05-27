DROP VIEW IF EXISTS mart.alert_candidates;

CREATE VIEW mart.alert_candidates AS
WITH active_notices AS (
    SELECT
        desertion_no,
        notice_no,
        kind_full_nm,
        up_kind_nm,
        kind_nm,
        notice_sdt,
        notice_edt,
        days_until_notice_end,
        rescue_window_score,
        rescue_window_label,
        process_state,
        care_nm,
        care_tel,
        care_addr,
        org_nm,
        happen_place,
        popfile1
    FROM mart.animals_clean
    WHERE is_active_notice
),
direct_candidates AS (
    SELECT
        *,
        CASE
            WHEN days_until_notice_end <= 3 THEN '보호 종료 임박'
            WHEN rescue_window_label = '긴급 확인' THEN '긴급 확인 라벨'
            WHEN rescue_window_label = '곧 종료' THEN '곧 종료 라벨'
            ELSE '우선 확인 점수 상위'
        END AS alert_reason,
        CASE
            WHEN days_until_notice_end <= 1 THEN 1
            WHEN days_until_notice_end <= 3 THEN 2
            WHEN rescue_window_label = '긴급 확인' THEN 3
            WHEN rescue_window_label = '곧 종료' THEN 4
            ELSE 5
        END AS alert_priority
    FROM active_notices
    WHERE
        days_until_notice_end <= 3
        OR rescue_window_label IN ('긴급 확인', '곧 종료')
),
direct_count AS (
    SELECT COUNT(*) AS candidate_count
    FROM direct_candidates
),
fallback_candidates AS (
    SELECT
        active_notices.*,
        '우선 확인 점수 상위' AS alert_reason,
        5 AS alert_priority,
        ROW_NUMBER() OVER (
            ORDER BY
                rescue_window_score DESC,
                days_until_notice_end ASC NULLS LAST,
                desertion_no
        ) AS fallback_rank
    FROM active_notices
    WHERE NOT EXISTS (
        SELECT 1
        FROM direct_candidates
        WHERE direct_candidates.desertion_no = active_notices.desertion_no
    )
),
combined_candidates AS (
    SELECT
        desertion_no,
        notice_no,
        kind_full_nm,
        up_kind_nm,
        kind_nm,
        notice_sdt,
        notice_edt,
        days_until_notice_end,
        rescue_window_score,
        rescue_window_label,
        process_state,
        care_nm,
        care_tel,
        care_addr,
        org_nm,
        happen_place,
        popfile1,
        alert_reason,
        alert_priority
    FROM direct_candidates

    UNION ALL

    SELECT
        desertion_no,
        notice_no,
        kind_full_nm,
        up_kind_nm,
        kind_nm,
        notice_sdt,
        notice_edt,
        days_until_notice_end,
        rescue_window_score,
        rescue_window_label,
        process_state,
        care_nm,
        care_tel,
        care_addr,
        org_nm,
        happen_place,
        popfile1,
        alert_reason,
        alert_priority
    FROM fallback_candidates
    CROSS JOIN direct_count
    WHERE
        direct_count.candidate_count < 5
        AND fallback_candidates.fallback_rank <= 5 - direct_count.candidate_count
)
SELECT
    desertion_no,
    notice_no,
    kind_full_nm,
    up_kind_nm,
    kind_nm,
    notice_sdt,
    notice_edt,
    days_until_notice_end,
    rescue_window_score,
    rescue_window_label,
    process_state,
    care_nm,
    care_tel,
    care_addr,
    org_nm,
    happen_place,
    popfile1,
    alert_reason,
    alert_priority
FROM combined_candidates
ORDER BY
    alert_priority,
    days_until_notice_end ASC NULLS LAST,
    rescue_window_score DESC,
    desertion_no;
