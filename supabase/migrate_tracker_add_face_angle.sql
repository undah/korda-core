-- Add 'face' as a valid angle for tracker_photos
ALTER TABLE public.tracker_photos
  DROP CONSTRAINT IF EXISTS tracker_photos_angle_check;

ALTER TABLE public.tracker_photos
  ADD CONSTRAINT tracker_photos_angle_check
    CHECK (angle IN ('front', 'side', 'back', 'face'));
