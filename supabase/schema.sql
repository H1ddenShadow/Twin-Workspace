-- Supabase Schema for Notion PWA Workspace

create table if not exists notion_items (
    id text primary key,
    "parentId" text,
    type text,
    title text,
    icon text,
    expanded boolean,
    blocks jsonb,
    "updatedAt" timestamp with time zone
);

create table if not exists notion_records (
    id text primary key,
    "pageId" text,
    title text,
    status text,
    tag text,
    priority text,
    "updatedAt" timestamp with time zone
);

-- Enable Row Level Security (RLS)
alter table notion_items enable row level security;
alter table notion_records enable row level security;

-- Policies for authenticated users
create policy "Allow all operations for authenticated users on notion_items"
    on notion_items for all
    to authenticated
    using (true)
    with check (true);

create policy "Allow all operations for authenticated users on notion_records"
    on notion_records for all
    to authenticated
    using (true)
    with check (true);
