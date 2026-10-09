// Make the seeded demo tenant read like a real HVAC sub before it is filmed.
//
// The seed assembles site logs from independent random pools, so a log titled
// "Crane set day" carries owner-walkthrough notes, a "Delay" tag and someone
// else's work-performed text — and some seeded tags ("commissioning",
// "install") are no longer valid site-log tags at all. Every list and detail
// page in a demo video shows that. This rewrites the tenant's logs into
// coherent entries through the app's own API. Idempotent: run it as often as
// you like, and again after any reseed.

const SITE_LOGS = [
  {
    title: 'Safety stand-down before roof work',
    tags: ['safety'],
    personnelCount: 6,
    notes:
      'Morning stand-down on fall protection before rooftop work. Whole crew signed the sheet; harnesses and lanyards inspected.',
    workPerformed: 'Tailgate meeting, harness inspection, guardrail check at the roof hatch.',
  },
  {
    title: 'Equipment delivery — condensers',
    tags: ['delivery'],
    personnelCount: 3,
    notes:
      'Three Carrier 5-ton condensers delivered and staged on the roof. Checked against the PO — no damage. Packing slips filed to the project.',
    workPerformed: 'Received and staged condensers, verified model and serial numbers.',
    materialsReceived: 'Carrier 5-ton condensers (3), pad kits (3)',
  },
  {
    title: 'Chiller demo complete',
    tags: ['progress', 'safety'],
    personnelCount: 6,
    notes:
      'Old 80-ton chiller disconnected, refrigerant recovered and logged, unit removed through the loading dock. LOTO kept on the electrical feed.',
    workPerformed: 'Refrigerant recovery, disconnect, demo and haul-off of existing chiller.',
  },
  {
    title: 'Ductwork rough-in — level 2',
    tags: ['progress'],
    personnelCount: 5,
    notes:
      'Hung 120 ft of rectangular supply trunk on level 2, east wing. Hangers at 8 ft on center. Ready for the duct leakage test Thursday.',
    workPerformed: 'Supply trunk and branch takeoffs, level 2 east wing.',
  },
  {
    title: 'Rain delay — crew moved inside',
    tags: ['delay', 'safety'],
    personnelCount: 4,
    notes:
      'Rain stopped rooftop work at 10:15 AM. Roof openings covered and secured; crew relocated to interior duct installation for the rest of the day.',
    workPerformed: 'Interior branch duct and diffuser boots, level 1.',
    issues: 'Lost about 4 hours of rooftop work to weather.',
  },
  {
    title: 'Refrigerant line sets run',
    tags: ['progress'],
    personnelCount: 4,
    notes:
      'Ran and brazed line sets from the condensers to AHU-1 and AHU-2 with a nitrogen purge. Lines insulated and supported.',
    workPerformed: 'Line set install, brazing, insulation and supports.',
  },
  {
    title: 'Mechanical rough-in inspection',
    tags: ['inspection'],
    personnelCount: 2,
    notes: 'Mechanical rough-in inspection passed on the first visit. Permit card signed by the inspector.',
    workPerformed: 'Walked the inspector through rough-in on levels 1 and 2.',
    visitorsOnSite: 'City mechanical inspector',
  },
  {
    title: 'New chiller rigged into place',
    tags: ['progress', 'safety'],
    personnelCount: 7,
    notes:
      'New 80-ton chiller rigged into the mechanical room and set on isolation pads. Rigging crew on site 7 AM – 1 PM, pick went to plan.',
    workPerformed: 'Rigging, setting and leveling the new chiller.',
  },
  {
    title: 'Material shortage — VAV boxes',
    tags: ['issue', 'delay'],
    personnelCount: 4,
    notes:
      'Supplier shorted 3 of 12 VAV boxes. Installed the 9 on hand; supplier confirmed the rest ship Tuesday. GC notified.',
    workPerformed: 'Installed and hung 9 VAV boxes on level 2.',
    materialsReceived: 'VAV boxes (9 of 12)',
    issues: '3 VAV boxes back-ordered until Tuesday.',
  },
  {
    title: 'Pressure test passed',
    tags: ['inspection', 'progress'],
    personnelCount: 3,
    notes:
      'System held 400 PSI for 30 minutes with no leaks. Evacuated to 500 microns and holding. Ready for charge.',
    workPerformed: 'Nitrogen pressure test and evacuation, both circuits.',
  },
  {
    title: 'Electrical tie-in for RTUs',
    tags: ['progress'],
    personnelCount: 3,
    notes:
      'Electrician installed disconnects for both rooftop units and tied into the existing panel. Ready for startup.',
    workPerformed: 'Disconnects, whips and panel tie-in coordinated with the electrician.',
  },
  {
    title: 'Gas piping to rooftop units',
    tags: ['progress', 'inspection'],
    personnelCount: 3,
    notes:
      'Gas piping run to RTU-1 and RTU-2 and pressure tested at 15 PSI for 15 minutes. Waiting on utility sign-off.',
    workPerformed: 'Gas piping, regulators and drip legs at both RTUs.',
  },
  {
    title: 'Controls wiring',
    tags: ['progress'],
    personnelCount: 3,
    notes:
      'Wired 14 thermostats and zone dampers back to the new building controller. Point-to-point checkout about 60% done.',
    workPerformed: 'Low-voltage wiring, thermostat mounting, point-to-point checkout.',
  },
  {
    title: 'Condensate drains installed',
    tags: ['progress'],
    personnelCount: 2,
    notes:
      'Installed condensate drains and traps on AHU-1 and AHU-2, routed to the floor drain. Secondary pans in place.',
    workPerformed: 'Condensate piping, traps and secondary drain pans.',
  },
  {
    title: 'Duct leakage test',
    tags: ['inspection'],
    personnelCount: 3,
    notes:
      'Level 2 supply duct tested at 2 in. w.c. — 3.1% leakage, under the 5% spec. Results sent to the GC.',
    workPerformed: 'Duct leakage testing, level 2 supply.',
  },
  {
    title: 'High winds — crane pick postponed',
    tags: ['delay', 'safety'],
    personnelCount: 2,
    notes:
      'Gusts to 35 mph. Crane pick moved to Thursday for safety; crew finished interior prep instead.',
    workPerformed: 'Interior prep and curb adapter fit-up.',
    issues: 'Crane pick rescheduled — no cost impact expected.',
  },
  {
    title: 'Rooftop units set by crane',
    tags: ['progress', 'safety'],
    personnelCount: 6,
    notes:
      'Crane on site at 6:30 AM. Set two 10-ton rooftop units on new curbs after the rigging plan review. Units secured and curb gaskets sealed.',
    workPerformed: 'Set RTU-1 and RTU-2, sealed curbs, temporary covers on openings.',
    materialsReceived: 'Curb adapters (2), gasket kit',
    visitorsOnSite: 'Crane operator and rigger, GC superintendent',
    issues: 'RTU-2 curb was 1/4 in. out of level — shimmed and re-sealed. GC informed.',
  },
  {
    title: 'Exhaust fans replaced',
    tags: ['progress'],
    personnelCount: 3,
    notes:
      'Replaced four restroom exhaust fans on the roof. Existing curbs reused; new backdraft dampers installed.',
    workPerformed: 'Exhaust fan swap-out, dampers, electrical reconnect.',
  },
  {
    title: 'Startup & commissioning',
    tags: ['progress', 'inspection'],
    personnelCount: 4,
    notes:
      'System startup with the manufacturer rep. Superheat and subcooling in spec on every circuit. Commissioning checklist submitted for review.',
    workPerformed: 'Startup, refrigerant charge verification, commissioning checklist.',
  },
  {
    title: 'Test & balance',
    tags: ['inspection'],
    personnelCount: 2,
    notes: 'Balancing contractor on site. 38 of 42 diffusers balanced to design CFM; the last 4 tomorrow.',
    workPerformed: 'Test and balance support, damper adjustments.',
  },
  {
    title: 'Owner walkthrough',
    tags: ['general'],
    personnelCount: 2,
    notes:
      'Owner and GC walked the space and approved the commissioning report. Four punch items noted: grille alignment, two access panel labels, a thermostat cover.',
    workPerformed: 'Walkthrough with owner and GC; punch list recorded.',
    visitorsOnSite: 'Owner representative, GC project manager',
  },
  {
    title: 'Punch list complete',
    tags: ['progress'],
    personnelCount: 2,
    notes: 'Closed out all four punch items from the owner walkthrough. GC signed off on the list.',
    workPerformed: 'Punch list close-out.',
  },
];

const EMPTY_DETAIL = { workPerformed: '', materialsReceived: '', issues: '', visitorsOnSite: '' };

/**
 * Rewrite every seeded site log in the current tenant into a coherent entry,
 * oldest first so the story runs forward in time. Logs whose title is in
 * `skipTitles` (ones a scene creates on camera) are soft-deleted instead, so a
 * re-run starts from the same list.
 */
export async function polishSiteLogs(api, { skipTitles = [] } = {}) {
  const logs = await api.get('/api/site-logs?limit=200&offset=0');
  const seeded = [];
  for (const log of logs) {
    if (skipTitles.includes(log.title)) await api.del(`/api/site-logs/${log.id}`);
    else seeded.push(log);
  }
  seeded.sort((a, b) => new Date(a.logDate) - new Date(b.logDate) || a.id - b.id);
  for (const [i, log] of seeded.entries()) {
    const entry = SITE_LOGS[i % SITE_LOGS.length];
    await api.put(`/api/site-logs/${log.id}`, { ...EMPTY_DETAIL, ...entry });
  }
  return seeded.length;
}
