SELECT source, desertion_no, rescue_window_score
FROM mart.animals_clean
WHERE rescue_window_score IS NULL;
