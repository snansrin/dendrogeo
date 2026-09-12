"use strict";
const SB_URL="https://xjbpounwdxrhelmixvqm.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnBvdW53ZHhyaGVsbWl4dnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMDA1NzIsImV4cCI6MjEwMzY3NjU3Mn0.Q5b4ys1TkyhMffGaN9bR9A3nr4L4-8G5UBJY4iC4Dkk";
const INITIAL_HASH=window.location.hash||"";
const sb=supabase.createClient(SB_URL,SB_KEY);
