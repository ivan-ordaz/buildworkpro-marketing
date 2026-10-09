// Founder commentary for the monthly materials price report, keyed by data
// month (YYYY-MM). Optional: a report renders without it. Written by a person
// who prices jobs, never generated; trade press quotes this part.
export type Commentary = { author: string; role: string; paragraphs: string[] };

export const COMMENTARY: Record<string, Commentary> = {};
