// Demo video: change orders — the depth competitors lack. Show the priced
// "Mark" editor (add/modify/remove, manual pricing, material/labor sublines)
// and the live contract impact that rolls into the contract value.
export const meta = {
  name: 'change-order-demo',
  video: true,
  viewport: 'desktop',
  warmup: ['/change-orders', '/change-orders/29'],
};

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto('/change-orders/29', 1200);
  await wait(800);

  // Priced line items with running contract impact down the right side.
  await moveTo('main table tbody tr');
  await wait(700);
  await moveTo('text=/Contract/i');
  await wait(700);

  // Enter edit mode and open the Add Change Order Mark editor.
  await click('main button:has-text("Edit")');
  await wait(800);
  await click('main button:has-text("Add Item")');
  await wait(1200);

  // Change type, manual pricing, and the live contract impact.
  await moveTo('text=/Change Type/i');
  await wait(700);
  await moveTo('text=/Manual Pricing/i');
  await wait(800);
  await moveTo('text=/Contract Impact/i');
  await wait(800);

  // Sublines: break a mark into material, labor, and other costs.
  await scrollTo(320);
  await wait(900);
  await moveTo('text=/Sublines/i');
  await wait(700);
  await moveTo('button:has-text("Import from Kit")');
  await wait(800);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(700);
}
