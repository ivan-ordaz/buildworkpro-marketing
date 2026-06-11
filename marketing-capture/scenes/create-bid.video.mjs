// Demo video: the bid ESTIMATE — the core differentiator. Show line items
// built from a material + labor catalog rolling up into the customer total,
// then the Rates tab applying margin and overhead. Not a generic form.
export const meta = {
  name: 'create-bid',
  video: true,
  viewport: 'desktop',
  warmup: ['/bids', '/bids/105'],
};

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  // Open a real draft bid and go straight to the estimate.
  await goto('/bids/105', 1200);
  await wait(700);
  await click('[role="tab"]:has-text("Estimate")');
  await wait(1100);

  // The rollup cards: Materials, Labor, Project Costs, Load → Customer Total.
  await moveTo('text=/Customer Total/i');
  await wait(700);
  await moveTo('text=/Materials/i');
  await wait(600);
  await moveTo('text=/Labor/i');
  await wait(700);

  // Open the product picker to reveal the material + labor catalog.
  await click('button:has-text("Select product...")');
  await wait(1100);
  // Sweep the catalog: condensing units, ducts (material) and labor rates.
  await moveTo('text=/Condensing Unit/i');
  await wait(700);
  await moveTo('text=/Installation Labor/i');
  await wait(800);
  // Add a labor line from the catalog.
  await click('text=/Installation Labor/i');
  await wait(1300);

  // Expand the first line to show its material + labor cost items.
  const expander = page.locator('main table tbody tr button').first();
  await expander.click({ timeout: 2500 }).catch(() => {});
  await wait(1100);
  await scrollTo(360);
  await wait(900);
  await scrollTo(0);
  await wait(600);

  // Rates tab: margin, commission, overhead turn raw cost into the sell price.
  await click('[role="tab"]:has-text("Rates")');
  await wait(1200);
  await moveTo('text=/Margin/i');
  await wait(900);

  // Back to the estimate to land on the updated customer total.
  await click('[role="tab"]:has-text("Estimate")');
  await wait(1100);
  await moveTo('text=/Customer Total/i');
  await wait(900);
}
