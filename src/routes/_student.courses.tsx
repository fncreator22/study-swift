import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_student/courses")({ component: Courses });

function toEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    return url;
  } catch { return url; }
}

function Courses() {
  const [videos, setVideos] = useState<any[]>([]);
  useEffect(() => { supabase.from("videos").select("*").order("created_at", { ascending: false }).then(({ data }) => setVideos(data ?? [])); }, []);
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Courses & videos</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {videos.length === 0 && <p className="text-sm text-muted-foreground">No videos yet.</p>}
        {videos.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="aspect-video w-full bg-muted">
              <iframe src={toEmbed(v.video_url)} className="h-full w-full" allowFullScreen title={v.title} />
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold">{v.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
