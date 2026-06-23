// Long-form, narrated product walkthroughs hosted on YouTube and embedded on
// feature pages via <YouTubeEmbed>. These are distinct from the short, silent,
// autoplay loops rendered by <DemoVideo> (public/videos/*.mp4).
//
// TO ACTIVATE: paste the YouTube video id into `id` for each entry after
// uploading. While `id` is empty the embed + schema render nothing, so this is
// safe to merge before the videos are live.

export type VideoChapter = { time: string; label: string };

export type ProductVideo = {
  id: string; // YouTube video id (the part after watch?v=). Empty = not yet live.
  title: string;
  description: string;
  durationIso: string; // ISO-8601, e.g. PT2M36S — for VideoObject schema
  uploadDate: string; // YYYY-MM-DD — set to the actual YouTube upload date
  poster: string; // local poster (avoids a YouTube request before play)
  chapters: VideoChapter[];
};

export const productVideos = {
  createBid: {
    id: '', // ← paste YouTube id after upload
    title: 'Build a complete construction estimate in BuildWorkPro',
    description:
      'A narrated walkthrough of building a construction estimate in BuildWorkPro: create a bid, add line items from your product and assembly catalog, break them into material and labor sublines, add distributed project costs, dial in margin and overhead, and export a client-ready PDF.',
    durationIso: 'PT2M36S',
    uploadDate: '2026-06-21',
    poster: '/videos/tour-create-bid-poster.jpg',
    chapters: [
      { time: '0:00', label: 'Overview' },
      { time: '0:22', label: 'Create the bid' },
      { time: '0:43', label: 'Add line items from your catalog' },
      { time: '1:09', label: 'Break lines into material & labor sublines' },
      { time: '1:30', label: 'Distributed project costs' },
      { time: '1:51', label: 'Dial in margin & overhead' },
      { time: '2:12', label: 'Preview the client-ready PDF' },
    ],
  },
  manageProject: {
    id: '', // ← paste YouTube id after upload
    title: 'Manage a construction project end to end in BuildWorkPro',
    description:
      'A narrated walkthrough of running a construction project in BuildWorkPro: the project command center, scheduling phases and tasks, the Gantt timeline, daily site logs, change orders and AIA-style pay applications, and document and labor-hour tracking.',
    durationIso: 'PT2M25S',
    uploadDate: '2026-06-21',
    poster: '/videos/tour-manage-project-poster.jpg',
    chapters: [
      { time: '0:00', label: 'The projects board' },
      { time: '0:18', label: 'Project command center' },
      { time: '0:35', label: 'Schedule phases & tasks' },
      { time: '0:53', label: 'Gantt timeline' },
      { time: '1:13', label: 'Daily site logs' },
      { time: '1:29', label: 'Change orders & AIA-style pay apps' },
      { time: '1:51', label: 'Documents & labor hours' },
      { time: '2:07', label: 'One connected platform' },
    ],
  },
} satisfies Record<string, ProductVideo>;
