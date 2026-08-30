import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "pricing",
  title: "Pricing & Promos",
  icon: "\ud83c\udff7",
  group: "Catalog",
  order: 90,
  hidden: false,
  summary: "Customer types, rates per item, taxes and fees, and the promo codes layered on top.",
  entities: ["customer_type", "customer_type_rate", "tax_fee", "promo_code"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Pricing & Promos", sub: "Customer types, rates per item, taxes and fees, and the promo codes layered on top." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
