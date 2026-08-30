import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "waivers",
  title: "Waivers",
  icon: "\u270d",
  group: "Catalog",
  order: 110,
  hidden: false,
  summary: "Waiver templates, minor policies, and the signature record behind every guest.",
  entities: ["waiver_template", "waiver_signature", "booking_customer"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Waivers", sub: "Waiver templates, minor policies, and the signature record behind every guest." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
