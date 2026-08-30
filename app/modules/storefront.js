import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "storefront",
  title: "Guest Storefront",
  icon: "\ud83d\uded2",
  group: "Reference",
  order: 290,
  hidden: true,
  summary: "The guest-facing side: the Lightframe booking widget as a visitor experiences it.",
  entities: ["item", "availability", "booking"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Guest Storefront", sub: "The guest-facing side: the Lightframe booking widget as a visitor experiences it." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
