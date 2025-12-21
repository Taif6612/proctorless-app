-- ============================================
-- DUMMY DATA FOR SPECIFIC USERS
-- Ready to run - Quiz IDs already set!
-- ============================================

-- Submissions for abdullahesthiak@gmail.com (5 quizzes over 20 days)
INSERT INTO submissions (id, quiz_id, student_id, started_at, submitted_at) VALUES
  (gen_random_uuid(), 'e9d957d6-a43c-4f5d-8d11-e0af2df13a5f', '73ab839f-e20f-4cf1-aa7f-f3b32d63a097', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '35 minutes'),
  (gen_random_uuid(), 'd67c564e-cfd6-47e5-a9a0-1ce183ab063a', '73ab839f-e20f-4cf1-aa7f-f3b32d63a097', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days' + INTERVAL '42 minutes'),
  (gen_random_uuid(), '85f4423d-4fee-434c-be52-3861921f90db', '73ab839f-e20f-4cf1-aa7f-f3b32d63a097', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '28 minutes'),
  (gen_random_uuid(), '71be2967-82de-4344-9a75-45e04f8d75b1', '73ab839f-e20f-4cf1-aa7f-f3b32d63a097', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '55 minutes'),
  (gen_random_uuid(), 'b959b359-bb71-4a2c-8afa-395062ea8ae1', '73ab839f-e20f-4cf1-aa7f-f3b32d63a097', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes');

-- Submissions for xihif43899@mekuron.com (4 quizzes over 18 days)
INSERT INTO submissions (id, quiz_id, student_id, started_at, submitted_at) VALUES
  (gen_random_uuid(), 'e9d957d6-a43c-4f5d-8d11-e0af2df13a5f', '53489deb-acb2-4dbf-9c91-ba804e308dfd', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days' + INTERVAL '40 minutes'),
  (gen_random_uuid(), 'd67c564e-cfd6-47e5-a9a0-1ce183ab063a', '53489deb-acb2-4dbf-9c91-ba804e308dfd', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' + INTERVAL '25 minutes'),
  (gen_random_uuid(), '85f4423d-4fee-434c-be52-3861921f90db', '53489deb-acb2-4dbf-9c91-ba804e308dfd', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '50 minutes'),
  (gen_random_uuid(), '71be2967-82de-4344-9a75-45e04f8d75b1', '53489deb-acb2-4dbf-9c91-ba804e308dfd', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '33 minutes');

-- VERIFY: Check submissions were added
SELECT 'Submissions' as type, COUNT(*) as count FROM submissions;
