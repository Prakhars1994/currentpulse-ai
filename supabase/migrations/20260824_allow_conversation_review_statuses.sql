-- Conversation review inbox statuses.
-- Production DDL must be applied only after explicit approval.
alter table public.news_queue
  drop constraint if exists news_queue_status_check;

alter table public.news_queue
  add constraint news_queue_status_check
  check (
    status in (
      'NEW',
      'GENERATING',
      'DRAFT',
      'PUBLISHED',
      'REJECTED',
      'review',
      'review_batch'
    )
  );
